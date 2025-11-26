import React, { useState, useEffect } from 'react'
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import { Camera, CameraType } from 'react-native-camera-kit'

type QrCodeRoute = RouteProp<
  {
    QrCode: {
      eventTitle?: string
      modeTitle?: string
    }
  },
  'QrCode'
>

const OFFLINE_ICON = require('../../assets/img/Mode/offlinemode.png')
const TORCH_ICON = require('../../assets/img/common/info.png')

const QrCode = () => {
  const route = useRoute<QrCodeRoute>()
  const [flashOn, setFlashOn] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [scannedValue, setScannedValue] = useState<string | null>(null)

  const modeTitle = route.params?.modeTitle ?? 'Offline Mode'
  const eventTitle = route.params?.eventTitle ?? 'Untitled Event'

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
            Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes.')
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

  const onReadCode = (event: any) => {
    const code = event.nativeEvent.codeStringValue
    if (code && code !== scannedValue) {
      setScannedValue(code)
      Alert.alert('QR Code Scanned', `Value: ${code}`, [
        { text: 'OK', onPress: () => setScannedValue(null) }
      ])
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
            <Image source={TORCH_ICON} style={styles.flashIcon} resizeMode="contain" />
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
              <Text style={styles.guestName}>Alex Johnson</Text>
              <Text style={styles.ticketId}>Ticket ID: WXYZ-1234</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>VALID ENTRY</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9}>
            <Text style={styles.primaryButtonText}>Scan Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default QrCode

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E110F',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'transparent', // Changed to transparent to show camera
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10, // Ensure it's above camera
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
    zIndex: 10, // Ensure it's above camera
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
    zIndex: 10, // Ensure it's above camera
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
})

