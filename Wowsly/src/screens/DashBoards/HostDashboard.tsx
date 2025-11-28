import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';

type HostDashboardRoute = RouteProp<
  {
    HostDashboard: {
      eventTitle?: string;
    };
  },
  'HostDashboard'
>;

const QR_PLACEHOLDER =
  'https://upload.wikimedia.org/wikipedia/commons/5/5c/Qr-2.png';

const infoRows = [
  {
    id: 'ip',
    label: 'Host IP Address',
    value: '192.168.1.10',
    accent: '#FFE8D9',
    icon: require('../../assets/img/eventdashboard/hostip.png'),
  },
  {
    id: 'ssid',
    label: 'Network SSID',
    value: 'EventNet-2.4GHz',
    accent: '#FFE8D9',
    icon: require('../../assets/img/Mode/onlinemode.png'),
  },
  {
    id: 'clients',
    label: 'Connected Clients',
    value: '12',
    accent: '#FFE8D9',
    icon: require('../../assets/img/eventdashboard/guests.png'),
    valueColor: '#1B9448',
  },
];

const actionRows = [
  {
    id: 'download',
    title: 'Download Data',
    icon: require('../../assets/img/Mode/offlinemode.png'),
    info: 'Download the latest guest list and check-in data for offline use.',
  },
  {
    id: 'count',
    title: 'Get Count',
    icon: require('../../assets/img/eventdashboard/count.png'),
    info: 'View a combined total of check-ins across all connected devices.',
  },
  {
    id: 'upload',
    title: 'Upload Data',
    icon: require('../../assets/img/eventdashboard/upload.png'),
    info: 'Send check-in updates captured offline back to the server.',
  },
  {
    id: 'export',
    title: 'Export List',
    icon: require('../../assets/img/eventdashboard/export.png'),
    info: 'Export the attendee list with current statuses for reporting.',
  },
];

const INFO_ICON = require('../../assets/img/common/info.png');

const HostDashboard = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<HostDashboardRoute>();
  const [infoModal, setInfoModal] = useState<{ visible: boolean; text?: string }>(
    { visible: false, text: undefined },
  );

  const eventTitle = route.params?.eventTitle ?? 'Host Dashboard';
  const openInfo = (text: string) => setInfoModal({ visible: true, text });
  const closeInfo = () => setInfoModal({ visible: false });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>{eventTitle}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.qrCard}>
          <Image source={{ uri: QR_PLACEHOLDER }} style={styles.qrImage} />
        </View>
        <Text style={styles.scanHint}>Scan with Client Device to Connect.</Text>

        <View style={styles.infoStack}>
          {infoRows.map((row) => (
            <View key={row.id} style={styles.infoRow}>
              <View style={[styles.infoIconWrap, { backgroundColor: row.accent }]}>
                <Image source={row.icon} style={styles.infoIcon} />
              </View>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text
                style={[
                  styles.infoValue,
                  row.valueColor ? { color: row.valueColor } : null,
                ]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actionGrid}>
          {actionRows.map((action) => (
            <View key={action.id} style={styles.actionCard}>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => openInfo(action.info)}
              >
                <Image source={INFO_ICON} style={styles.infoIconButton} />
              </TouchableOpacity>
              <View style={styles.actionIconCircle}>
                <Image source={action.icon} style={styles.actionIcon} />
              </View>
              <Text style={styles.actionLabel}>{action.title}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={infoModal.visible}
        onRequestClose={closeInfo}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>More Info</Text>
            <Text style={styles.modalBody}>{infoModal.text}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={closeInfo}>
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default HostDashboard;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // marginBottom: 15,
    gap: 8,
    marginTop: 15,
    marginBottom: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  qrImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
  },
  scanHint: {
    marginTop: 16,
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: 14,
  },
  infoStack: {
    marginTop: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#b3b3b3',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  infoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: '#FF8A3C',
  },
  infoLabel: {
    flex: 1,
    fontSize: 15,
    color: '#333333',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  actionGrid: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  actionCard: {
    width: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 28,
    backgroundColor: '#FFEDE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
    tintColor: '#FF8A3C',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  infoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
  },
  infoIconButton: {
    width: 15,
    height: 15,
    tintColor: '#FF8A3C',
    resizeMode: 'contain',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  modalBody: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#FF8A3C',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});