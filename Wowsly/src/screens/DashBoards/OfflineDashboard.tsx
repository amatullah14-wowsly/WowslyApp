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
import { downloadOfflineData } from '../../api/event';
import Toast from 'react-native-toast-message';
import { initDB, insertOrReplaceGuests, getTicketsForEvent } from '../../db';
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
  // Removed persistent selectedCard state
  const [downloading, setDownloading] = useState(false);
  const [offlineData, setOfflineData] = useState<any>(null);

  const totals = useMemo(
    () => ({
      total: 245,
      checkedIn: 122,
      remaining: 245 - 122,
    }),
    [],
  );

  const guestBuckets = [
    { id: 'general', title: 'General', total: 188, checkedIn: 102 },
    { id: 'vip', title: 'VIP', total: 45, checkedIn: 15 },
    { id: 'vvip', title: 'VVIP', total: 12, checkedIn: 4 },
    { id: 'crew', title: 'Crew', total: 10, checkedIn: 1 },
  ];

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
        } catch (error) {
          console.error('Error loading offline data:', error);
        }
      }
    };
    loadOfflineData();
  }, [eventId]);

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
        // Save to SQLite database
        await insertOrReplaceGuests(eventId, res.guests_list);

        // Reload from database to update UI
        const tickets = await getTicketsForEvent(eventId);
        setOfflineData(tickets);

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

        <Text style={styles.subHeader}>Last synced: 2 hours ago | 245 guests downloaded</Text>

        {/* CARDS */}
        <View style={styles.cardGrid}>

          {/* Download */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={DOWNLOAD_ICON}
              title="Download Data"
              subtitle="Get the latest guest list"
              meta={offlineData ? `${offlineData.length} guests downloaded` : 'Tap to download'}
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
              meta="14 check-ins pending"
              onPress={() => { }}
            />
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
            {guestBuckets.map(b => (
              <View key={b.id} style={styles.bucketCard}>
                <Text style={styles.bucketTitle}>{b.title}</Text>
                <Text style={styles.bucketMeta}>Total: {b.total} | Checked: {b.checkedIn}</Text>
                <Text style={styles.bucketRemaining}>Remaining: {b.total - b.checkedIn}</Text>
              </View>
            ))}
          </View>

          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>14 offline check-ins pending sync</Text>
            <Text style={styles.storageText}>Local storage used: 3.2 MB</Text>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={[styles.ctaButton, styles.ctaGhost]}>
            <Text style={[styles.ctaText, styles.ctaGhostText]}># Get Count</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaButton}>
            <Text style={styles.ctaText}>Export List</Text>
          </TouchableOpacity>
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
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
    flex: 1,
  },
  subHeader: {
    textAlign: 'center',
    marginTop: 8,
    color: '#7A6255',
    fontSize: 12,
  },
  cardGrid: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  cardItem: {
    width: '45%',
    position: 'relative',
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  summaryCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#D7C5BA',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    gap: 18,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B1D16',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 12,
  },
  summaryStat: {
    fontSize: 13,
    color: '#7A6255',
    marginRight: 8,
    marginTop: 4,
    flexShrink: 0,
  },
  summaryValue: {
    color: '#2B1D16',
    fontWeight: '700',
  },
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  bucketCard: {
    width: '48%',
    backgroundColor: '#FFF5EE',
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  bucketTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B1D16',
  },
  bucketMeta: {
    fontSize: 13,
    color: '#8E7465',
  },
  bucketRemaining: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF8A3C',
  },
  pendingRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1E4DC',
    paddingTop: 16,
    gap: 6,
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B1D16',
  },
  storageText: {
    fontSize: 13,
    color: '#8E7465',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
  },
  ctaButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    shadowColor: '#D7C5BA',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  ctaText: {
    color: 'black',
    fontWeight: '600',
    fontSize: 15,
  },
  ctaGhost: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#D7C5BA',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 1, height: 10 },
    elevation: 2,
  },
  ctaGhostText: {
    color: '#2B1D16',
  },
});