import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Alert,
  DeviceEventEmitter,
  useWindowDimensions,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import TcpSocket from 'react-native-tcp-socket';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import QRCode from 'react-native-qrcode-svg';
import { findTicketByQr, updateTicketStatusLocal } from '../../db';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { FontSize } from '../../constants/fontSizes';

type HostDashboardRoute = RouteProp<
  {
    HostDashboard: {
      eventTitle?: string;
      eventId: number;
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
    value: 'Loading...',
    accent: '#FFE8D9',
    icon: require('../../assets/img/eventdashboard/hostip.png'),
  },
  {
    id: 'code',
    label: 'Session Code',
    value: 'Loading...',
    accent: '#E0F7FA',
    icon: require('../../assets/img/common/info.png'), // Using info icon as placeholder
    valueColor: '#006064',
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
    value: '0',
    accent: '#FFE8D9',
    icon: require('../../assets/img/eventdashboard/guests.png'),
    valueColor: '#1B9448',
  },
];

const actionRows = [
  {
    id: 'scan',
    title: 'Scan Ticket',
    icon: require('../../assets/img/common/info.png'),
    info: 'Scan a guest ticket directly from this device.',
  },
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

  // Responsive / Dimension Logic
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 3 : 2;
  const gap = scale(12);
  const horizontalPadding = scale(20);
  // Calculate item width: (totalWidth - padding - (gaps)) / columns
  const itemWidth = (width - (horizontalPadding * 2) - (gap * (numColumns - 1))) / numColumns;

  const [infoModal, setInfoModal] = useState<{ visible: boolean; text?: string }>(
    { visible: false, text: undefined },
  );

  const [server, setServer] = useState<any>(null);
  const [hostIp, setHostIp] = useState<string>('Loading...');
  const [serverPort, setServerPort] = useState<number>(8888);
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<'Starting' | 'Running' | 'Error' | 'Stopped'>('Starting');
  const [sessionCode, setSessionCode] = useState<string>('');

  // Ref to hold connected clients for access inside callbacks
  const connectedClientsRef = useRef<any[]>([]);

  const eventTitle = route.params?.eventTitle ?? 'Host Dashboard';
  const eventId = route.params?.eventId;

  const openInfo = (text: string) => setInfoModal({ visible: true, text });
  const closeInfo = () => setInfoModal({ visible: false });

  const handleAction = (actionId: string) => {
    if (actionId === 'scan') {
      if (!eventId) {
        Alert.alert('Error', 'Event ID missing');
        return;
      }
      navigation.navigate('QrCode', {
        eventTitle,
        eventId,
        isScanningHost: false,
        isClientMode: false,
      });
    } else {
      Alert.alert('Info', 'This feature is coming soon.');
    }
  };

  useEffect(() => {
    // Get Device IP
    NetInfo.fetch().then(state => {
      if (state.details && (state.details as any).ipAddress) {
        setHostIp((state.details as any).ipAddress);
      } else {
        setHostIp('Unknown');
      }
    });

    // Generate Session Code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setSessionCode(code);

    // Start Server
    const newServer = TcpSocket.createServer((socket) => {
      console.log('Client connected:', socket.address());

      // Don't add to connectedClients yet - wait for handshake
      // But we need to listen to data to receive the handshake

      socket.on('data', async (data) => {
        const message = data.toString().trim();
        console.log('Received data:', message);

        // --- HANDSHAKE LOGIC ---
        if (message.startsWith('JOIN_REQUEST:')) {
          const receivedCode = message.split(':')[1];
          if (receivedCode === code) {
            console.log('Client authenticated with correct code');
            socket.write('JOIN_ACCEPT\n');

            // Now add to connected clients list
            if (!connectedClientsRef.current.includes(socket)) {
              connectedClientsRef.current.push(socket);
              setConnectedClients([...connectedClientsRef.current]);
              setClientCount(prev => prev + 1);
            }
          } else {
            console.log('Client failed authentication');
            socket.write('JOIN_REJECT\n');
            // Optional: Close connection immediately or let client handle it
            setTimeout(() => socket.destroy(), 1000);
          }
          return;
        }

        // --- NORMAL DATA LOGIC (Only if authenticated ideally, but for now check if in list) ---
        // For simplicity in this step, we assume if they are sending data they might be authenticated 
        // OR we just process scan data. 
        // Ideally, we should check if socket is in connectedClientsRef.current before processing scan data.

        const isClientAuthenticated = connectedClientsRef.current.includes(socket);
        if (!isClientAuthenticated && !message.startsWith('JOIN_REQUEST')) {
          console.log('Ignored data from unauthenticated client');
          return;
        }

        // Expected format: guest_uuid,event_id,ticketId,multiple_checkInCount
        if (message.includes(',')) {
          const parts = message.split(',');
          const qrGuestUuid = parts[0];

          try {
            const ticket = await findTicketByQr(qrGuestUuid);

            if (ticket) {
              const totalEntries = ticket.total_entries || 1;
              const usedEntries = ticket.used_entries || 0;

              console.log(`[Host] Validating QR: ${qrGuestUuid}. Used: ${usedEntries}, Total: ${totalEntries}`);

              if (usedEntries >= totalEntries) {
                console.log(`[Host] Already scanned. Rejecting.`);
                // Already scanned
                const response = JSON.stringify({
                  status: 'error',
                  message: 'Already Scanned',
                  data: ticket
                });
                socket.write(response + '\n');
              } else {
                // Valid scan
                console.log(`[Host] Valid scan. Updating DB...`);
                await updateTicketStatusLocal(qrGuestUuid, 'checked_in');

                // Notify local UI to refresh
                DeviceEventEmitter.emit('REFRESH_GUEST_LIST');

                // Fetch updated ticket to send back correct used count
                const updatedTicket = await findTicketByQr(qrGuestUuid);
                console.log(`[Host] DB Updated. New Used Count: ${updatedTicket?.used_entries}`);

                const response = JSON.stringify({
                  status: 'success',
                  message: 'Check-in Successful',
                  data: updatedTicket
                });
                socket.write(response + '\n');

                // Update local UI count
                Toast.show({
                  type: 'success',
                  text1: 'Guest Checked In',
                  text2: `${updatedTicket?.guest_name} (${updatedTicket?.used_entries}/${updatedTicket?.total_entries})`
                });

                // ---------------------------------------------------------
                // BROADCAST UPDATE TO ALL CLIENTS
                // ---------------------------------------------------------
                const broadcastMsg = JSON.stringify({
                  type: 'BROADCAST_UPDATE',
                  data: updatedTicket
                });

                console.log(`[Host] Broadcasting update to ${connectedClientsRef.current.length} clients`);
                connectedClientsRef.current.forEach(client => {
                  try {
                    client.write(broadcastMsg + '\n');
                  } catch (e) {
                    console.log("Failed to broadcast to a client", e);
                  }
                });
              }
            } else {
              // Ticket not found
              const response = JSON.stringify({
                status: 'error',
                message: 'Invalid QR Code',
                data: null
              });
              socket.write(response + '\n');
            }
          } catch (err) {
            console.error("Host Validation Error:", err);
            const response = JSON.stringify({
              status: 'error',
              message: 'Server Error',
              data: null
            });
            socket.write(response + '\n');
          }
        }
      });

      socket.on('error', (error) => {
        console.log('Socket error:', error);
      });

      socket.on('close', () => {
        console.log('Client disconnected');
        // Remove from ref
        connectedClientsRef.current = connectedClientsRef.current.filter(c => c !== socket);
        setConnectedClients([...connectedClientsRef.current]);
        setClientCount(prev => connectedClientsRef.current.length);
      });
    }).listen({ port: 0, host: '0.0.0.0' }, () => {
      const address = newServer.address();
      console.log(`Server listening on ${address?.address}:${address?.port}`);
      if (address?.port) {
        setServerPort(address.port);
        setServerStatus('Running');
      }
    });

    newServer.on('error', (error) => {
      console.log('Server error:', error);
      setServerStatus('Error');
      Alert.alert('Server Error', 'Failed to start server. ' + error.message);
    });

    setServer(newServer);

    // Listen for local scans (Host scanning) to broadcast to clients
    const scanSubscription = DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', (ticketData) => {
      console.log('[Host] Broadcasting local scan to clients:', ticketData?.guest_name);

      const broadcastMsg = JSON.stringify({
        type: 'BROADCAST_UPDATE',
        data: ticketData
      });

      connectedClientsRef.current.forEach(client => {
        try {
          client.write(broadcastMsg + '\n');
        } catch (e) {
          console.log("Failed to broadcast local scan", e);
        }
      });
    });

    return () => {
      newServer.close();
      setServerStatus('Stopped');
      scanSubscription.remove();
    };
  }, []);

  // Generate QR Value
  const qrValue = JSON.stringify({
    ip: hostIp,
    port: serverPort
  });

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
          <View style={{ width: scale(40) }} />
        </View>

        <View style={[styles.qrCard, isTablet && { width: '60%', alignSelf: 'center' }]}>
          {hostIp && hostIp !== 'Loading...' && hostIp !== 'Unknown' ? (
            <QRCode
              value={qrValue}
              size={isTablet ? scale(150) : scale(200)}
              color="black"
              backgroundColor="white"
            />
          ) : (
            <Image source={{ uri: QR_PLACEHOLDER }} style={styles.qrImage} />
          )}
        </View>

        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Text style={{
            color: serverStatus === 'Running' ? 'green' : 'red',
            fontWeight: 'bold',
            fontSize: moderateScale(FontSize.sm)
          }}>
            Server Status: {serverStatus} {serverStatus === 'Running' ? `(Port: ${serverPort})` : ''}
          </Text>
        </View>

        <Text style={styles.scanHint}>Scan with Client Device to Connect.</Text>

        <View style={styles.infoStack}>
          {infoRows.map((row) => {
            let displayValue = row.value;
            if (row.id === 'ip') displayValue = `${hostIp}:${serverPort}`;
            if (row.id === 'code') displayValue = sessionCode;
            if (row.id === 'clients') displayValue = clientCount.toString();

            return (
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
                  {displayValue}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={[styles.actionGrid, { gap }]}>
          {actionRows.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionCard, { width: itemWidth }]}
              onPress={() => handleAction(action.id)}
            >
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
            </TouchableOpacity>
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
          <View style={[styles.modalCard, isTablet && { maxWidth: scale(500) }]}>
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
    padding: scale(20),
    paddingBottom: 30, // Fixed
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // marginBottom: 15,
    gap: scale(8),
    marginTop: 15, // Fixed
    marginBottom: 20, // Fixed
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: moderateScale(FontSize.lg),
    fontWeight: '700',
    color: '#1F1F1F',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(28),
    padding: scale(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: scale(10),
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 3,
  },
  qrImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: scale(20),
  },
  scanHint: {
    marginTop: 16, // Fixed
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: moderateScale(FontSize.sm),
  },
  infoStack: {
    marginTop: 20, // Fixed
    gap: 12, // Fixed
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(16),
    marginBottom: 12, // Fixed gap
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: scale(8),
    shadowOffset: { width: 0, height: 2 }, // Fixed shadow
    elevation: 2,
  },
  infoIconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(16),
  },
  infoIcon: {
    width: scale(24),
    height: scale(24),
    resizeMode: 'contain',
  },
  infoLabel: {
    flex: 1,
    fontSize: moderateScale(FontSize.md),
    color: '#1F1F1F',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: moderateScale(FontSize.md),
    color: '#666666',
    fontWeight: '500',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Gap handled dynamically in inline styles
    marginTop: verticalScale(10),
  },
  actionCard: {
    // Width handled dynamically
    backgroundColor: '#FFFFFF',
    borderRadius: scale(24),
    padding: scale(16),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: scale(8),
    shadowOffset: { width: 0, height: 2 }, // Fixed
    elevation: 2,
    position: 'relative',
  },
  actionIconCircle: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12, // Fixed
  },
  actionIcon: {
    width: scale(28),
    height: scale(28),
    resizeMode: 'contain',
    tintColor: '#FF5A5F',
  },
  actionLabel: {
    fontSize: moderateScale(FontSize.md),
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  infoButton: {
    position: 'absolute',
    top: 12, // Fixed
    right: scale(12),
    zIndex: 1,
  },
  infoIconButton: {
    width: scale(20),
    height: scale(20),
    tintColor: '#C0C0C0',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: scale(24),
    padding: scale(24),
    width: '100%',
    maxWidth: scale(320),
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: moderateScale(FontSize.xl),
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: verticalScale(12),
  },
  modalBody: {
    fontSize: moderateScale(FontSize.md),
    color: '#666666',
    textAlign: 'center',
    marginBottom: verticalScale(24),
    lineHeight: verticalScale(22),
  },
  modalButton: {
    backgroundColor: '#FF5A5F',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(32),
    borderRadius: scale(16),
  },
  modalButtonText: {
    color: 'white',
    fontSize: moderateScale(FontSize.md),
    fontWeight: '600',
  },
});