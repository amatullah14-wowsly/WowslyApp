import React, { useState, useEffect } from 'react'
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
} from 'react-native'
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RouteProp, useRoute } from '@react-navigation/native'
import { Camera } from 'react-native-camera-kit'
import { verifyQRCode } from '../../api/api'

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
  const route = useRoute<QrCodeRoute>()

  const [flashOn, setFlashOn] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [scannedValue, setScannedValue] = useState<string | null>(null)
  const [guestData, setGuestData] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)

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
      const savedData = await AsyncStorage.getItem(`offline_guests_${eventId}`)
      if (savedData) {
        setOfflineGuests(JSON.parse(savedData))
      }
    } catch (error) {
      console.error("Error loading offline guests:", error)
    }
  }

  // ----------------- VERIFY QR FUNCTION -----------------
  const handleVerifyQR = async (qrGuestUuid: string) => {
    setIsVerifying(true)

    // 🔴 OFFLINE VERIFICATION
    // 🔴 OFFLINE VERIFICATION
    if (isOfflineMode) {
      console.log("Verifying offline:", qrGuestUuid)

      // Simulate a small delay for UX
      setTimeout(() => {
        const foundGuest = offlineGuests.find((g: any) => g.guest_uuid === qrGuestUuid)

        if (foundGuest) {
          setGuestData({
            name: foundGuest.name || "Guest",
            ticketId: foundGuest.guest_uuid || "N/A", // Using UUID as ticket ID for display
            status: "VALID ENTRY (OFFLINE)",
            isValid: true,
          })
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
        setIsVerifying(false)
      }, 500)
      return
    }

    // 🟢 ONLINE VERIFICATION (API)
    try {
      const response = await verifyQRCode(eventId, qrGuestUuid)
      console.log("QR Verification Response:", response)

      if (response?.message === "QR code verified") {
        const guest = response?.guest_data?.[0] || {}

        setGuestData({
          name: guest?.name || "Guest",
          ticketId: guest?.ticket_id || "N/A",
          status: "VALID ENTRY",
          isValid: true,
        })
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
          <View style={styles.modeRow}>
            <Image source={OFFLINE_ICON} style={styles.modeIcon} />
            <View>
              <Text style={styles.modeTitle}>{modeTitle}</Text>
              <Text style={styles.eventName}>{eventTitle}</Text>
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

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.guestRow}>
            <View>
              <Text style={styles.guestName}>
                {isVerifying ? 'Verifying...' : (guestData?.name || 'Alex Johnson')}
              </Text>
              <Text style={styles.ticketId}>
                Ticket ID: {guestData?.ticketId || 'WXYZ-1234'}
              </Text>
            </View>
            <View style={[
              styles.statusPill,
              !guestData?.isValid && styles.statusPillInvalid
            ]}>
              <Text style={styles.statusPillText}>
                {guestData?.status || 'VALID ENTRY'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isVerifying && styles.primaryButtonDisabled]}
            activeOpacity={0.9}
            disabled={isVerifying}
            onPress={() => {
              setScannedValue(null)
              setGuestData(null)
            }}
          >
            <Text style={styles.primaryButtonText}>
              {isVerifying ? 'Verifying...' : 'Scan Next'}
            </Text>
          </TouchableOpacity>
        </View>
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
})
