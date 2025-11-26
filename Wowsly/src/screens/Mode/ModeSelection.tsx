import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

type ModeInfo = {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  accent: string;
  accentTint: string;
};

const MODES: ModeInfo[] = [
  {
    id: 'online',
    title: 'Online Mode',
    subtitle: 'Real-time validation against server',
    icon: require('../../assets/img/Mode/onlinemode.png'),
    accent: '#FFF3EB',
    accentTint: '#FF8A3C',
  },
  {
    id: 'offline',
    title: 'Offline Mode',
    subtitle: 'Download guest list to device for no-internet scanning',
    icon: require('../../assets/img/Mode/offlinemode.png'),
    accent: '#FFF3EB',
    accentTint: '#FF8A3C',

  },
  {
    id: 'connection',
    title: 'Connection Mode',
    subtitle: 'Host/Client mode via local Wi-Fi',
    icon: require('../../assets/img/Mode/connectionmode.png'),
    accent: '#FFF3EB',
    accentTint: '#FF8A3C',
  },
];

type ModeSelectionRoute = RouteProp<
  {
    ModeSelection: {
      eventTitle?: string;
      eventId?: string;
    };
  },
  'ModeSelection'
>;

const BACK_ICON = require('../../assets/img/common/back.png');

const ModeSelection = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ModeSelectionRoute>();
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const eventTitle = route.params?.eventTitle ?? 'Selected Event';
  const eventId = route.params?.eventId;

  const handleConnectionPress = () => {
    setRoleModalVisible(true);
  };

  const handleOfflinePress = () => {
    navigation.navigate('OfflineDashboard', { eventTitle, eventId });
  };

  const handleRolePick = (role: 'Host' | 'Client') => {
    setRoleModalVisible(false);
    if (role === 'Host') {
      navigation.navigate('HostDashboard', { eventTitle });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.iconButton}
            onPress={() => navigation.goBack()}
          >
            <Image source={BACK_ICON} style={styles.backIcon} />
          </TouchableOpacity>

          <Text style={styles.title} numberOfLines={1}>
            {eventTitle}
          </Text>

          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconPlaceholderText}>⚙︎</Text>
          </View>
        </View>

        <View style={styles.cardStack}>
          {MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => {
                if (mode.id === 'connection') {
                  handleConnectionPress();
                } else if (mode.id === 'offline') {
                  handleOfflinePress();
                } else if (mode.id === 'online') {
                  navigation.navigate('QrCode', { eventTitle, modeTitle: 'Online Mode' });
                }
              }}
            >
              <View
                style={[
                  styles.modeIconWrapper,
                  { backgroundColor: mode.accent },
                ]}
              >
                <Image
                  source={mode.icon}
                  style={[styles.modeIcon, { tintColor: mode.accentTint }]}
                />
              </View>

              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{mode.title}</Text>
                <Text style={styles.cardSubtitle}>{mode.subtitle}</Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footerNote}>
          Most users choose ‘Online’ when internet is stable.
        </Text>
      </View>

      <Modal
        transparent
        visible={roleModalVisible}
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Continue as</Text>
            <Text style={styles.modalSubtitle}>
              Choose how you want to connect
            </Text>
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleRolePick('Host')}
              >
                <Text style={styles.modalOptionTitle}>Host</Text>
                <Text style={styles.modalOptionSubtitle}>
                  Create a local network and invite check-in devices.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleRolePick('Client')}
              >
                <Text style={styles.modalOptionTitle}>Client</Text>
                <Text style={styles.modalOptionSubtitle}>
                  Join an existing host to sync check-in data.
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setRoleModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ModeSelection;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE8DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 14,
    height: 22,
    resizeMode: 'contain',
    tintColor: '#1F1F1F',
  },
  title: {
    flex: 1,
    marginHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE8DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholderText: {
    fontSize: 18,
    color: '#3B3B3B',
  },
  cardStack: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  modeIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  cardText: {
    flex: 1,
    marginHorizontal: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#807A74',
  },
  chevron: {
    fontSize: 28,
    color: '#B8B1AA',
  },
  footerNote: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 14,
    color: '#A8734A',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7C7C7C',
  },
  modalOptions: {
    gap: 12,
  },
  modalOption: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1E9E1',
    padding: 16,
    backgroundColor: '#FFF9F5',
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  modalOptionSubtitle: {
    fontSize: 13,
    color: '#7C7268',
    lineHeight: 18,
  },
  modalCancel: {
    alignSelf: 'center',
    marginTop: 6,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#FF8A3C',
    fontWeight: '600',
  },
});