import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import { getGuestCount } from '../../db';
import Toast from 'react-native-toast-message';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';

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

const StaggeredItem = ({ children, index, duration = 600 }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(verticalScale(-20))).current;

  useEffect(() => {
    // Reset values immediately on mount to ensure clean state
    fadeAnim.setValue(0);
    translateY.setValue(verticalScale(-20));

    const delay = index * 100; // 100ms delay per item

    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: duration,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [duration, fadeAnim, index, translateY]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
};

const ModeSelection = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ModeSelectionRoute>();

  // Track which mode is currently expanded
  const [expandedMode, setExpandedMode] = useState<string | null>(null);

  if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const eventTitle = route.params?.eventTitle ?? 'Selected Event';
  const eventId = route.params?.eventId;



  const handleModePress = async (modeId: string) => {
    // Use a standard preset or a simpler configuration to avoid conflicts
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (modeId === 'offline') {
      // Offline mode navigates immediately
      try {
        const count = await getGuestCount(Number(eventId));
        Toast.show({
          type: 'info',
          text1: `${count} Guests Downloaded`,
          text2: 'For latest updates, download again inside.',
          position: 'top',
          visibilityTime: 3000,
        });
      } catch (err) {
        console.warn('Failed to fetch guest count:', err);
      }

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
      navigation.navigate('HostDashboard', { eventTitle, eventId });
    } else if (role === 'Client') {
      navigation.navigate('ClientConnection', { eventTitle, eventId });
    }
  };

  const renderSubOptions = (modeId: string) => {
    if (modeId === 'online') {
      return (
        <View style={styles.subOptionsContainer}>
          <StaggeredItem index={0}>
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
          </StaggeredItem>

          <StaggeredItem index={1}>
            <TouchableOpacity
              style={styles.subOptionCard}
              onPress={() => handleOnlineOptionPick('GUEST_LIST')}
            >
              <View style={styles.subOptionIconWrapper}>
                <Image source={GUEST_LIST_ICON} style={styles.subOptionIcon} />
              </View>
              <View style={styles.subOptionText}>
                <Text style={styles.subOptionTitle}>Get Guest List</Text>
                <Text style={styles.subOptionSubtitle}>View all guests</Text>
              </View>
              <Text style={styles.subOptionArrow}>→</Text>
            </TouchableOpacity>
          </StaggeredItem>
        </View>
      );
    } else if (modeId === 'connection') {
      return (
        <View style={styles.subOptionsContainer}>
          <StaggeredItem index={0}>
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
          </StaggeredItem>

          <StaggeredItem index={1}>
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
          </StaggeredItem>
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
    paddingHorizontal: scale(20),
    paddingTop: 30, // Fixed top padding
    paddingBottom: 32, // Fixed bottom padding
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32, // Fixed margin bottom
  },
  title: {
    flex: 1,
    marginHorizontal: scale(16),
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  cardStack: {
    gap: verticalScale(16),
  },
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 3,
    marginBottom: 4, // Fixed Spacing between cards
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: 18, // Fixed padding
  },
  cardExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modeIconWrapper: {
    width: 56, // Fixed size
    height: 56, // Fixed size
    borderRadius: 18, // Fixed radius preferred for icons
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIcon: {
    width: scale(32),
    height: scale(32),
    resizeMode: 'contain',
  },
  cardText: {
    flex: 1,
    marginHorizontal: scale(16),
  },
  cardTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: '#1F1F1F',
  },
  cardSubtitle: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(13),
    color: '#807A74',
    lineHeight: verticalScale(18),
  },
  chevron: {
    fontSize: moderateScale(24),
    color: '#B8B1AA',
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  subOptionsContainer: {
    backgroundColor: '#FAFAFA',
    padding: scale(16),
    gap: verticalScale(12),
  },
  subOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: scale(14),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  subOptionIconWrapper: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(14),
  },
  subOptionEmoji: {
    fontSize: moderateScale(20),
  },
  subOptionIcon: {
    width: scale(22),
    height: scale(22),
    resizeMode: 'contain',
    tintColor: '#FF8A3C',
  },
  subOptionText: {
    flex: 1,
  },
  subOptionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#1F1F1F',
  },
  subOptionSubtitle: {
    fontSize: moderateScale(12),
    color: '#888888',
    marginTop: verticalScale(2),
  },
  subOptionArrow: {
    fontSize: moderateScale(18),
    color: '#FF8A3C',
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: moderateScale(14),
    color: '#A8734A',
  },
});