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
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineCard from '../../components/OfflineCard';
import { downloadOfflineData } from '../../api/event';

const BACK_ICON = require('../../assets/img/common/back.png');
const OFFLINE_ICON = require('../../assets/img/Mode/offlinemode.png');
const QR_ICON = require('../../assets/img/common/qrcode.png');
const DOWNLOAD_ICON = require('../../assets/img/Mode/offlinemode.png');
const UPLOAD_ICON = require('../../assets/img/eventdashboard/upload.png');
const GUEST_ICON = require('../../assets/img/eventdashboard/guests.png');

const OfflineDashboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { eventId } = route.params || {};
  const [selectedCard, setSelectedCard] = useState<'download' | 'scan' | 'upload' | 'guests'>('scan');
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

  // Load saved offline data
  useEffect(() => {
    const loadOfflineData = async () => {
      if (eventId) {
        try {
          const savedData = await AsyncStorage.getItem(`offline_guests_${eventId}`);
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            setOfflineData(parsedData);
            console.log(`Loaded ${parsedData.length} guests`);
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
      Alert.alert('Error', 'No event ID');
      return;
    }
    setDownloading(true);
    try {
      const res = await downloadOfflineData(eventId);
      if (res?.guests_list) {
        setOfflineData(res.guests_list);
        await AsyncStorage.setItem(`offline_guests_${eventId}`, JSON.stringify(res.guests_list));
        Alert.alert('Success', `Downloaded ${res.guests_list.length} guests`);
      } else {
        Alert.alert('Error', res?.message || 'Failed to download');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Image source={BACK_ICON} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Offline Mode</Text>
        </View>

        <Text style={styles.subHeader}>Last synced: 2 hours ago | 245 guests downloaded</Text>

        {/* <View style={styles.statusRow}>
          <View style={styles.modeChip}>
            <Image source={OFFLINE_ICON} style={styles.modeIcon} />
            <Text style={styles.modeText}>Offline</Text>
          </View>
          <Text style={styles.statusInfo}>{offlineData ? `${offlineData.length} guests` : '0 guests'} saved</Text>
          <Text style={styles.statusUpdated}>Updated 2h ago</Text>
        </View> */}

        {/* CARDS */}
        <View style={styles.cardGrid}>

          {/* Download */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={DOWNLOAD_ICON}
              title="Download Data"
              subtitle="Get the latest guest list"
              meta={offlineData ? `${offlineData.length} guests downloaded` : 'Tap to download'}
              isActive={selectedCard === 'download'}
              onPress={() => {
                setSelectedCard('download');
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
              isActive={selectedCard === 'scan'}
              onPress={() => {
                setSelectedCard('scan');
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
              isActive={selectedCard === 'upload'}
              onPress={() => setSelectedCard('upload')}
            />
          </View>

          {/* Guests */}
          <View style={styles.cardItem}>
            <OfflineCard
              icon={GUEST_ICON}
              title="Guest List"
              subtitle="View downloaded guests"
              meta={`Total: ${totals.total} | Checked: ${totals.checkedIn}`}
              isActive={selectedCard === 'guests'}
              onPress={() => setSelectedCard('guests')}
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
  backButton: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 14,
    height: 22,
    resizeMode: 'contain',
    tintColor: '#1F1F1F',
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
  // statusRow: {
  //   marginTop: 18,
  //   borderRadius: 24,
  //   backgroundColor: '#FFFFFF',
  //   paddingHorizontal: 18,
  //   // paddingVertical: 14,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   shadowColor: '#D7C5BA',
  //   shadowOpacity: 0.25,
  //   shadowRadius: 8,
  //   shadowOffset: { width: 0, height: 6 },
  //   elevation: 2,

  // },
  // modeChip: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   backgroundColor: '#FFE4D2',
  //   borderRadius: 8,
  //   paddingHorizontal: 8,
  //   paddingVertical: 5,
  //   alignSelf: 'flex-start',
  //   gap: 6,
  // },
  // modeIcon: {
  //   width: 12,
  //   height: 12,
  //   resizeMode: 'contain',
  // },
  // modeText: {
  //   fontWeight: '600',
  //   color: '#FF8A3C',
  //   fontSize: 12,
  // },
  // statusInfo: {
  //   marginTop: 0,
  //   fontSize: 12,
  //   color: '#2B1D16',
  //   fontWeight: '600',
  // },
  // statusUpdated: {
  //   fontSize: 12,
  //   color: '#9C8479',
  // },
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