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
import BackButton from '../../components/BackButton';

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

const HOST_ICON = require('../../assets/img/Mode/host.png');
const CLIENT_ICON = require('../../assets/img/Mode/client.png');
const SCANNER_ICON = require('../../assets/img/Mode/scanner.png');
const GUEST_LIST_ICON = require('../../assets/img/eventdashboard/guests.png');

const ModeSelection = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ModeSelectionRoute>();

  // Track which mode is currently expanded
  const [expandedMode, setExpandedMode] = useState<string | null>(null);

  const eventTitle = route.params?.eventTitle ?? 'Selected Event';
  const eventId = route.params?.eventId;

  const handleModePress = (modeId: string) => {
    if (modeId === 'offline') {
      // Offline mode navigates immediately
      navigation.navigate('OfflineDashboard', { eventTitle, eventId });
      setExpandedMode(null);
    } else {
      // Toggle expansion for Online and Connection modes
      setExpandedMode(prev => (prev === modeId ? null : modeId));
    }
  };

  const handleOnlineOptionPick = (option: 'QR_SCAN' | 'GUEST_LIST') => {
    if (option === 'QR_SCAN') {
      navigation.navigate('QrCode', { eventTitle, modeTitle: 'Online Mode', eventId });
    } else if (option === 'GUEST_LIST') {
      navigation.navigate('OnlineGuestList', { eventTitle, eventId });
    }
  };

  const handleRolePick = (role: 'Host' | 'Client') => {
    if (role === 'Host') {
      navigation.navigate('HostDashboard', { eventTitle });
    } else if (role === 'Client') {
      navigation.navigate('ClientConnection', { eventTitle, eventId });
    }
  };

  const renderSubOptions = (modeId: string) => {
    if (modeId === 'online') {
      return (
        <View style={styles.subOptionsContainer}>
          <TouchableOpacity
            style={styles.subOptionCard}
            onPress={() => handleOnlineOptionPick('QR_SCAN')}
          >
            <View style={styles.subOptionIconWrapper}>
              <Image source={SCANNER_ICON} style={styles.subOptionIcon} />
            </View>
            <View style={styles.subOptionText}>
              <Text style={styles.subOptionTitle}>QR Scan</Text>
              <Text style={styles.subOptionSubtitle}>Real-time validation</Text>
            </View>
            <Text style={styles.subOptionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subOptionCard}
            onPress={() => handleOnlineOptionPick('GUEST_LIST')}
          >
            <View style={styles.subOptionIconWrapper}>
              <Image source={GUEST_LIST_ICON} style={styles.subOptionIcon} />
            </View>
            <View style={styles.subOptionText}>
              <Text style={styles.subOptionTitle}>Get Guest List</Text>
              <Text style={styles.subOptionSubtitle}>View invited guests</Text>
            </View>
            <Text style={styles.subOptionArrow}>→</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (modeId === 'connection') {
      return (
        <View style={styles.subOptionsContainer}>
          <TouchableOpacity
            style={styles.subOptionCard}
            onPress={() => handleRolePick('Host')}
          >
            <View style={styles.subOptionIconWrapper}>
              <Image source={HOST_ICON} style={styles.subOptionIcon} />
            </View>
            <View style={styles.subOptionText}>
              <Text style={styles.subOptionTitle}>Host</Text>
              <Text style={styles.subOptionSubtitle}>Create local network</Text>
            </View>
            <Text style={styles.subOptionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subOptionCard}
            onPress={() => handleRolePick('Client')}
          >
            <View style={styles.subOptionIconWrapper}>
              <Image source={CLIENT_ICON} style={styles.subOptionIcon} />
            </View>
            <View style={styles.subOptionText}>
              <Text style={styles.subOptionTitle}>Client</Text>
              <Text style={styles.subOptionSubtitle}>Join existing host</Text>
            </View>
            <Text style={styles.subOptionArrow}>→</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />

          <Text style={styles.title} numberOfLines={1}>
            {eventTitle}
          </Text>

          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconPlaceholderText}>⚙︎</Text>
          </View>
        </View>

        <View style={styles.cardStack}>
          {MODES.map((mode) => {
            const isExpanded = expandedMode === mode.id;
            return (
              <View key={mode.id} style={styles.cardWrapper}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.card, isExpanded && styles.cardExpanded]}
                  onPress={() => handleModePress(mode.id)}
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

                  <Text style={[styles.chevron, isExpanded && styles.chevronRotated]}>
                    ›
                  </Text>
                </TouchableOpacity>

                {isExpanded && renderSubOptions(mode.id)}
              </View>
            );
          })}
        </View>

        <Text style={styles.footerNote}>
          Most users choose ‘Online’ when internet is stable.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ModeSelection;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Slightly off-white for better contrast
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
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 4, // Spacing between cards
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  cardExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modeIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  cardText: {
    flex: 1,
    marginHorizontal: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#807A74',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 24,
    color: '#B8B1AA',
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  subOptionsContainer: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    gap: 12,
  },
  subOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  subOptionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  subOptionEmoji: {
    fontSize: 20,
  },
  subOptionIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: '#FF8A3C',
  },
  subOptionText: {
    flex: 1,
  },
  subOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  subOptionSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  subOptionArrow: {
    fontSize: 18,
    color: '#FF8A3C',
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 14,
    color: '#A8734A',
  },
});