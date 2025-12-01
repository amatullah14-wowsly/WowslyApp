import React, { useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    DeviceEventEmitter,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import TcpSocket from 'react-native-tcp-socket';
import BackButton from '../../components/BackButton';
import Toast from 'react-native-toast-message';
import { updateTicketStatusLocal } from '../../db';

const ClientConnection = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const [hostIp, setHostIp] = useState('');
    const [hostPort, setHostPort] = useState(8888);
    const [sessionCode, setSessionCode] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    const eventTitle = route.params?.eventTitle ?? 'Client Mode';
    const eventId = route.params?.eventId;

    // Auto-fill IP if returned from scanner
    React.useEffect(() => {
        if (route.params?.scannedHostIp) {
            setHostIp(route.params.scannedHostIp);
        }
        if (route.params?.scannedHostPort) {
            setHostPort(route.params.scannedHostPort);
        }
    }, [route.params?.scannedHostIp, route.params?.scannedHostPort]);

    const connectToHost = () => {
        if (!hostIp) {
            Alert.alert('Error', 'Please enter Host IP Address');
            return;
        }
        if (!sessionCode || sessionCode.length !== 4) {
            Alert.alert('Error', 'Please enter the 4-digit Session Code');
            return;
        }

        setIsConnecting(true);

        const client = TcpSocket.createConnection({
            port: hostPort,
            host: hostIp,
        }, () => {
            setIsConnecting(false);
            console.log('Connected to host!');
            Toast.show({
                type: 'success',
                text1: 'Connected',
                text2: `Successfully connected to ${hostIp}`,
            });

            // @ts-ignore
            global.clientSocket = client;

            // --- HANDSHAKE: Send Join Request ---
            console.log(`Sending JOIN_REQUEST:${sessionCode}`);
            client.write(`JOIN_REQUEST:${sessionCode}\n`);

            client.on('data', async (data) => {
                const message = data.toString().trim();
                console.log('Client received data:', message);

                // --- HANDSHAKE RESPONSE ---
                if (message === 'JOIN_ACCEPT') {
                    console.log('Handshake successful!');
                    Toast.show({
                        type: 'success',
                        text1: 'Joined Session',
                        text2: 'You are now connected to the host.'
                    });

                    // Only navigate AFTER handshake success
                    navigation.navigate('QrCode', {
                        eventTitle,
                        modeTitle: 'Client Mode',
                        isClientMode: true,
                        eventId: eventId
                    });
                    return;
                } else if (message === 'JOIN_REJECT') {
                    console.log('Handshake failed!');
                    Alert.alert('Connection Failed', 'Invalid Session Code. Please try again.');
                    client.destroy(); // Close connection
                    setIsConnecting(false);
                    return;
                }

                try {
                    // Handle broadcast updates
                    if (message.includes('BROADCAST_UPDATE')) {
                        const lines = message.split('\n');
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.type === 'BROADCAST_UPDATE' && parsed.data) {
                                    console.log("Received Broadcast Update:", parsed.data);
                                    const ticket = parsed.data;
                                    const qrGuestUuid = ticket.qr_code;

                                    // Update local DB
                                    await updateTicketStatusLocal(qrGuestUuid, 'checked_in');

                                    // Notify local UI to refresh
                                    DeviceEventEmitter.emit('REFRESH_GUEST_LIST');

                                    Toast.show({
                                        type: 'info',
                                        text1: 'Update Received',
                                        text2: `Guest ${ticket.guest_name} checked in.`
                                    });
                                }
                            } catch (innerErr) {
                                // Ignore non-json lines
                            }
                        }
                    }
                } catch (e) {
                    console.log('Error parsing client data:', e);
                }
            });

            client.on('error', (error) => {
                setIsConnecting(false);
                console.log('Connection error:', error);
                Alert.alert('Connection Failed', 'Could not connect to host. Check IP and try again.');
            });

            client.on('close', () => {
                console.log('Connection closed');
                Toast.show({
                    type: 'info',
                    text1: 'Disconnected',
                    text2: 'Connection to host closed',
                });
                // @ts-ignore
                global.clientSocket = null;
            });

        });

        client.on('error', (error) => {
            setIsConnecting(false);
            console.log('Connection error:', error);
            Alert.alert('Connection Failed', 'Could not connect to host. Check IP and try again.');
        });
    };

    const handleScanQr = () => {
        navigation.navigate('QrCode', {
            eventTitle,
            modeTitle: 'Scan Host QR',
            isScanningHost: true,
            eventId: eventId // Pass eventId even if not strictly needed for host scan, to keep types happy
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <BackButton onPress={() => navigation.goBack()} />
                    <Text style={styles.headerTitle}>{eventTitle}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <Text style={styles.label}>Enter Host IP Address</Text>
                    <Text style={styles.subLabel}>
                        Enter the IP address displayed on the Host device's dashboard.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 192.168.1.10"
                        placeholderTextColor="#CCCCCC"
                        value={hostIp}
                        onChangeText={setHostIp}
                        keyboardType="numeric"
                        autoCapitalize="none"
                    />

                    <Text style={[styles.label, { marginTop: 20 }]}>Session Code</Text>
                    <Text style={styles.subLabel}>
                        Enter the 4-digit code shown on the Host.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 1234"
                        placeholderTextColor="#CCCCCC"
                        value={sessionCode}
                        onChangeText={setSessionCode}
                        keyboardType="numeric"
                        maxLength={4}
                    />

                    <TouchableOpacity
                        style={styles.scanButton}
                        onPress={handleScanQr}
                        disabled={isConnecting}
                    >
                        <Text style={styles.scanButtonText}>Scan QR Code</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, isConnecting && styles.buttonDisabled]}
                        onPress={connectToHost}
                        disabled={isConnecting}
                    >
                        <Text style={styles.buttonText}>
                            {isConnecting ? 'Connecting...' : 'Connect to Host'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ClientConnection;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        marginTop: 10,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: '#1F1F1F',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: 100,
    },
    label: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F1F1F',
        marginBottom: 8,
        textAlign: 'center',
    },
    subLabel: {
        fontSize: 14,
        color: '#888888',
        marginBottom: 32,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        fontSize: 18,
        color: '#1F1F1F',
        borderWidth: 1,
        borderColor: '#EFEFEF',
        marginBottom: 24,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#FF8A3C',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#FF8A3C',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#FFCCAA',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    scanButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF8A3C',
        marginBottom: 16,
    },
    scanButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF8A3C',
    },
});
