import React, { useMemo, useState, useEffect } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import OfflineCard from '../../components/OfflineCard';
import { downloadOfflineData, getTicketList, syncPendingCheckins } from '../../api/event';
import Toast from 'react-native-toast-message';
import { initDB, insertOrReplaceGuests, getTicketsForEvent, getUnsyncedCheckins, markTicketsAsSynced, deleteStaleGuests } from '../../db';
import BackButton from '../../components/BackButton';

const OFFLINE_ICON = require('../../assets/img/Mode/offlinemode.png');
const QR_ICON = require('../../assets/img/common/qrcode.png');
const DOWNLOAD_ICON = require('../../assets/img/Mode/offlinemode.png');
const UPLOAD_ICON = require('../../assets/img/eventdashboard/upload.png');
const GUEST_ICON = require('../../assets/img/eventdashboard/guests.png');

const OfflineDashboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { eventId } = route.params || {};

  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [offlineData, setOfflineData] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [ticketList, setTicketList] = useState<any[]>([]);

  const totals = useMemo(() => {
    if (!offlineData) return { total: 0, checkedIn: 0, remaining: 0 };

    // Sum of all total_entries (Pax count)
    const total = offlineData.reduce((sum: number, g: any) => sum + (g.total_entries || 1), 0);

    // Sum of all used_entries
    const checkedIn = offlineData.reduce((sum: number, g: any) => sum + (g.used_entries || 0), 0);

    return {
      total,
      checkedIn,
      remaining: total - checkedIn,
    };
  }, [offlineData]);

  const guestBuckets = useMemo(() => {
    // Always calculate from local offlineData to reflect real-time offline scans
    if (!offlineData) return [];

    const buckets: any = {};

    offlineData.forEach((guest: any) => {
      // Use ticket_title if available, otherwise fallback to 'General'
      const title = guest.ticket_title || guest.ticket_name || guest.ticket_type || 'General';
      const key = title.toLowerCase();

      if (!buckets[key]) {
        buckets[key] = {
          id: key,
          title: title,
          total: 0,
          checkedIn: 0
        };
      }

      buckets[key].total += (guest.total_entries || 1);
      buckets[key].checkedIn += (guest.used_entries || 0);
    });

    return Object.values(buckets);
  }, [offlineData]);

  // Initialize database and load saved offline data
  useEffect(() => {
    const loadOfflineData = async () => {
      if (eventId) {
        try {
          await initDB();
          const tickets = await getTicketsForEvent(eventId);
          if (tickets && tickets.length > 0) {
            setOfflineData(tickets);
            console.log(`Loaded ${tickets.length} guests from database`);
          }

          // Check for pending uploads
          const pending = await getUnsyncedCheckins(eventId);
          setPendingCount(pending.length);

          // Fetch Ticket List (Online)
          fetchTicketList(eventId);
        } catch (error) {
          console.error('Error loading offline data:', error);
        }
      }
    };
    loadOfflineData();
  }, [eventId]);

  const fetchTicketList = async (id: string) => {
    try {
      const res = await getTicketList(id);
      if (res?.data) {
        setTicketList(res.data);
      }
    } catch (e) {
      console.log("Failed to fetch ticket list in offline dashboard", e);
    }
  };

  const handleDownloadData = async () => {
    if (!eventId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No event ID'
      });
      return;
    }
    setDownloading(true);
    try {
      await initDB();
      const res = await downloadOfflineData(eventId);
      if (res?.guests_list) {
        console.log("DEBUG: Downloaded list length:", res.guests_list.length);
        if (res.guests_list.length > 0) {
          console.log("DEBUG: First guest sample:", JSON.stringify(res.guests_list[0]));
        }

        // ⚡⚡⚡ CLEANUP STALE DATA ⚡⚡⚡
        // Collect all valid QR codes from the new list
        const activeQrCodes = res.guests_list
          .map((g: any) => (g.qr_code || g.qr || g.code || g.uuid || g.guest_uuid || '').toString().trim())
          .filter((q: string) => q.length > 0);

        console.log("DEBUG: Active QR codes count:", activeQrCodes.length);

        // Delete guests that are no longer in the list (but keep unsynced ones)
        await deleteStaleGuests(eventId, activeQrCodes);

        // Save to SQLite database
        await insertOrReplaceGuests(eventId, res.guests_list);

        // Reload from database to update UI
        const tickets = await getTicketsForEvent(eventId);
        setOfflineData(tickets);

        // Also refresh ticket list
        fetchTicketList(eventId);

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Downloaded ${res.guests_list.length} guests`
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: res?.message || 'Failed to download'
        });
      }
    } catch (err) {
      console.error(err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Download failed'
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadData = async () => {
    if (!eventId) return;

    setUploading(true);
    try {
      // Use the iterative sync function from event.js that handles the 404 issue
      const res = await syncPendingCheckins(eventId);

      if (res?.success) {
        setPendingCount(0);

        Toast.show({
          type: 'success',
          text1: 'Synced',
          text2: res.message || 'Uploaded check-ins'
        });

        // Auto-download to get latest state from server
        handleDownloadData();

      } else {
        throw new Error(res?.message || "Sync failed");
      }

    } catch (error) {
      console.error("Upload error:", error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: 'Could not sync check-ins'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.backButtonContainer}>
            <BackButton onPress={() => navigation.goBack()} />
          </View>
          <Text style={styles.headerTitle}>Offline Mode</Text>
        </View>

        <Text style={styles.subHeader}>
          Last synced: Just now | {totals.total} guests downloaded
        </Text>

        {/* CARDS */}
        <View style={styles.cardGrid}>

          {/* Download */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={DOWNLOAD_ICON}
              title="Download Data"
              subtitle="Get the latest guest list"
              meta={offlineData ? `${totals.total} guests downloaded` : 'Tap to download'}
              onPress={() => {
                handleDownloadData();
              }}
            />
            {downloading && (
              <View style={styles.downloadingOverlay}>
                <ActivityIndicator size="small" color="#FF8A3C" />
              </View>
            )}
          </View>

          {/* Scan */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={QR_ICON}
              title="Scan Ticket"
              subtitle="Check-in attendees"
              badge="Offline Check-in"
              onPress={() => {
                navigation.navigate('QrCode', {
                  modeTitle: 'Offline Mode',
                  eventTitle: 'Offline Event',
                  eventId,
                  offline: true,
                });
              }}
            />
          </View>

          {/* Upload */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={UPLOAD_ICON}
              title="Upload Data"
              subtitle="Sync new check-ins"
              meta={`${pendingCount} check-ins pending`}
              onPress={handleUploadData}
            />
            {uploading && (
              <View style={styles.downloadingOverlay}>
                <ActivityIndicator size="small" color="#FF8A3C" />
              </View>
            )}
          </View>

          {/* Guests */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={GUEST_ICON}
              title="Guest List"
              subtitle="View downloaded guests"
              meta={`Total: ${totals.total} | Checked: ${totals.checkedIn}`}
              onPress={() => {
                navigation.navigate('OfflineGuestList', {
                  eventId,
                  offlineData,
                });
              }}
            />
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Offline Guest Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryStat}>Total Guests: <Text style={styles.summaryValue}>{totals.total}</Text></Text>
            <Text style={styles.summaryStat}>Checked-in: <Text style={styles.summaryValue}>{totals.checkedIn}</Text></Text>
            <Text style={styles.summaryStat}>Remaining: <Text style={styles.summaryValue}>{totals.remaining}</Text></Text>
          </View>

          <View style={styles.bucketGrid}>
            {guestBuckets.map((b: any) => (
              <View key={b.id} style={styles.bucketCard}>
                <Text style={styles.bucketTitle}>{b.title}</Text>
                <Text style={styles.bucketMeta}>Total: {b.total} | Checked: {b.checkedIn}</Text>
                <Text style={styles.bucketRemaining}>Remaining: {b.total - b.checkedIn}</Text>
              </View>
            ))}
          </View>

          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>{pendingCount} offline check-ins pending sync</Text>
            <Text style={styles.storageText}>Local storage used: 3.2 MB</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default OfflineDashboard;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 8,
    position: 'relative',
    paddingHorizontal: 20,
  },
  backButtonContainer: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subHeader: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  cardItem: {
    width: '48%',
    marginBottom: 16,
    position: 'relative',
  },
  downloadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryStat: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryValue: {
    fontWeight: '700',
    color: '#111827',
  },
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  bucketCard: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '48%',
    flex: 1,
  },
  bucketTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  bucketMeta: {
    fontSize: 10,
    color: '#6B7280',
  },
  bucketRemaining: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '500',
    marginTop: 2,
  },
  pendingRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  storageText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});
