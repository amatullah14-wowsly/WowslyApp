import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  DeviceEventEmitter,
  ScrollView,
} from 'react-native'
import { scale, verticalScale, moderateScale } from '../../utils/scaling';

import { initDB, findTicketByQr, updateTicketStatusLocal, getTicketsForEvent, insertOrReplaceGuests, getFacilitiesForGuest, updateFacilityCheckInLocal, insertFacilityForGuest } from '../../db'
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
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
const WIFI_ICON = require('../../assets/img/common/wifi.png')
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
  const [scanStatus, setScanStatus] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const scanLockRef = useRef<string | null>(null);

  // ⚡⚡⚡ FACILITY LOGIC EXTENSION ⚡⚡⚡
  const [selectedScanningOption, setSelectedScanningOption] = useState<string | number>('check_in');
  const [facilityStatus, setFacilityStatus] = useState<any[]>([]);

  useEffect(() => {
    if (scanStatus) {
      const timer = setTimeout(() => {
        setScanStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [scanStatus]);

  // ⚡⚡⚡ AUTO-SELECT FACILITY EFFECT ⚡⚡⚡
  useEffect(() => {
    if (!guestData) return;

    const used = guestData.usedEntries || 0;
    const total = guestData.totalEntries || 1;

    // Auto-select NEXT available facility when main ticket used
    if (
      used >= total &&
      selectedScanningOption === 'check_in' &&
      guestData.facilities?.length
    ) {
      // Find the first facility that is NOT fully scanned
      const nextFac = guestData.facilities.find((f: any) => {
        const available = f.quantity ?? f.total_scans ?? f.availableScans ?? 1;
        const scanned = f.scanned_count ?? f.checkIn ?? f.used_scans ?? 0;
        return scanned < available;
      });

      if (nextFac) {
        setSelectedScanningOption(nextFac.id);
      }
    }
  }, [guestData]);


  const showStatus = (text: string, type: 'success' | 'error' | 'warning') => {
    setScanStatus({ text, type });
  };

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
          }).start(() => {
            // ⚡⚡⚡ RESET SCANNED VALUE ON CLOSE ⚡⚡⚡
            setScannedValue(null);
            setGuestData(null); // Optional: clear data to be clean
          });
        }
      }
    })
  ).current;

  const translateY = panY.interpolate({
    inputRange: [MAX_UPWARD_TRANSLATE - 50, 0],
    outputRange: [MAX_UPWARD_TRANSLATE - 50, 0],
    extrapolate: 'clamp'
  });

  const openSheet = () => {
    Animated.spring(panY, {
      toValue: MAX_UPWARD_TRANSLATE,
      useNativeDriver: false,
      bounciness: 4
    }).start();
  };

  const closeSheet = () => {
    Animated.spring(panY, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4
    }).start(() => {
      // ⚡⚡⚡ RESET SCANNED VALUE ON CLOSE ⚡⚡⚡
      setScannedValue(null);
      setGuestData(null);
      setScannedValue(null);
      setGuestData(null);
      scanLockRef.current = null;
    });
  };

  const modeTitle = route.params?.modeTitle ?? 'Offline Mode'
  const eventTitle = route.params?.eventTitle ?? 'Untitled Event'

  // ⭐⭐⭐ DYNAMIC EVENT ID ⭐⭐⭐
  const eventId = route.params?.eventId ?? 0

  useEffect(() => {
    if (!eventId) {
      showStatus('Invalid Event ID passed to QR scanner', 'error');
    }
  }, [eventId])

  // ⚡⚡⚡ RESET ON FOCUS ⚡⚡⚡
  useFocusEffect(
    useCallback(() => {
      // Reset state when screen is focused to prevent ghost interactions
      setScannedValue(null);
      setGuestData(null);
      setScanStatus(null);
      setIsVerifying(false);
      closeSheet(); // Ensure UI is closed

      return () => {
        // Optional cleanup on blur
      };
    }, [])
  );

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
            showStatus('Camera permission is required', 'error');
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
    const rawCode = event.nativeEvent.codeStringValue;
    if (!rawCode) return;

    const code = rawCode.trim();

    // 🔐 STRICT LOCK: Prevent re-scanning the same code while it's being processed or open
    // We check both state (scannedValue) and Ref (scanLockRef)
    if (code === scannedValue || code === scanLockRef.current) return;

    console.log("New QR Scan:", code);

    // 🔐 LOCK THIS SCAN IMMEDIATELY
    scanLockRef.current = code;
    setScannedValue(code); // Update state to trigger UI changes if any

    handleVerifyQR(code);
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
    setSelectedScanningOption('check_in'); // Default to main check-in
    setFacilityStatus([]); // Reset facility status

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
              showStatus(response.message || 'Valid Entry', 'success');
              setGuestData({
                name: ticket.guest_name || "Guest",
                ticketId: ticket.qr_code || "Remote",
                status: "VALID ENTRY",
                isValid: true,
                totalEntries: ticket.total_entries || 1,
                usedEntries: ticket.used_entries || 1,
                facilities: ticket.facilities ? JSON.parse(ticket.facilities) : [],
                uuid: ticket.guest_uuid || ticket.uuid
              });
            } else {
              const ticket = response.data;
              showStatus(ticket ? 'Ticket already used' : 'Invalid QR', 'error');
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
              showStatus(responseStr, 'success');
              setGuestData({ name: "Host Verified", ticketId: "Remote", status: "VALID ENTRY", isValid: true, totalEntries: 1, usedEntries: 1, facilities: [], scanToken });
            } else {
              showStatus(responseStr, 'error');
              setGuestData({ name: "Host Rejected", ticketId: "Remote", status: "INVALID", isValid: false, totalEntries: 0, usedEntries: 0, facilities: [] });
            }
          }
          client.removeListener('data', onData);
          setIsVerifying(false);
        };
        client.on('data', onData);
      } else {
        showStatus('Not connected to host', 'error');
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
          // ⚡⚡⚡ STRICT EVENT VALIDATION ⚡⚡⚡
          // Prevent cross-event ticket scanning (offline multi-tenancy fix)
          if (Number(ticket.event_id) !== Number(eventId)) {
            console.log(`OFFLINE SECURITY: Blocked cross-event scan. Ticket Event: ${ticket.event_id}, Current Event: ${eventId}`);
            showStatus('Invalid Ticket (Wrong Event)', 'error');
            setGuestData(null);
            setTimeout(() => setScannedValue(null), 2000);
            return;
          }

          // Prioritize tickets_bought if available (it was saved as total_entries in DB)
          const totalEntries = parseInt(String(ticket.total_entries || 1), 10);
          const usedEntries = parseInt(String(ticket.used_entries || 0), 10);

          let facilities = ticket.facilities ? JSON.parse(ticket.facilities) : [];

          // ⚡⚡⚡ MERGE LOCAL FACILITY COUNTS IF AVAILABLE ⚡⚡⚡
          // The facilities JSON in tickets table is static from download.
          // We need real-time counts from 'facility' table.
          try {
            const dbFacilities = await getFacilitiesForGuest(ticket.qrGuestUuid || ticket.guest_uuid || ticket.qr_code);
            if (dbFacilities.length > 0) {
              // Map static facilities to dynamic counts
              // If facilities array is empty (maybe not saved in tickets json), use dbFacilities
              if (facilities.length === 0) {
                facilities = dbFacilities.map(f => ({
                  id: f.facilityId,
                  name: f.name,
                  quantity: f.availableScans, // or whatever field used in UI
                  scanned_count: f.checkIn // important
                }));
              } else {
                // Merge counts
                facilities = facilities.map((f: any) => {
                  const match = dbFacilities.find(dbF => dbF.facilityId == f.id);
                  if (match) {
                    return {
                      ...f,
                      scanned_count: match.checkIn // Update used count
                    };
                  }
                  return f;
                });
              }
              console.log("DEBUG: Merged offline facilities:", JSON.stringify(facilities));
            }
          } catch (e) {
            console.log("Failed to load dynamic facilities offline", e);
          }

          console.log("DEBUG: Offline Ticket Found:", JSON.stringify(ticket));
          console.log(`DEBUG: total_entries: ${ticket.total_entries}, used_entries: ${ticket.used_entries}`);

          console.log(`DEBUG: total_entries: ${ticket.total_entries}, used_entries: ${ticket.used_entries}`);

          if (usedEntries >= totalEntries) {
            const hasFacilities = facilities && facilities.length > 0;
            if (!hasFacilities) {
              showStatus('Already Scanned', 'warning');
              setGuestData({
                name: ticket.guest_name || "Guest",
                ticketId: ticket.qr_code || "N/A",
                status: "ALREADY SCANNED",
                isValid: false,
                totalEntries,
                usedEntries,
                facilities,
                facilities,
                scanToken: scanLockRef.current,
                uuid: ticket.qrGuestUuid || ticket.guest_uuid || ticket.qr_code
              });
              // Reset scan after delay
              setTimeout(() => setScannedValue(null), 2000);
              return; // Stop execution
            }
            // If has facilities, fall through to allow facility check-in
            console.log("Offline: Main ticket used but facilities exist. Allowing scan.");
          }

          // ⚡⚡⚡ MULTI-ENTRY OR ALREADY USED LOGIC ⚡⚡⚡
          // If already full (but facilities exist), we MUST open sheet, NOT auto check-in main ticket.
          if (totalEntries > 1 || usedEntries >= totalEntries) {
            // DO NOT auto-increment yet. Let the user select quantity.
            setGuestData({
              name: ticket.guest_name || "Guest",
              ticketId: ticket.qr_code || "N/A",
              status: "VALID ENTRY (OFFLINE)",
              isValid: true,
              totalEntries,
              usedEntries, // Show current used count
              facilities,
              guestId: ticket.guest_id || ticket.id,
              qrCode: ticket.qr_code || qrGuestUuid,
              qrCode: ticket.qr_code || qrGuestUuid,
              uuid: ticket.qrGuestUuid || ticket.guest_uuid || ticket.qr_code
            });
            openSheet();
          } else {
            // Single entry AND Not Full
            const hasFacilities = facilities && facilities.length > 0;

            if (hasFacilities) {
              // Open sheet if facilities exist (don't auto check-in main ticket without user seeing it)
              setGuestData({
                name: ticket.guest_name || "Guest",
                ticketId: ticket.qr_code || "N/A",
                status: "VALID ENTRY (OFFLINE)",
                isValid: true,
                totalEntries,
                usedEntries,
                facilities,
                guestId: ticket.guest_id || ticket.id,
                qrCode: ticket.qr_code || qrGuestUuid,
                qrCode: ticket.qr_code || qrGuestUuid,
                uuid: ticket.qrGuestUuid || ticket.guest_uuid || ticket.qr_code
              });
              openSheet();
            } else {
              // Safe to Auto check-in (No facilities, Single Entry)
              await updateTicketStatusLocal(qrGuestUuid, 'checked_in');

              // Broadcast
              const broadcastData = {
                guest_name: ticket.guest_name || "Guest",
                qr_code: ticket.qr_code || qrGuestUuid,
                total_entries: totalEntries,
                used_entries: usedEntries + 1,
                facilities: facilities,
                guest_id: ticket.guest_id || ticket.id
              };
              DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', broadcastData);

              showStatus('Checked In', 'success');
              setGuestData({
                name: ticket.guest_name || "Guest",
                ticketId: ticket.qr_code || "N/A",
                status: "Checked In",
                isValid: true,
                totalEntries,
                usedEntries: usedEntries + 1,
                facilities,
                scanToken: scanLockRef.current,
                uuid: ticket.qrGuestUuid || ticket.guest_uuid || ticket.qr_code
              });
              setTimeout(() => setScannedValue(null), 2000);
            }
          }

        } else {
          showStatus('Invalid QR Code', 'error');
          // Reset scan after delay to allow reading toast
          setTimeout(() => setScannedValue(null), 2000);
          setGuestData(null)
        }
      } catch (error) {
        console.error("Offline verification error:", error)
        showStatus('Failed to verify ticket', 'error');
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

        // ⚡⚡⚡ CAPTURE FACILITY STATUS ⚡⚡⚡
        if (response.facility_availability_status) {
          setFacilityStatus(response.facility_availability_status);
        }

        // 1. Fetch detailed guest info FIRST to check current status
        try {
          const detailsResponse = await getGuestDetails(eventId, guestId);

          // Calculate used entries from verification response
          const checkInData = response?.check_in_data || [];
          const verifiedUsed = checkInData.reduce((acc: number, curr: any) => acc + (curr.check_in_count || 0), 0);

          // Default values
          const initialTotal = guest.tickets_bought || guest.total_entries || guest.total_pax || 1;

          if (detailsResponse?.data) {
            const d = detailsResponse.data;
            const ticketData = d.ticket_data || {};

            // Total tickets bought
            const freshTotal = parseInt(String(ticketData.tickets_bought || d.tickets_bought || d.total_entries || 0), 10);
            // ⚡⚡⚡ FIX: Use MAX of fresh and initial to avoid regression if one API returns 1 ⚡⚡⚡
            const totalEntries = Math.max(freshTotal, parseInt(String(initialTotal), 10));

            // Current used entries (API)
            // Use the max of details response or verification response to be safe
            const detailsUsed = d.checked_in_count || d.used_entries || 0;
            const apiUsed = Math.max(detailsUsed, verifiedUsed);

            // Check local history for recent scans (to handle API lag)
            // @ts-ignore
            const localUsed = localScanHistory.get(qrGuestUuid) || 0;

            // The actual used count is the max of API or Local (in case API hasn't updated yet)
            const currentUsed = Math.max(apiUsed, localUsed);

            console.log("DEBUG: Online Verify Details:", JSON.stringify(d));
            console.log(`DEBUG: Online Verify - Total: ${totalEntries}, API Used: ${apiUsed}, Local Used: ${localUsed}, Max Used: ${currentUsed}`);

            // 2. VALIDATE LIMIT
            if (currentUsed >= totalEntries) {
              const facilitiesSource = d.facilities || guest.facilities;
              const hasFacilities = facilitiesSource && facilitiesSource.length > 0;

              if (!hasFacilities) {
                // 🛑 BLOCKED: Already full and no facilities
                console.log("DEBUG: Ticket is full. Blocking check-in.");
                showStatus('Already Scanned', 'warning');

                // Do NOT open sheet. Just reset scanner.
                setTimeout(() => setScannedValue(null), 2000);
                setIsVerifying(false);
                return;
              }
              console.log("DEBUG: Ticket is full but has facilities. Proceeding.");
            }

            // ✅ VALID: Proceed to check-in
            // ✅ VALID: Proceed to check-in
            const newGuestData = {
              name: d.name || d.guest_name || guest.name || guest.guest_name || "Guest",
              ticketId: guest.ticket_id || d.ticket_id || ticketData.qr_code || guest.qr_code || "Remote",
              actualTicketId: guest.ticket_id || d.ticket_id || 0, // 👈 Store numeric ID
              status: "VALID ENTRY",
              isValid: true,
              totalEntries: totalEntries,
              usedEntries: currentUsed,
              facilities: d.facilities || guest.facilities || [],
              guestId: guestId,
              qrCode: qrGuestUuid,
              qrCode: qrGuestUuid,
              uuid: guest.guest_uuid || guest.uuid || qrGuestUuid
            };
            setGuestData(newGuestData);

            // ⚡⚡⚡ CHECK FULL REDEMPTION (ONLINE) ⚡⚡⚡
            let allFacilitiesFull = true;
            if (newGuestData.facilities && newGuestData.facilities.length > 0) {
              allFacilitiesFull = newGuestData.facilities.every((f: any) => {
                const available = f.quantity ?? f.total_scans ?? f.availableScans ?? 1;
                const scanned = f.scanned_count ?? f.checkIn ?? f.used_scans ?? 0;
                return scanned >= available;
              });
            } else {
              // No facilities means we only care about main ticket logic below
              allFacilitiesFull = true;
            }

            const isMainTicketFull = currentUsed >= totalEntries;

            if (isMainTicketFull && allFacilitiesFull && !isOfflineMode) {
              showStatus('Ticket and all facilities fully redeemed', 'error');
              setTimeout(() => setScannedValue(null), 2000);
              return;
            }

            // ⚡⚡⚡ AUTO CHECK-IN FOR SINGLE TICKET ⚡⚡⚡
            // Only auto-check-in if single-entry AND guest has NO facilities
            const hasFacilities = Array.isArray(newGuestData.facilities) && newGuestData.facilities.length > 0;
            if (totalEntries === 1 && currentUsed < totalEntries && !hasFacilities) {
              // safe to auto-check-in (no facility flow required)
              handleDirectCheckIn(newGuestData, 1);
            } else {
              // open sheet always if facilities exist OR multi-entry OR already used
              openSheet();
              console.log("⚡ FACILITY SHAPE ⚡", JSON.stringify(newGuestData?.facilities, null, 2));
            }
          } // End if (detailsResponse?.data)
        } catch (detailsError) {
          console.warn("Failed to fetch guest details", detailsError);
          showStatus('Failed to fetch guest details', 'error');
        }
      } else {
        showStatus(response?.message === "QR verification failed" ? "Invalid QR Code" : (response?.message || 'Invalid QR Code'), 'error');
        setTimeout(() => setScannedValue(null), 2000);
      }
    } catch (error) {
      console.error("Online verification error:", error);
      showStatus('Invalid QR Code', 'error');
      setTimeout(() => setScannedValue(null), 2000);
    } finally {
      setIsVerifying(false);
    }
  };

  // ⚡⚡⚡ REFACTORED CHECK-IN LOGIC FOR DIRECT CALLS ⚡⚡⚡
  // ⚡⚡⚡ REFACTORED CHECK-IN LOGIC FOR DIRECT CALLS ⚡⚡⚡
  const handleDirectCheckIn = async (data: any, quantity: number) => {
    const checkInCount = quantity;
    const guestId = data?.guestId;
    const qrCode = data?.qrCode;

    if (!guestId || !qrCode) return;

    setIsVerifying(true);
    try {
      // ⚡⚡⚡ OFFLINE MODE DIRECT CHECK-IN ⚡⚡⚡
      if (isOfflineMode) {
        // Just update local DB with increment
        await updateTicketStatusLocal(qrCode, 'checked_in', checkInCount);
        console.log(`Offline Direct Check-in: +${checkInCount} for ${qrCode}`);

        // Update local history
        const newUsed = (data.usedEntries || 0) + checkInCount;
        // @ts-ignore
        localScanHistory.set(qrCode, newUsed);

        // Broadcast
        const broadcastData = {
          guest_name: data.name,
          qr_code: qrCode,
          total_entries: data.totalEntries,
          used_entries: newUsed,
          facilities: data.facilities,
          guest_id: data.guestId
        };
        DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', broadcastData);

        showStatus(`Checked in ${data.name}`, 'success');

        // ⚡⚡⚡ FACILITY-AWARE CLOSING LOGIC ⚡⚡⚡
        // If guest has facilities, DO NOT close sheet. Open it instead.
        if (data.facilities && data.facilities.length > 0) {
          setGuestData({ ...data, usedEntries: newUsed }); // Update local state
          openSheet();
        } else {
          setTimeout(() => {
            setScannedValue(null);
            setGuestData(null);
            setGuestData(null);
            scanLockRef.current = null;
          }, 1500);
        }

        return; // Exit after offline handling
      }

      // ⚡⚡⚡ ONLINE MODE DIRECT CHECK-IN ⚡⚡⚡
      const payload = {
        event_id: parseInt(eventId),
        guest_id: guestId,
        ticket_id: data.actualTicketId || 0,
        check_in_count: checkInCount,
        category_check_in_count: "",
        other_category_check_in_count: 0,
        // Direct check-in is typically MAIN ticket only
        // guest_facility_id: "" 
      };

      const res = await checkInGuest(eventId, payload);
      console.log("DIRECT CHECK-IN RESPONSE:", JSON.stringify(res));

      if (!res?.id && !res?.check_in_time && !res?.success && !res?.status) {
        throw new Error(res?.message || "Check-in failed");
      }

      const newUsed = (data.usedEntries || 0) + checkInCount;

      // Update local history
      // @ts-ignore
      localScanHistory.set(qrCode, newUsed);

      // Sync to local DB
      try {
        const guestToSync = {
          qr_code: qrCode,
          name: data.name,
          guest_id: data.guestId,
          ticket_id: data.ticketId,
          total_entries: data.totalEntries,
          used_entries: newUsed,
          facilities: data.facilities,
          status: 'checked_in'
        };
        await insertOrReplaceGuests(eventId, [guestToSync]);

        // Broadcast
        DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', {
          ...guestToSync,
          guestId: guestToSync.guest_id,
          usedEntries: newUsed,
          totalEntries: data.totalEntries
        });
      } catch (syncErr) {
        console.warn("Failed to sync direct check-in:", syncErr);
      }

      showStatus(`Checked in ${data.name}`, 'success');

      // ⚡⚡⚡ FACILITY-AWARE CLOSING LOGIC (ONLINE) ⚡⚡⚡
      if (data.facilities && data.facilities.length > 0) {
        // Keep open, update state
        setGuestData({ ...data, usedEntries: newUsed, status: 'Checked In' });
        openSheet();
      } else {
        setTimeout(() => {
          setScannedValue(null);
          setGuestData(null);
          setGuestData(null);
          scanLockRef.current = null;
        }, 1500);
      }

    } catch (error) {
      console.error("Direct check-in error:", error);
      showStatus('Check-in failed', 'error');
      setTimeout(() => setScannedValue(null), 2000);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBulkCheckIn = async () => {
    // 🚫 BLOCK ANY CHECK-IN WITHOUT QR SCAN
    // Relaxed check: Allow scannedValue OR guestData.qrCode, and compare case-insensitively
    const activeCode = scannedValue || guestData?.qrCode;
    const currentLock = scanLockRef.current;

    if (!currentLock || !activeCode || currentLock.toLowerCase() !== activeCode.toLowerCase()) {
      console.log(`Scan Lock Mismatch: Lock=${currentLock}, Active=${activeCode}`);
      showStatus("Please scan QR code first", "error");
      return;
    }
    const checkInCount = selectedQuantity;
    const guestId = guestData?.guestId;
    const qrCode = guestData?.qrCode || scannedValue;

    if (!guestId || !qrCode) {
      setScannedValue(null);
      setGuestData(null);
      return;
    }

    // Require QR Scan
    if (!guestData || !guestData.qrCode) {
      showStatus("Scan QR first", "error");
      return;
    }

    // Facility Check-In
    if (selectedScanningOption !== 'check_in') {
      const facilityId = Number(selectedScanningOption);
      // ⚡⚡⚡ USE CORRECT UUID FOR FACILITY LOOKUP ⚡⚡⚡
      const uuid = guestData.uuid || guestData.qrCode;

      if (isOfflineMode) {
        // ⚡⚡⚡ OFFLINE FACILITY CHECK-IN ⚡⚡⚡
        console.log(`DEBUG: Offline Facility Check-In Selected. Option: ${selectedScanningOption}, UUID: ${uuid}, Count: ${checkInCount}`);

        try {
          // Ensure facility row exists locally before updating (fallback for guests saved without facility rows)
          const selectedFacility = guestData.facilities?.find((f: any) => Number(f.id) === facilityId);
          const availableScans = selectedFacility?.quantity ?? selectedFacility?.scan_quantity ?? selectedFacility?.total_scans ?? 1;
          const currentScanned = selectedFacility?.scanned_count ?? 0;

          await insertFacilityForGuest({
            guest_uuid: uuid,
            facilityId,
            name: selectedFacility?.name || `Facility ${facilityId}`,
            availableScans: parseInt(String(availableScans || 1), 10),
            checkIn: parseInt(String(currentScanned || 0), 10),
            eventId: eventId,
            ticket_id: guestData.actualTicketId || guestData.ticketId || 0
          });

          const rowsAffected = await updateFacilityCheckInLocal(uuid, facilityId, checkInCount);

          if (!rowsAffected || rowsAffected === 0) {
            showStatus("Facility check-in failed", "error");
            return;
          }

          // ✅ ONLY NOW show success
          showStatus(`Facility Checked In (Offline)`, 'success');

          // ⚡⚡⚡ UI UPDATE: Update facility state locally ⚡⚡⚡
          if (guestData && guestData.facilities) {
            const updatedFacilities = guestData.facilities.map((f: any) => {
              if (Number(f.id) === facilityId) {
                return { ...f, scanned_count: (f.scanned_count || 0) + checkInCount };
              }
              return f;
            });
            setGuestData({ ...guestData, facilities: updatedFacilities });
          }

          return;
        } catch (err) {
          console.error("Facility check-in failed:", err);
          showStatus('Facility check-in failed', 'error');
          return;
        }
      } else {
        // ⚡⚡⚡ ONLINE FACILITY CHECK-IN ⚡⚡⚡
        console.log(`DEBUG: Online Facility Check-In Selected. Option: ${selectedScanningOption}, Count: ${checkInCount}`);

        try {
          const payload = {
            event_id: parseInt(eventId),
            guest_id: guestId,
            ticket_id: guestData.actualTicketId || 0,
            check_in_count: 1, // Fixed to 1
            category_check_in_count: "",
            other_category_check_in_count: 0,
            guest_facility_id: facilityId // 👈 ID of the facility
          };

          const res = await checkInGuest(eventId, payload);
          console.log("ONLINE FACILITY CHECK-IN RESPONSE:", JSON.stringify(res));

          if (!res?.id && !res?.check_in_time && !res?.success && !res?.status && !res?.message?.includes("uccess")) {
            throw new Error(res?.message || "Facility check-in failed");
          }

          showStatus(`Facility Checked In`, 'success');

          if (guestData && guestData.facilities) {
            const updatedFacilities = guestData.facilities.map((f: any) => {
              if (Number(f.id) === facilityId) {
                const current = f.scanned_count ?? f.checkIn ?? f.used_scans ?? 0;
                const newVal = current + checkInCount;
                return {
                  ...f,
                  scanned_count: newVal,
                  checkIn: newVal,
                  used_scans: newVal
                };
              }
              return f;
            });
            setGuestData({ ...guestData, facilities: updatedFacilities });
          }

          return;

        } catch (err) {
          console.error("Online Facility check-in failed:", err);
          showStatus('Online Facility check-in failed', 'error');
          return;
        }
      }
    }

    console.log(`DEBUG: Main Check-in Fallthrough. Option: ${selectedScanningOption}, Used: ${guestData.usedEntries}, Total: ${guestData.totalEntries}`);
    // ⚡⚡⚡ END FACILITY CHECK LOGIC ⚡⚡⚡

    // ⚡⚡⚡ SAFETY CHECK (MAIN TICKET) ⚡⚡⚡
    const currentUsed = guestData.usedEntries || 0;
    const totalEntries = guestData.totalEntries || 1;

    if (currentUsed + checkInCount > totalEntries) {
      showStatus(`Cannot check in more than ${totalEntries} tickets.`, 'error');
      return;
    }

    setIsVerifying(true);
    try {
      // ⚡⚡⚡ OFFLINE MODE BULK CHECK-IN ⚡⚡⚡
      if (isOfflineMode) {
        // Just update local DB with increment
        // This sets synced = 0 automatically
        await updateTicketStatusLocal(qrCode, 'checked_in', checkInCount);

        console.log(`Offline Bulk Check-in: +${checkInCount} for ${qrCode}`);

        // Update local history for session
        // @ts-ignore
        const currentUsed = localScanHistory.get(qrCode) || guestData.usedEntries || 0;
        // @ts-ignore
        localScanHistory.set(qrCode, currentUsed + checkInCount);

        // Broadcast
        const broadcastData = {
          guest_name: guestData.name,
          qr_code: qrCode,
          total_entries: guestData.totalEntries,
          used_entries: currentUsed + checkInCount,
          facilities: guestData.facilities,
          guest_id: guestData.guestId
        };
        DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', broadcastData);

      } else {
        // ⚡⚡⚡ ONLINE MODE BULK CHECK-IN ⚡⚡⚡
        // Fire single check-in with count

        const payload = {
          event_id: parseInt(eventId),
          guest_id: guestId,
          ticket_id: guestData.actualTicketId || 0, // 👈 Use numeric ID
          check_in_count: checkInCount,
          category_check_in_count: "",
          other_category_check_in_count: 0,
          guest_facility_id: ""
        };

        const res = await checkInGuest(eventId, payload);
        console.log("CHECK-IN RESPONSE:", JSON.stringify(res));

        // ⚡⚡⚡ FIX: Check for 'id' or 'check_in_time' which indicates success ⚡⚡⚡
        if (!res?.id && !res?.check_in_time && !res?.success && !res?.status) {
          throw new Error(res?.message || "Bulk check-in failed");
        }

        // ⚡⚡⚡ FIX: Use guestData.usedEntries as base for reliability ⚡⚡⚡
        const newUsed = (guestData.usedEntries || 0) + checkInCount;

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
            facilities: guestData.facilities,
            status: 'checked_in' // ⚡⚡⚡ EXPLICITLY SET STATUS FOR PERSISTENCE ⚡⚡⚡
          };
          // Online check-in is already synced, so insertOrReplaceGuests (synced=1) is correct
          await insertOrReplaceGuests(eventId, [guestToSync]);
          console.log("Synced bulk check-in to local DB:", guestToSync);

          // ⚡⚡⚡ BROADCAST UPDATE ⚡⚡⚡
          DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', {
            ...guestToSync,
            guestId: guestToSync.guest_id, // Ensure compatibility
            usedEntries: newUsed,
            totalEntries: guestData.totalEntries
          });

        } catch (syncErr) {
          console.warn("Failed to sync bulk check-in:", syncErr);
        }

        // Update local guestData state
        setGuestData({ ...guestData, usedEntries: newUsed, status: 'Checked In' });
      }

      showStatus(`Checked in ${selectedQuantity} guests`, 'success');

      // ⚡⚡⚡ UI UPDATE: Update guestData triggerly so Modal disables buttons ⚡⚡⚡
      if (guestData) {
        const newUsed = (guestData.usedEntries || 0) + selectedQuantity;
        setGuestData({
          ...guestData,
          usedEntries: newUsed,
          // Update status text if full?
          status: newUsed >= guestData.totalEntries ? 'ALREADY SCANNED' : guestData.status
        });
      }

    } catch (error) {
      console.error("Bulk check-in error:", error);
      showStatus('Failed to complete bulk check-in', 'error');
    } finally {
      setIsVerifying(false);

      // ⚡⚡⚡ FACILITY AWARE CLOSE ⚡⚡⚡
      // Requirement: "ek vaar ek guest nu main check in thyu... to scan the next guest"
      // If we just performed a MAIN CHECK-IN, we should close the sheet to allow scanning the next guest.
      // If we performed a FACILITY CHECK-IN, we kept it open (returned early) so we won't reach here? 
      // ACTUALLY: The return statements in facility logic prevent reaching here.
      // So if we are here, it means we did a MAIN check-in (or it failed/returned early).
      // Wait, let's verify flow. Facility logic has 'return;' inside 'if(selectedScanningOption !== 'check_in')'.
      // So this finally block runs:
      // 1. If facility check-in throws error (catch -> finally)
      // 2. If Main check-in completes (success -> finally)

      // So for Main Check-in success, we want to CLOSE even if facilities exist.

      if (selectedScanningOption === 'check_in') {
        // Auto-close for main check-in to allow next scan
        setTimeout(() => {
          setScannedValue(null);
          setGuestData(null);
          scanLockRef.current = null;
          closeSheet();
        }, 1500);
      } else {
        // Should not interfere with facility logic if it returned early, 
        // but if it errored, we might want to keep it open?
        // If facility logic errored, we want to retry facility.
        // If facility logic success, we returned early, so this finally block WONT run?
        // WRONG: finally always runs.
        // But wait, if facility logic has 'return', does finally run? YES.

        // If facility logic returns, finally RUNS.
        // In facility logic (Step 65/69), currently:
        // ... showStatus('Facility Checked In') ... return;

        // So if I put close logic here, it will close after facility check-in too!
        // I must check `selectedScanningOption`.

        // If selectedScanningOption !== 'check_in' (Facility), we generally want to KEEP OPEN.
        // So we do NOTHING here for facilities (let them stay open).
      }

      // Existing logic was:
      // if (guestData && guestData.facilities ...) { keep open } else { close }

      // New Logic: 
      // If Main Check-in -> Close (regardless of facilities)
      // If Facility Check-in -> Keep Open (handled by doing nothing, or explicit keep open ?)
      // Actually, if I remove the 'closeSheet()' call for facilities, it stays open.

    }
  };

  // Helper for dynamic stats
  const isMainTicketCheckedIn =
    !!guestData &&
    selectedScanningOption === 'check_in' &&
    (guestData.usedEntries || 0) >= (guestData.totalEntries || 1);


  const getDisplayedStats = () => {
    if (!guestData) return { bought: 0, scanned: 0, remaining: 0 };

    // Only add selectedQuantity if it's a multi-entry ticket AND valid for check-in
    // For single entry, it auto-checks in, so we don't add the projection.
    const isMultiEntry = guestData.totalEntries > 1;
    const quantityToAdd = (isMultiEntry && guestData.isValid) ? selectedQuantity : 0;

    const currentUsed = (guestData.usedEntries || 0) + quantityToAdd;
    const currentRemaining = (guestData.totalEntries || 1) - currentUsed;

    return {
      bought: guestData.totalEntries || 1,
      scanned: currentUsed,
      remaining: Math.max(0, currentRemaining)
    };
  };

  const stats = getDisplayedStats();
  const hasFacilities = Array.isArray(guestData?.facilities) && guestData.facilities.length > 0;
  const showQuantitySelector = !!guestData && !hasFacilities && (guestData.totalEntries || 1) > 1;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 30 }}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.modeRow}>
              <Image
                source={modeTitle === 'Online Mode' ? WIFI_ICON : OFFLINE_ICON}
                style={styles.modeIcon}
              />
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

        {/* ⚡⚡⚡ ON-SCREEN STATUS BANNER ⚡⚡⚡ */}
        {scanStatus && (
          <View style={[
            styles.statusBanner,
            scanStatus.type === 'success' && styles.statusBannerSuccess,
            scanStatus.type === 'error' && styles.statusBannerError,
            scanStatus.type === 'warning' && styles.statusBannerWarning,
          ]}>
            <View style={styles.statusIconWrapper}>
              <Text style={styles.statusIconText}>
                {scanStatus.type === 'success' ? '✓' : scanStatus.type === 'error' ? '✕' : '!'}
              </Text>
            </View>
            <Text style={styles.statusBannerText}>{scanStatus.text}</Text>
          </View>
        )}

        <View style={styles.scannerWrapper}>
          <View style={styles.dashedBox}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text style={styles.scanHint}>Place QR code inside the frame</Text>
        </View>

        {guestData && (
          console.log("DEBUG: Rendering Sheet with guestData:", JSON.stringify(guestData)) ||
          <Animated.View
            style={[
              styles.sheet,
              {
                height: SHEET_MAX_HEIGHT,
                transform: [{ translateY }],
                bottom: - (SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT) // Push it down initially so only MIN_HEIGHT is visible
              }
            ]}
          >
            {/* ⚡⚡⚡ DRAG HANDLE AREA ONLY ⚡⚡⚡ */}
            <View {...panResponder.panHandlers}>
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
                  {guestData && (
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
            </View>

            {/* ScrollView for content if it gets too long */}
            <ScrollView

              style={{ flex: 1, marginTop: 16 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
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
              {/* ⚡⚡⚡ SELECT SCANNING OPTION (Wrapped) ⚡⚡⚡ */}
              <View style={styles.scanningOptionsContainer}>
                <Text style={styles.scanningForTitle}>Scanning for</Text>

                <View style={styles.radioGroup}>
                  {/* CHECK-IN RADIO */}
                  {(() => {
                    // Main Check-in Status Calculation
                    const total = guestData?.totalEntries || 1;
                    const used = guestData?.usedEntries || 0;
                    // ⚡⚡⚡ UPDATED: Disable if checked in ONCE ⚡⚡⚡
                    const isFullyCheckedIn = used > 0;

                    return (
                      <TouchableOpacity
                        style={styles.radioItem}
                        onPress={() => !isFullyCheckedIn && setSelectedScanningOption('check_in')}
                        activeOpacity={isFullyCheckedIn ? 1 : 0.7}
                      >
                        <View style={[styles.radioOuter, { borderColor: isFullyCheckedIn ? '#555' : '#FF8A3C' }]}>
                          {selectedScanningOption === 'check_in' && <View style={[styles.radioInner, { backgroundColor: isFullyCheckedIn ? '#555' : '#FF8A3C' }]} />}
                        </View>
                        <Text style={[styles.radioLabel, isFullyCheckedIn && styles.disabledText]}>Check-In</Text>
                      </TouchableOpacity>
                    );
                  })()}

                  {/* FACILITIES RADIOS */}
                  {guestData?.facilities && guestData.facilities.map((fac: any) => {
                    const isMainCheckedIn = (guestData?.usedEntries || 0) > 0;
                    let facilityDisabled = !isMainCheckedIn;

                    // Optimistic Status Check & Local Data Check combined
                    if (!facilityDisabled) {
                      const available = fac.quantity ?? fac.total_scans ?? fac.availableScans ?? 1;
                      const scanned = fac.scanned_count ?? fac.checkIn ?? fac.used_scans ?? 0;

                      // Global status check (from API or other signal)
                      if (facilityStatus.length > 0) {
                        const status = facilityStatus.find((s: any) => String(s.id) === String(fac.id));
                        if (status && status.available_scans <= 0) {
                          facilityDisabled = true;
                        }
                      }

                      // Count check
                      if (scanned >= available) {
                        facilityDisabled = true;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={fac.id || fac.name}
                        style={styles.radioItem}
                        onPress={() => !facilityDisabled && setSelectedScanningOption(fac.id)}
                        activeOpacity={facilityDisabled ? 1 : 0.7}
                      >
                        <View style={[styles.radioOuter, { borderColor: facilityDisabled ? '#555' : '#FF8A3C' }]}>
                          {selectedScanningOption === fac.id && <View style={[styles.radioInner, { backgroundColor: facilityDisabled ? '#555' : '#FF8A3C' }]} />}
                        </View>
                        <Text style={[styles.radioLabel, facilityDisabled && styles.disabledText]}>{fac.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ⚡⚡⚡ QUANTITY SELECTOR (only when no facilities and multi-entry) ⚡⚡⚡ */}
              {showQuantitySelector && (
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
                        if (selectedQuantity < remaining) {
                          const newQty = selectedQuantity + 1;
                          setSelectedQuantity(newQty);

                          // ⚡⚡⚡ AUTO-SUBMIT IF MAX REACHED ⚡⚡⚡
                          if (newQty === remaining) {
                            handleDirectCheckIn(guestData, newQty);
                          }
                        } else {
                          showStatus(`Limit Reached: Max ${guestData.totalEntries} tickets`, 'warning');
                        }
                      }}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {(() => {
              // ⚡⚡⚡ DYNAMIC BUTTON DISABLED STATE ⚡⚡⚡
              let isSelectionDisabled = false;
              let buttonText = 'Check In';

              // 1. GLOBAL FULL CHECK
              const isMainFull = (guestData.usedEntries || 0) >= (guestData.totalEntries || 1);
              let areAllFacilitiesFull = true;
              if (guestData.facilities && guestData.facilities.length > 0) {
                areAllFacilitiesFull = guestData.facilities.every((f: any) => {
                  const avail = f.quantity ?? f.total_scans ?? f.availableScans ?? 1;
                  const used = f.scanned_count ?? f.checkIn ?? f.used_scans ?? 0;
                  return used >= avail;
                });
              } else {
                areAllFacilitiesFull = true; // No facilities means "all full" logic depends only on main
              }

              if (isMainFull && areAllFacilitiesFull) {
                isSelectionDisabled = true;
                buttonText = 'Fully Checked In';
              } else if (isVerifying) {
                isSelectionDisabled = true;
                buttonText = 'Verifying...';
              } else if (selectedScanningOption === 'check_in') {
                // Main Ticket Logic
                if (isMainFull) {
                  isSelectionDisabled = true;
                  buttonText = 'Already Checked In';
                }
              } else {
                // Facility Logic
                const facId = Number(selectedScanningOption);
                const fac = guestData.facilities?.find((f: any) => f.id === facId);
                if (fac) {
                  const available = fac.quantity ?? fac.total_scans ?? fac.availableScans ?? 1;
                  const scanned = fac.scanned_count ?? fac.checkIn ?? fac.used_scans ?? 0;
                  if (scanned >= available) {
                    isSelectionDisabled = true;
                    buttonText = `${fac.name} Checked In`;
                  }
                }
              }

              return (
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isSelectionDisabled && styles.primaryButtonDisabled
                  ]}
                  activeOpacity={0.9}
                  disabled={isSelectionDisabled}
                  onPress={handleBulkCheckIn}
                >
                  <Text style={styles.primaryButtonText}>
                    {buttonText}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </Animated.View>
        )
        }
      </View >
    </SafeAreaView >
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
    fontSize: moderateScale(12),
    marginTop: verticalScale(2),
  },
  flashButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
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
    width: scale(20),
    height: scale(20),
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
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    borderColor: '#FF8A3C',
    borderWidth: 5,
  },
  cornerTopLeft: {
    top: verticalScale(-5),
    left: scale(-5),
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: verticalScale(-5),
    right: scale(-5),
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: verticalScale(-5),
    left: scale(-5),
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: verticalScale(-5),
    right: scale(-5),
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanHint: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    marginTop: verticalScale(24),
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: scale(32),
    borderTopRightRadius: scale(32),
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(32),
    gap: verticalScale(16),
    zIndex: 10,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: scale(60),
    height: verticalScale(4),
    borderRadius: scale(2),
    backgroundColor: '#2A2A2A',
    marginBottom: verticalScale(8),
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestName: {
    color: '#FFFFFF',
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  ticketId: {
    color: '#9C9C9C',
    marginTop: verticalScale(4),
  },
  statusPill: {
    backgroundColor: '#1FC566',
    borderRadius: scale(20),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    marginLeft: scale(10),
    maxWidth: scale(120), // Prevent overflow
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPillInvalid: {
    backgroundColor: '#E74C3C',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: moderateScale(10), // Slightly smaller text
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: verticalScale(8),
    backgroundColor: '#FF8A3C',
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
  },
  primaryButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  entriesText: {
    color: '#9C9C9C',
    marginTop: verticalScale(4),
    fontSize: moderateScale(14),
  },
  facilitiesContainer: {
    marginTop: verticalScale(8),
  },
  facilitiesTitle: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
    marginBottom: verticalScale(8),
  },
  facilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  facilityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
  },
  facilityText: {
    color: '#FFFFFF',
    fontSize: moderateScale(12),
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scale(12),
    padding: scale(8),
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: scale(12),
  },
  statLabel: {
    color: '#9C9C9C',
    fontSize: moderateScale(10),
    textTransform: 'uppercase',
    marginBottom: verticalScale(2),
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: verticalScale(24),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quantityContainer: {
    marginTop: verticalScale(16),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: scale(12),
    padding: scale(12),
  },
  quantityLabel: {
    color: '#9C9C9C',
    fontSize: moderateScale(12),
    marginBottom: verticalScale(8),
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(24),
    fontWeight: '700',
    lineHeight: moderateScale(28),
  },
  qtyValue: {
    color: '#FFFFFF',
    fontSize: moderateScale(24),
    fontWeight: '700',
  },
  statusBanner: {
    position: 'absolute',
    top: verticalScale(120),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(24),
    borderRadius: scale(30),
    zIndex: 999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.3,
    shadowRadius: scale(6),
    maxWidth: '90%',
  },
  statusBannerSuccess: {
    backgroundColor: '#4CAF50',
  },
  statusBannerError: {
    backgroundColor: '#F44336',
  },
  statusBannerWarning: {
    backgroundColor: '#FFC107',
  },
  statusBannerText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: moderateScale(20),
    flex: 1,
    flexWrap: 'wrap',
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusIconWrapper: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '900',
  },
  // ⚡⚡⚡ NEW STYLES FOR FACILITY UI ⚡⚡⚡
  scanningOptionsContainer: {
    marginTop: verticalScale(16),
  },
  scanningForTitle: {
    color: '#9C9C9C',
    fontSize: moderateScale(12),
    marginBottom: verticalScale(10),
    textTransform: 'uppercase'
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(16),
    marginBottom: verticalScale(10)
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(10),
    marginRight: scale(10)
  },
  radioOuter: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: '#FF8A3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(8)
  },
  radioInner: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: '#FF8A3C'
  },
  radioLabel: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '600'
  },
  disabledText: {
    color: '#555'
  }
})
