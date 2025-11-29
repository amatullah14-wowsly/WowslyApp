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
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import TcpSocket from 'react-native-tcp-socket';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import QRCode from 'react-native-qrcode-svg';
import { findTicketByQr, updateTicketStatusLocal } from '../../db';

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
    value: 'Loading...',
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
    value: '0',
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

  const [server, setServer] = useState<any>(null);
  const [hostIp, setHostIp] = useState<string>('Loading...');
  const [serverPort, setServerPort] = useState<number>(8888);
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<'Starting' | 'Running' | 'Error' | 'Stopped'>('Starting');

  // Ref to hold connected clients for access inside callbacks
  const connectedClientsRef = useRef<any[]>([]);

  const eventTitle = route.params?.eventTitle ?? 'Host Dashboard';
  const openInfo = (text: string) => setInfoModal({ visible: true, text });
  const closeInfo = () => setInfoModal({ visible: false });

  useEffect(() => {
    // Get Device IP
    NetInfo.fetch().then(state => {
      if (state.details && (state.details as any).ipAddress) {
        setHostIp((state.details as any).ipAddress);
      } else {
        setHostIp('Unknown');
      }
    });

    // Start Server
    const newServer = TcpSocket.createServer((socket) => {
      console.log('Client connected:', socket.address());

      // Add client to list (using Ref for immediate access in callbacks)
      connectedClientsRef.current.push(socket);
      setConnectedClients([...connectedClientsRef.current]);
      setClientCount(prev => prev + 1);

      socket.on('data', async (data) => {
        const message = data.toString();
        console.log('Received data:', message);

        // Handle message logic here
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
        setClientCount(prev => prev - 1);
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

    return () => {
      newServer.close();
      setServerStatus('Stopped');
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
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.qrCard}>
          {hostIp && hostIp !== 'Loading...' && hostIp !== 'Unknown' ? (
            <QRCode
              value={qrValue}
              size={200}
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
            fontWeight: 'bold'
          }}>
            Server Status: {serverStatus} {serverStatus === 'Running' ? `(Port: ${serverPort})` : ''}
          </Text>
        </View>

        <Text style={styles.scanHint}>Scan with Client Device to Connect.</Text>

        <View style={styles.infoStack}>
          {infoRows.map((row) => {
            let displayValue = row.value;
            if (row.id === 'ip') displayValue = `${hostIp}:${serverPort}`;
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
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  infoLabel: {
    flex: 1,
    fontSize: 16,
    color: '#1F1F1F',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: 'relative',
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    tintColor: '#FF5A5F',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  infoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  infoIconButton: {
    width: 20,
    height: 20,
    tintColor: '#C0C0C0',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#FF5A5F',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});