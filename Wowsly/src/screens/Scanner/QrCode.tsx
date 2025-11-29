import React, { useState, useEffect, useRef } from 'react'
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  PermissionsAndroid,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import Toast from 'react-native-toast-message';
import { initDB, findTicketByQr, updateTicketStatusLocal, getTicketsForEvent } from '../../db'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import { Camera } from 'react-native-camera-kit'
import { verifyQRCode, checkInGuest } from '../../api/api'
import { getGuestDetails } from '../../api/event'
import BackButton from '../../components/BackButton'

// --------------- ROUTE TYPE UPDATED ----------------
type QrCodeRoute = RouteProp<
  {
    QrCode: {
      eventTitle?: string
      modeTitle?: string
      eventId: number
      offline?: boolean        // 👈 ADDED OFFLINE FLAG
    }
  },
  'QrCode'
>

// Icons
const OFFLINE_ICON = require('../../assets/img/common/offline.png')
const TORCH_ON_ICON = require('../../assets/img/common/torchon.png')
const TORCH_OFF_ICON = require('../../assets/img/common/torchoff.png')

const QrCode = () => {
  const navigation = useNavigation()
  const route = useRoute<QrCodeRoute>()

  const [flashOn, setFlashOn] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [scannedValue, setScannedValue] = useState<string | null>(null)
  const [guestData, setGuestData] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Animation State
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.6; // Occupy 60% of screen when open
  const SHEET_MIN_HEIGHT = 220; // Visible part when collapsed
  const MAX_UPWARD_TRANSLATE = -(SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT); // Negative value to move up

  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        panY.setOffset((panY as any)._value);
        panY.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dy: panY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        panY.flattenOffset();

        const currentValue = (panY as any)._value;

        if (gestureState.dy < -50 || (gestureState.dy <= 0 && currentValue < MAX_UPWARD_TRANSLATE / 2)) {
          // Slide UP (Open)
          Animated.spring(panY, {
            toValue: MAX_UPWARD_TRANSLATE,
            useNativeDriver: false,
            bounciness: 4
          }).start();
        } else {
          // Slide DOWN (Close)
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4
          }).start();
        }
      }
    })
  ).current;

  const translateY = panY.interpolate({
    inputRange: [MAX_UPWARD_TRANSLATE - 50, 0],
    outputRange: [MAX_UPWARD_TRANSLATE - 50, 0],
    extrapolate: 'clamp'
  });

  const modeTitle = route.params?.modeTitle ?? 'Offline Mode'
  const eventTitle = route.params?.eventTitle ?? 'Untitled Event'

  // ⭐⭐⭐ DYNAMIC EVENT ID ⭐⭐⭐
  const eventId = route.params?.eventId ?? 0

  useEffect(() => {
    if (!eventId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid Event ID passed to QR scanner'
      });
    }
  }, [eventId])

  useEffect(() => {
    const requestCameraPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission',
              message: 'App needs access to your camera to scan QR codes.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          )
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            setHasPermission(true)
          } else {
            Toast.show({
              type: 'error',
              text1: 'Permission Denied',
              text2: 'Camera permission is required to scan QR codes.'
            });
          }
        } catch (err) {
          console.warn(err)
        }
      } else {
        setHasPermission(true)
      }
    }

    requestCameraPermission()
  }, [])

  // ----------------- QR SCAN HANDLER -----------------
  const onReadCode = (event: any) => {
    const rawCode = event.nativeEvent.codeStringValue
    if (!rawCode) return

    const code = rawCode.trim()
    if (code === scannedValue) return // avoid duplicate scans

    setScannedValue(code)
    handleVerifyQR(code)
  }

  // ----------------- OFFLINE DATA STATE -----------------
  const isOfflineMode = route.params?.offline ?? false
  const [offlineGuests, setOfflineGuests] = useState<any[]>([])

  useEffect(() => {
    if (isOfflineMode && eventId) {
      loadOfflineData()
    }
  }, [isOfflineMode, eventId])

  const loadOfflineData = async () => {
    try {
      await initDB()
      const tickets = await getTicketsForEvent(eventId)
      if (tickets && tickets.length > 0) {
        setOfflineGuests(tickets)
        console.log(`Loaded ${tickets.length} guests from database for offline scanning`)
      }
    } catch (error) {
      console.error("Error loading offline guests:", error)
    }
  }

  // ----------------- VERIFY QR FUNCTION -----------------
  const handleVerifyQR = async (qrGuestUuid: string) => {
    setIsVerifying(true)

    // 🔴 OFFLINE VERIFICATION (SQLite)
    if (isOfflineMode) {
      console.log("Verifying offline with SQLite:", qrGuestUuid)

      try {
        const ticket = await findTicketByQr(qrGuestUuid)

        if (ticket) {
          // Prioritize tickets_bought if available (it was saved as total_entries in DB)
          const totalEntries = ticket.total_entries || 1;
          const usedEntries = ticket.used_entries || 0;
          const facilities = ticket.facilities ? JSON.parse(ticket.facilities) : [];

          if (usedEntries >= totalEntries) {
            Toast.show({
              type: 'error',
              text1: 'Already Scanned',
              text2: 'This ticket has already been used.'
            });
            setGuestData({
              name: ticket.guest_name || "Guest",
              ticketId: ticket.qr_code || "N/A",
              status: "ALREADY SCANNED",
              isValid: false,
              totalEntries,
              usedEntries,
              facilities
            })
            // Reset scan after delay
            setTimeout(() => setScannedValue(null), 2000);
          } else {
            // Mark as checked-in in local database (increment used_entries)
            await updateTicketStatusLocal(qrGuestUuid, 'checked_in')

            setGuestData({
              name: ticket.guest_name || "Guest",
              ticketId: ticket.qr_code || "N/A",
              status: "VALID ENTRY (OFFLINE)",
              isValid: true,
              totalEntries,
              usedEntries: usedEntries + 1, // Increment for display
              facilities
            })
          }

        } else {
          Toast.show({
            type: 'error',
            text1: 'Invalid QR Code',
            text2: 'Guest not found in offline database'
          });
          // Reset scan after delay to allow reading toast
          setTimeout(() => setScannedValue(null), 2000);
          setGuestData(null)
        }
      } catch (error) {
        console.error("Offline verification error:", error)
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to verify ticket'
        });
        setTimeout(() => setScannedValue(null), 2000);
        setGuestData(null)
      } finally {
        setIsVerifying(false)
      }
      return
    }

    // 🟢 ONLINE VERIFICATION (API)
    try {
      const response = await verifyQRCode(eventId, qrGuestUuid)
      console.log("QR Verification Response:", response)

      if (response?.message === "QR code verified") {
        const guest = response?.guest_data?.[0] || {}
        const guestId = guest.id || guest.guest_id;

        // Call check-in API to update guest status
        try {
          const checkInResponse = await checkInGuest(eventId, guestId)
          console.log("Check-in Response:", checkInResponse)
        } catch (checkInError) {
          console.warn("Check-in API failed, but QR is valid:", checkInError)
        }

        // Fetch detailed guest info for the UI
        try {
          const detailsResponse = await getGuestDetails(eventId, guestId);
          if (detailsResponse?.data) {
            const d = detailsResponse.data;
            const ticketData = d.ticket_data || {};

            // Total tickets bought
            const totalEntries = ticketData.tickets_bought || guest.total_entries || guest.total_pax || 1;

            // Used entries (scanned count)
            // We use the count from verify response (which is likely pre-checkin) and add 1 for the current scan
            const preScanUsed = guest.used_entries || guest.checked_in_count || 0;
            const usedEntries = preScanUsed + 1;

            setGuestData({
              name: d.name || guest.name || "Guest",
              ticketId: ticketData.ticket_id || guest.ticket_id || "N/A",
              status: "VALID ENTRY",
              isValid: true,
              totalEntries: totalEntries,
              usedEntries: usedEntries,
              facilities: d.facilities || guest.facilities || []
            })
          } else {
            // Fallback if details fail
            const totalEntries = guest.total_entries || guest.total_pax || 1;
            const usedEntries = (guest.used_entries || guest.checked_in_count || 0) + 1;
            setGuestData({
              name: guest?.name || "Guest",
              ticketId: guest?.ticket_id || "N/A",
              status: "VALID ENTRY",
              isValid: true,
              totalEntries,
              usedEntries,
              facilities: guest.facilities || []
            })
          }
        } catch (err) {
          console.log("Error fetching details", err);
          // Fallback
          const totalEntries = guest.total_entries || guest.total_pax || 1;
          const usedEntries = (guest.used_entries || guest.checked_in_count || 0) + 1;
          setGuestData({
            name: guest?.name || "Guest",
            ticketId: guest?.ticket_id || "N/A",
            status: "VALID ENTRY",
            isValid: true,
            totalEntries,
            usedEntries,
            facilities: guest.facilities || []
          })
        }

      } else {
        Toast.show({
          type: 'error',
          text1: 'Invalid QR Code',
          text2: response?.message || "QR verification failed"
        });
        setTimeout(() => setScannedValue(null), 2000);
        setGuestData(null)
      }
    } catch (error) {
      console.error("QR Verification Error:", error)
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to verify QR code'
      });
      setTimeout(() => setScannedValue(null), 2000);
      setGuestData(null)
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {hasPermission && (
          <View style={StyleSheet.absoluteFill}>
            <Camera
              style={{ flex: 1 }}
              scanBarcode={true}
              onReadCode={onReadCode}
              showFrame={false}
              laserColor="transparent"
              frameColor="transparent"
              torchMode={flashOn ? 'on' : 'off'}
            />
          </View>
        )}

        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.modeRow}>
              <Image source={OFFLINE_ICON} style={styles.modeIcon} />
              <View>
                <Text style={styles.modeTitle}>{modeTitle}</Text>
                <Text style={styles.eventName}>{eventTitle}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.flashButton, flashOn && styles.flashButtonActive]}
            activeOpacity={0.8}
            onPress={() => setFlashOn(!flashOn)}
          >
            <Image
              source={flashOn ? TORCH_ON_ICON : TORCH_OFF_ICON}
              style={styles.flashIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.scannerWrapper}>
          <View style={styles.dashedBox}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text style={styles.scanHint}>Place QR code inside the frame</Text>
        </View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: SHEET_MAX_HEIGHT,
              transform: [{ translateY }],
              bottom: - (SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT) // Push it down initially so only MIN_HEIGHT is visible
            }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.guestRow}>
            <View>
              <Text style={styles.guestName}>
                {isVerifying ? 'Verifying...' : (guestData?.name || 'Scan a QR Code')}
              </Text>
              <Text style={styles.ticketId}>
                Ticket ID: {guestData?.ticketId || '---'}
              </Text>
              {guestData && (
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Bought</Text>
                    <Text style={styles.statValue}>{guestData.totalEntries}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Scanned</Text>
                    <Text style={styles.statValue}>{guestData.usedEntries}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Remaining</Text>
                    <Text style={styles.statValue}>{guestData.totalEntries - guestData.usedEntries}</Text>
                  </View>
                </View>
              )}
            </View>
            {guestData && (
              <View style={[
                styles.statusPill,
                !guestData?.isValid && styles.statusPillInvalid
              ]}>
                <Text style={styles.statusPillText}>
                  {guestData?.status || 'VALID ENTRY'}
                </Text>
              </View>
            )}
          </View>

          {/* ScrollView for content if it gets too long */}
          <View style={{ flex: 1, marginTop: 16 }}>
            {guestData?.facilities && guestData.facilities.length > 0 && (
              <View style={styles.facilitiesContainer}>
                <Text style={styles.facilitiesTitle}>Facilities:</Text>
                <View style={styles.facilitiesList}>
                  {guestData.facilities.map((facility: any, index: number) => (
                    <View key={index} style={styles.facilityBadge}>
                      <Text style={styles.facilityText}>{typeof facility === 'string' ? facility : facility.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isVerifying && styles.primaryButtonDisabled]}
            activeOpacity={0.9}
            disabled={isVerifying}
            onPress={() => {
              setScannedValue(null)
              setGuestData(null)
              // Optional: Close sheet on scan next?
              // Animated.spring(panY, { toValue: 0, useNativeDriver: false }).start();
            }}
          >
            <Text style={styles.primaryButtonText}>
              {isVerifying ? 'Verifying...' : 'Scan Next'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

export default QrCode

// ----------------- STYLES (UNCHANGED) -----------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E110F',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeIcon: {
    width: 36,
    height: 36,
    tintColor: '#FFFFFF',
  },
  modeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  eventName: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 2,
  },
  flashButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  flashIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
  },
  scannerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dashedBox: {
    width: '80%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 12,
    borderColor: '#FF8A3C',
    borderWidth: 5,
  },
  cornerTopLeft: {
    top: -5,
    left: -5,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: -5,
    right: -5,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: -5,
    left: -5,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: -5,
    right: -5,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanHint: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 24,
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
    zIndex: 10,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2A2A',
    marginBottom: 8,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  ticketId: {
    color: '#9C9C9C',
    marginTop: 4,
  },
  statusPill: {
    backgroundColor: '#1FC566',
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusPillInvalid: {
    backgroundColor: '#E74C3C',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#FF8A3C',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  entriesText: {
    color: '#9C9C9C',
    marginTop: 4,
    fontSize: 14,
  },
  facilitiesContainer: {
    marginTop: 8,
  },
  facilitiesTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  facilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  facilityText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 8,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statLabel: {
    color: '#9C9C9C',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
})
