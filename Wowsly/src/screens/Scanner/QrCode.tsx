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
import { initDB, findTicketByQr, updateTicketStatusLocal, getTicketsForEvent, insertOrReplaceGuests } from '../../db'
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
      isClientMode?: boolean   // 👈 ADDED CLIENT MODE FLAG
      isScanningHost?: boolean // 👈 ADDED HOST SCAN FLAG
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
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Animation State
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.6; // Occupy 60% of screen when open
  const SHEET_MIN_HEIGHT = 220; // Visible part when collapsed
  const MAX_UPWARD_TRANSLATE = -(SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT); // Negative value to move up

  const panY = useRef(new Animated.Value(0)).current;
  const localScanHistory = useRef(new Map()).current;

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
  const isClientMode = route.params?.isClientMode ?? false
  const isScanningHost = route.params?.isScanningHost ?? false
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
    setSelectedQuantity(1); // Reset quantity selector

    // 🟡 HOST SCAN MODE
    if (isScanningHost) {
      let hostIp = qrGuestUuid;
      let hostPort = 8888;
      try {
        if (qrGuestUuid.startsWith('{')) {
          const parsed = JSON.parse(qrGuestUuid);
          if (parsed.ip) hostIp = parsed.ip;
          if (parsed.port) hostPort = parsed.port;
        }
      } catch (e) { }

      navigation.navigate('ClientConnection', {
        scannedHostIp: hostIp,
        scannedHostPort: hostPort,
        eventTitle,
        eventId
      });
      setIsVerifying(false);
      return;
    }

    // 🔵 CLIENT MODE (Socket)
    if (isClientMode) {
      // @ts-ignore
      const client = global.clientSocket;
      if (client) {
        const message = `${qrGuestUuid},${eventId},0,0\n`;
        client.write(message);

        const onData = (data: any) => {
          const responseStr = data.toString().trim();
          try {
            const response = JSON.parse(responseStr);
            if (response.status === 'success') {
              const ticket = response.data;
              Toast.show({ type: 'success', text1: 'Host Verified', text2: response.message || 'Valid Entry' });
              setGuestData({
                name: ticket.guest_name || "Guest",
                ticketId: ticket.qr_code || "Remote",
                status: "VALID ENTRY",
                isValid: true,
                totalEntries: ticket.total_entries || 1,
                usedEntries: ticket.used_entries || 1,
                facilities: ticket.facilities ? JSON.parse(ticket.facilities) : []
              });
            } else {
              const ticket = response.data;
              Toast.show({ type: 'error', text1: response.message || 'Error', text2: ticket ? 'Ticket already used' : 'Invalid QR' });
              if (ticket) {
                setGuestData({
                  name: ticket.guest_name || "Guest",
                  ticketId: ticket.qr_code || "Remote",
                  status: response.message.toUpperCase(),
                  isValid: false,
                  totalEntries: ticket.total_entries || 1,
                  usedEntries: ticket.used_entries || 1,
                  facilities: ticket.facilities ? JSON.parse(ticket.facilities) : []
                });
              } else {
                setGuestData(null);
              }
            }
          } catch (e) {
            if (responseStr.includes("count")) {
              Toast.show({ type: 'success', text1: 'Host Verified', text2: responseStr });
              setGuestData({ name: "Host Verified", ticketId: "Remote", status: "VALID ENTRY", isValid: true, totalEntries: 1, usedEntries: 1, facilities: [] });
            } else {
              Toast.show({ type: 'error', text1: 'Host Error', text2: responseStr });
              setGuestData({ name: "Host Rejected", ticketId: "Remote", status: "INVALID", isValid: false, totalEntries: 0, usedEntries: 0, facilities: [] });
            }
          }
          client.removeListener('data', onData);
          setIsVerifying(false);
        };
        client.on('data', onData);
      } else {
        Toast.show({ type: 'error', text1: 'Connection Error', text2: 'Not connected to host' });
        setIsVerifying(false);
      }
      return;
    }

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

            // ⚡⚡⚡ BROADCAST TO CLIENTS (IF HOST) ⚡⚡⚡
            const broadcastData = {
              guest_name: ticket.guest_name || "Guest",
              qr_code: ticket.qr_code || qrGuestUuid,
              total_entries: totalEntries,
              used_entries: usedEntries + 1,
              facilities: facilities
            };
            DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', broadcastData);

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
      // 1. Check Local DB first to prevent double scanning if already scanned offline
      try {
        const localTicket = await findTicketByQr(qrGuestUuid);
        if (localTicket) {
          const localTotal = localTicket.total_entries || 1;
          const localUsed = localTicket.used_entries || 0;

          if (localUsed >= localTotal) {
            console.log("Blocked by local DB: Already scanned offline");
            Toast.show({
              type: 'error',
              text1: 'Already Scanned',
              text2: 'This ticket was already scanned (offline sync pending).'
            });

            // Show the local data state
            setGuestData({
              name: localTicket.guest_name || "Guest",
              ticketId: localTicket.qr_code || "N/A",
              status: "ALREADY SCANNED",
              isValid: false,
              totalEntries: localTotal,
              usedEntries: localUsed,
              facilities: localTicket.facilities ? JSON.parse(localTicket.facilities) : []
            });

            setTimeout(() => setScannedValue(null), 2000);
            setIsVerifying(false);
            return; // STOP HERE
          }
        }
      } catch (localErr) {
        console.warn("Failed to check local DB before online verify:", localErr);
        // Continue to online verify if local check fails (fail open)
      }

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

          // Default values from initial verify response
          const initialTotal = guest.total_entries || guest.total_pax || 1;
          const initialUsed = guest.used_entries || guest.checked_in_count || 0;

          if (detailsResponse?.data) {
            const d = detailsResponse.data;
            const ticketData = d.ticket_data || {};

            // Total tickets bought
            const freshTotal = ticketData.tickets_bought || d.total_entries || 0;
            const totalEntries = freshTotal > 0 ? freshTotal : initialTotal;

            // Used entries (scanned count)
            const freshUsed = d.checked_in_count || d.used_entries || 0;

            // ----------------- LOCAL SESSION HISTORY LOGIC -----------------
            // @ts-ignore
            let previousLocalCount = localScanHistory.get(qrGuestUuid);

            // If not in memory, try to seed from Local DB (handles navigation back/forth)
            if (previousLocalCount === undefined) {
              try {
                const localTicket = await findTicketByQr(qrGuestUuid);
                if (localTicket) {
                  previousLocalCount = localTicket.used_entries || 0;
                }
              } catch (e) { /* ignore */ }
            }
            previousLocalCount = previousLocalCount || 0;

            let calculatedUsed = 0;

            // ⚡⚡⚡ FIX: Always respect local history to prevent reverting bulk scans ⚡⚡⚡
            // We take the maximum of:
            // 1. freshUsed (Server's latest count, might be lagging or caught up)
            // 2. initialUsed (Snapshot from verify, might be stale)
            // 3. previousLocalCount + 1 (Our local knowledge + current scan)
            // This ensures that if we did a bulk scan locally (e.g. +3), we don't revert to 1 just because server is slow.
            calculatedUsed = Math.max(freshUsed, initialUsed, previousLocalCount + 1);

            // Update local history
            // @ts-ignore
            localScanHistory.set(qrGuestUuid, calculatedUsed);

            const usedEntries = calculatedUsed;
            const isValid = usedEntries <= totalEntries;
            const status = isValid ? "VALID ENTRY" : "ALREADY SCANNED";

            // ⚡⚡⚡ SYNC TO LOCAL DB ⚡⚡⚡
            try {
              const guestToSync = {
                qr_code: qrGuestUuid,
                name: d.name || guest.name,
                guest_id: guestId,
                ticket_id: ticketData.ticket_id || guest.ticket_id,
                total_entries: totalEntries,
                used_entries: usedEntries,
                facilities: d.facilities || guest.facilities
              };
              await insertOrReplaceGuests(eventId, [guestToSync]);
              console.log("Synced online scan to local DB:", guestToSync);
            } catch (syncErr) {
              console.warn("Failed to sync online scan to local DB:", syncErr);
            }

            const newGuestData = {
              name: d.name || guest.name || "Guest",
              ticketId: ticketData.ticket_id || guest.ticket_id || "N/A",
              status: status,
              isValid: isValid,
              totalEntries: totalEntries,
              usedEntries: usedEntries,
              facilities: d.facilities || guest.facilities || [],
              guestId: guestId, // Store for bulk check-in
              qrCode: qrGuestUuid // ⚡ Store QR for reliable key
            };

            setGuestData(newGuestData);

            // ⚡⚡⚡ BROADCAST TO CLIENTS (IF HOST) ⚡⚡⚡
            DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', {
              ...newGuestData,
              qr_code: qrGuestUuid, // Ensure qr_code is present
              guest_name: newGuestData.name,
              used_entries: newGuestData.usedEntries,
              total_entries: newGuestData.totalEntries
            });

          } else {
            // Fallback if details fail
            // @ts-ignore
            let previousLocalCount = localScanHistory.get(qrGuestUuid);
            if (previousLocalCount === undefined) {
              try {
                const localTicket = await findTicketByQr(qrGuestUuid);
                if (localTicket) previousLocalCount = localTicket.used_entries || 0;
              } catch (e) { }
            }
            previousLocalCount = previousLocalCount || 0;

            const calculatedUsed = Math.max(initialUsed, previousLocalCount) + 1;
            // @ts-ignore
            localScanHistory.set(qrGuestUuid, calculatedUsed);

            const isValid = calculatedUsed <= initialTotal;

            setGuestData({
              name: guest?.name || "Guest",
              ticketId: guest?.ticket_id || "N/A",
              status: isValid ? "VALID ENTRY" : "ALREADY SCANNED",
              isValid: isValid,
              totalEntries: initialTotal,
              usedEntries: calculatedUsed,
              facilities: guest.facilities || [],
              guestId: guestId,
              qrCode: qrGuestUuid // ⚡ Store QR for reliable key
            })
          }
        } catch (err) {
          console.log("Error fetching details", err);
          // Fallback
          const initialTotal = guest.total_entries || guest.total_pax || 1;
          const initialUsed = guest.used_entries || guest.checked_in_count || 0;

          // @ts-ignore
          let previousLocalCount = localScanHistory.get(qrGuestUuid);
          if (previousLocalCount === undefined) {
            try {
              const localTicket = await findTicketByQr(qrGuestUuid);
              if (localTicket) previousLocalCount = localTicket.used_entries || 0;
            } catch (e) { }
          }
          previousLocalCount = previousLocalCount || 0;

          const calculatedUsed = Math.max(initialUsed, previousLocalCount) + 1;
          // @ts-ignore
          localScanHistory.set(qrGuestUuid, calculatedUsed);

          const isValid = calculatedUsed <= initialTotal;

          setGuestData({
            name: guest?.name || "Guest",
            ticketId: guest?.ticket_id || "N/A",
            status: isValid ? "VALID ENTRY" : "ALREADY SCANNED",
            isValid: isValid,
            totalEntries: initialTotal,
            usedEntries: calculatedUsed,
            facilities: guest.facilities || [],
            guestId: guestId,
            qrCode: qrGuestUuid // ⚡ Store QR for reliable key
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
      setGuestData(null);
      return;
    } finally {
      setIsVerifying(false)
    }
  }

  const handleBulkCheckIn = async () => {
    const additionalCheckins = selectedQuantity - 1;
    const guestId = guestData?.guestId;
    const qrCode = guestData?.qrCode || scannedValue; // Use stored QR or fallback

    if (!guestId || !qrCode) {
      setScannedValue(null);
      setGuestData(null);
      return;
    }

    setIsVerifying(true);
    try {
      // Fire multiple check-ins
      const promises = [];
      for (let i = 0; i < additionalCheckins; i++) {
        promises.push(checkInGuest(eventId, guestId));
      }

      await Promise.all(promises);

      // ⚡⚡⚡ FIX: Use guestData.usedEntries as base for reliability ⚡⚡⚡
      // guestData.usedEntries is the count AFTER the initial scan (e.g. 1)
      // We add additionalCheckins to it (e.g. 1 + 2 = 3)
      const currentUsed = guestData.usedEntries || 0;
      const newUsed = currentUsed + additionalCheckins;

      // Update local history
      // @ts-ignore
      localScanHistory.set(qrCode, newUsed);

      // ⚡⚡⚡ SYNC BULK CHECKIN TO LOCAL DB ⚡⚡⚡
      try {
        const guestToSync = {
          qr_code: qrCode,
          name: guestData.name,
          guest_id: guestData.guestId,
          ticket_id: guestData.ticketId,
          total_entries: guestData.totalEntries,
          used_entries: newUsed,
          facilities: guestData.facilities
        };
        await insertOrReplaceGuests(eventId, [guestToSync]);
        console.log("Synced bulk check-in to local DB:", guestToSync);
      } catch (syncErr) {
        console.warn("Failed to sync bulk check-in:", syncErr);
      }

      Toast.show({
        type: 'success',
        text1: 'Bulk Check-in',
        text2: `Checked in ${selectedQuantity} guests`
      });

    } catch (error) {
      console.error("Bulk check-in error:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to complete bulk check-in'
      });
    } finally {
      setIsVerifying(false);
      setScannedValue(null);
      setGuestData(null);
    }
  };

  // Helper for dynamic stats
  const getDisplayedStats = () => {
    if (!guestData) return { bought: 0, scanned: 0, remaining: 0 };

    const extraSelected = selectedQuantity - 1;
    const currentUsed = guestData.usedEntries + extraSelected;
    const currentRemaining = guestData.totalEntries - currentUsed;

    return {
      bought: guestData.totalEntries,
      scanned: currentUsed,
      remaining: Math.max(0, currentRemaining)
    };
  };

  const stats = getDisplayedStats();

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

              {/* ⚡⚡⚡ CONDITIONAL STATS (DYNAMIC) ⚡⚡⚡ */}
              {guestData && guestData.totalEntries > 1 && (
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Bought</Text>
                    <Text style={styles.statValue}>{stats.bought}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Scanned</Text>
                    <Text style={styles.statValue}>{stats.scanned}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Remaining</Text>
                    <Text style={styles.statValue}>{stats.remaining}</Text>
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

            {/* ⚡⚡⚡ QUANTITY SELECTOR ⚡⚡⚡ */}
            {guestData && guestData.totalEntries > 1 && (guestData.totalEntries - guestData.usedEntries > 0) && (
              <View style={styles.quantityContainer}>
                <Text style={styles.quantityLabel}>Check-in Quantity:</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => {
                      if (selectedQuantity > 1) setSelectedQuantity(q => q - 1);
                    }}
                  >
                    <Text style={styles.qtyButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{selectedQuantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => {
                      const remaining = guestData.totalEntries - guestData.usedEntries;
                      if (selectedQuantity < (remaining + 1)) {
                        setSelectedQuantity(q => q + 1);
                      }
                    }}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isVerifying && styles.primaryButtonDisabled]}
            activeOpacity={0.9}
            disabled={isVerifying}
            onPress={handleBulkCheckIn}
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
  quantityContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  quantityLabel: {
    color: '#9C9C9C',
    fontSize: 12,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  qtyValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
})
