import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  DeviceEventEmitter,
  Modal,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import OfflineCard from '../../components/OfflineCard';
import { downloadOfflineData, syncPendingCheckins } from '../../api/event';
import Toast from 'react-native-toast-message';

import {
  initDB,
  insertOrReplaceGuests,
  getTicketsForEvent,
  getUnsyncedCheckins,
  markTicketsAsSynced,
  deleteStaleGuests,
  getEventSummary,
  getUnsyncedFacilities,
  insertFacilityForGuest   // <-- ensure this is exported in db.js
} from '../../db';

import BackButton from '../../components/BackButton';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import { FontSize } from '../../constants/fontSizes';

const OFFLINE_ICON = require('../../assets/img/Mode/offlinemode.png');
const QR_ICON = require('../../assets/img/common/qrcode.png');
const DOWNLOAD_ICON = require('../../assets/img/Mode/offlinemode.png');
const UPLOAD_ICON = require('../../assets/img/eventdashboard/upload.png');
const GUEST_ICON = require('../../assets/img/eventdashboard/guests.png');

// CACHE
let cachedSummary: any[] = [];
let cachedOfflineData: any = null;

const OfflineDashboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { eventId } = route.params || {};

  // Responsive Layout
  // Responsive Layout
  const { width } = useWindowDimensions();
  const isTablet = width >= 720;
  const numColumns = isTablet ? 3 : 2;
  const gap = scale(16);
  const paddingH = scale(20);

  // Create a constrained width for calculation if on tablet
  const containerWidth = isTablet ? Math.min(width, 900) : width;
  const cardWidth = (containerWidth - (paddingH * 2) - (gap * (numColumns - 1))) / numColumns;

  const tabletTitleSize = isTablet ? FontSize.xl : useTabletModerateScale(FontSize.xl);
  const tabletSubtitleSize = isTablet ? FontSize.md : useTabletModerateScale(FontSize.md);


  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [offlineData, setOfflineData] = useState<any>(cachedOfflineData);
  const [summary, setSummary] = useState<any[]>(cachedSummary);

  const [pendingCount, setPendingCount] = useState(0);
  const [showExitWarning, setShowExitWarning] = useState(false);

  const totals = useMemo(() => {
    const unique = summary.reduce((acc, item) => acc + (item.count || 0), 0);
    const total = summary.reduce((acc, item) => acc + (item.total_pax || 0), 0);
    const checkedIn = summary.reduce((acc, item) => acc + (item.checked_in || 0), 0);

    return {
      total,
      checkedIn,
      remaining: total - checkedIn,
      unique
    };
  }, [summary]);

  const guestBuckets = useMemo(() => {
    return summary.map(item => ({
      id: item.ticket_title,
      title: item.ticket_title,
      total: item.total_pax || 0,
      checkedIn: item.checked_in || 0
    }));
  }, [summary]);

  const loadOfflineData = useCallback(async () => {
    if (eventId) {
      try {
        await initDB();

        const stats = await getEventSummary(eventId);
        cachedSummary = stats;
        setSummary(stats);

        const tickets = await getTicketsForEvent(eventId);
        if (tickets) {
          cachedOfflineData = tickets;
          setOfflineData(tickets);
        }

        const pendingGuests = await getUnsyncedCheckins(eventId);
        const pendingFacilities = await getUnsyncedFacilities(eventId);
        setPendingCount(pendingGuests.length + pendingFacilities.length);


      } catch (error) {
        console.error('Error loading offline data:', error);
      }
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      loadOfflineData();
    }, [loadOfflineData])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', () => {
      loadOfflineData();
    });
    return () => sub.remove();
  }, [loadOfflineData]);

  /* REMOVED UNUSED ticketList STATE AND FETCH logic */

  // --------------------------------------------------------
  //              DOWNLOAD OFFLINE GUESTS + FACILITIES
  // --------------------------------------------------------

  const handleDownloadData = async (isAuto = false) => {
    if (!eventId) {
      if (!isAuto) Toast.show({ type: 'error', text1: 'Error', text2: 'No event ID' });
      return;
    }

    setDownloading(true);

    try {
      await initDB();

      const res = await downloadOfflineData(eventId);
      if (res?.guests_list) {

        // ---- CLEAN STALE GUESTS ----
        const activeQrCodes = res.guests_list
          .map((g: any) => (g.qr_code || g.uuid || g.guest_uuid || '').toString().trim())
          .filter((q: string) => q.length > 0);

        const deletedCount = await deleteStaleGuests(eventId, activeQrCodes);

        // Usage of module-level cache ensures we don't use stale state value in closure
        const initialCount = (cachedOfflineData || offlineData || []).length;

        // ---- INSERT GUESTS ----
        await insertOrReplaceGuests(eventId, res.guests_list);

        /* ------------------------------------------------------------
            ⭐ ADD FACILITY INSERT LOGIC HERE (IMPORTANT)
           ------------------------------------------------------------ */
        for (const guest of res.guests_list) {

          const guestUuid = guest.qr_code || guest.uuid || guest.guest_uuid;
          const ticketId = guest.ticket_id || guest.qrTicketId;

          if (guest.facilities && guest.facilities.length > 0) {
            for (const f of guest.facilities) {

              await insertFacilityForGuest({
                guest_uuid: guestUuid,
                facilityId: f.id,
                name: f.name,
                availableScans: f.quantity || f.total_scans || 0,
                checkIn: f.scanned_count || f.used_count || 0,
                eventId,
                ticket_id: ticketId
              });
            }
          }
        }
        /* ------------------------------------------------------------
            END FACILITY INSERT LOGIC
           ------------------------------------------------------------ */

        // ---- Reload Offline DB Data & Stats ----
        await loadOfflineData();

        // Use updated cache for calculations
        const tickets = cachedOfflineData;

        const finalCount = tickets ? tickets.length : 0;
        const addedCount = Math.max(0, finalCount - (initialCount - (deletedCount || 0)));

        if (addedCount === 0 && deletedCount === 0) {
          if (!isAuto) Toast.show({ type: 'info', text1: 'Download Complete', text2: 'Already up to date' });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Download Complete',
            text2: `Added ${addedCount} | Removed ${deletedCount}`
          });
        }

      } else {
        if (!isAuto) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: res?.message || 'Failed to download'
          });
        }
      }

    } catch (err) {
      console.error(err);
      if (!isAuto) Toast.show({ type: 'error', text1: 'Error', text2: 'Download failed' });
    } finally {
      setDownloading(false);
    }
  };

  // ⚡⚡⚡ AUTO DOWNLOAD ON MOUNT ONLY (Entry from Mode Selection) ⚡⚡⚡
  useEffect(() => {
    // This only runs ONCE when the screen component is first mounted.
    // It does NOT run when coming back from GuestList (Refocus).
    const timer = setTimeout(() => {
      handleDownloadData(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // --------------------------------------------------------
  //                      EXIT HANDLING
  // --------------------------------------------------------
  const handleBackPress = useCallback(() => {
    if (pendingCount > 0) {
      setShowExitWarning(true);
      return true; // Prevent default behavior
    }
    navigation.goBack();
    return true;
  }, [pendingCount, navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  // --------------------------------------------------------
  //                      UPLOAD OFFLINE DATA
  // --------------------------------------------------------

  const handleUploadData = async () => {
    if (!eventId) return;

    setUploading(true);
    try {
      const res = await syncPendingCheckins(eventId);

      if (res?.success) {
        setPendingCount(0);

        Toast.show({
          type: 'success',
          text1: 'Synced',
          text2: res.message || 'Uploaded successfully'
        });

        loadOfflineData();

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

  // --------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <ResponsiveContainer maxWidth={900}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          <View style={styles.header}>
            <View style={styles.backButtonContainer}>
              <BackButton onPress={handleBackPress} />
            </View>
            <Text style={styles.headerTitle}>Offline Mode</Text>
          </View>

          <Text style={styles.subHeader}>
            Last synced: Just now | {totals.unique} guests downloaded
          </Text>

          <View style={styles.cardGrid}>

            {/* Download card */}
            <View style={[styles.cardItem, { width: cardWidth }]}>
              <OfflineCard
                icon={DOWNLOAD_ICON}
                title="Download Data"
                subtitle="Get the latest guest list"
                meta={offlineData ? `Total: ${totals.unique} guests` : 'Tap to download'}
                onPress={() => handleDownloadData(false)}
              />
              {downloading && (
                <View style={styles.downloadingOverlay}>
                  <ActivityIndicator size="small" color="#FF8A3C" />
                </View>
              )}
            </View>

            {/* Scan */}
            <View style={[styles.cardItem, { width: cardWidth }]}>
              <OfflineCard
                icon={QR_ICON}
                title="Scan Ticket"
                subtitle="Check-in attendees"
                badge="Offline Check-in"
                onPress={() =>
                  navigation.navigate('QrCode', {
                    modeTitle: 'Offline Mode',
                    eventTitle: 'Offline Event',
                    eventId,
                    offline: true,
                  })
                }
              />
            </View>

            {/* Upload */}
            <View style={[styles.cardItem, { width: cardWidth }]}>
              <OfflineCard
                icon={UPLOAD_ICON}
                title="Upload Data"
                subtitle="Upload new check-ins"
                meta={`${pendingCount} pending`}
                onPress={handleUploadData}
              />
              {uploading && (
                <View style={styles.downloadingOverlay}>
                  <ActivityIndicator size="small" color="#FF8A3C" />
                </View>
              )}
            </View>

            {/* Guests */}
            <View style={[styles.cardItem, { width: cardWidth }]}>
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
          <View style={[styles.summaryCard, isTablet && { marginHorizontal: scale(100) }]}>
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
              <Text style={styles.storageText}>Local storage used: 3.2MB</Text>
            </View>

          </View>

        </ScrollView>

        {/* ⚠️ EXIT WARNING MODAL ⚠️ */}
        <Modal
          visible={showExitWarning}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowExitWarning(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && { maxWidth: scale(500) }]}>
              <Text style={styles.modalTitle}>Pending Uploads</Text>
              <Text style={styles.modalText}>
                Your uploads are remaining. If you exit, your scanned data will be lost.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowExitWarning(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.exitButton]}
                  onPress={() => {
                    setShowExitWarning(false);
                    navigation.goBack();
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.exitButtonText]}>Exit Anyway</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ResponsiveContainer>
    </SafeAreaView>
  );
};

export default OfflineDashboard;

/* ---------------- STYLE OMITTED FOR BREVITY ---------------- */


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // paddingHorizontal: scale(20),
    paddingBottom: verticalScale(40),
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 8,
    position: 'relative',
    paddingHorizontal: scale(20),
  },
  backButtonContainer: {
    position: 'absolute',
    left: scale(20),
    zIndex: 10,
  },
  headerTitle: {
    fontSize: moderateScale(FontSize.xl),
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subHeader: {
    textAlign: 'center',
    fontSize: moderateScale(FontSize.xs),
    color: '#666',
    marginBottom: verticalScale(20),
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // justifyContent: 'space-between',
    gap: scale(16), // Use gap for simpler spacing
    paddingHorizontal: scale(20),
  },
  cardItem: {
    // width: '48%', // Removed fixed width
    marginBottom: verticalScale(16),
    position: 'relative',
  },
  downloadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: scale(12),
  },
  summaryCard: {
    marginHorizontal: scale(20),
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: moderateScale(FontSize.md),
    fontWeight: '600',
    color: '#111827',
    marginBottom: verticalScale(12),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  summaryStat: {
    fontSize: moderateScale(FontSize.xs),
    color: '#6B7280',
  },
  summaryValue: {
    fontWeight: '700',
    color: '#111827',
  },
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: verticalScale(16),
  },
  bucketCard: {
    backgroundColor: '#FFFFFF',
    padding: scale(8),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '48%',
    flex: 1,
  },
  bucketTitle: {
    fontSize: moderateScale(FontSize.xs),
    fontWeight: '600',
    color: '#374151',
    marginBottom: verticalScale(4),
  },
  bucketMeta: {
    fontSize: moderateScale(FontSize.xs),
    color: '#6B7280',
  },
  bucketRemaining: {
    fontSize: moderateScale(FontSize.xs),
    color: '#EF4444',
    fontWeight: '500',
    marginTop: verticalScale(2),
  },
  pendingRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: verticalScale(12),
    marginBottom: verticalScale(4),
  },
  pendingText: {
    fontSize: moderateScale(FontSize.xs),
    fontWeight: '600',
    color: '#F59E0B',
  },
  storageText: {
    fontSize: moderateScale(FontSize.xs),
    color: '#9CA3AF',
    marginTop: verticalScale(2),
  },
  // ⚡⚡⚡ MODAL STYLES ⚡⚡⚡
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(24),
    width: '90%',
    maxWidth: scale(400),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: scale(4),
  },
  modalTitle: {
    fontSize: moderateScale(FontSize.lg),
    fontWeight: '700',
    color: '#111827',
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  modalText: {
    fontSize: moderateScale(FontSize.sm),
    color: '#4B5563',
    marginBottom: verticalScale(24),
    textAlign: 'center',
    lineHeight: verticalScale(20),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: scale(12),
    justifyContent: 'center',
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  exitButton: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: moderateScale(FontSize.sm),
    fontWeight: '600',
    color: '#374151',
  },
  exitButtonText: {
    color: '#FFFFFF',
  },
});

