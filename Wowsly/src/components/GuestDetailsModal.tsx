import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
} from 'react-native';
import { getGuestDetails } from '../api/event';

type GuestDetailsModalProps = {
    visible: boolean;
    onClose: () => void;
    eventId?: string;
    guestId?: string;
    onManualCheckIn?: (guestId: string) => void;
    onMakeManager?: (guestId: string) => void;
};

const CLOSE_ICON = require('../assets/img/common/close.png');

const GuestDetailsModal: React.FC<GuestDetailsModalProps> = ({
    visible,
    onClose,
    eventId,
    guestId,
    onManualCheckIn,
    onMakeManager,
}) => {
    const [loading, setLoading] = useState(false);
    const [guestData, setGuestData] = useState<any>(null);

    useEffect(() => {
        if (visible && eventId && guestId) {
            fetchGuestDetails();
        }
    }, [visible, eventId, guestId]);

    const fetchGuestDetails = async () => {
        setLoading(true);
        setGuestData(null); // Reset data
        console.log('Fetching guest details for:', { eventId, guestId });
        const res = await getGuestDetails(eventId, guestId);
        console.log('Guest details response:', res);
        if (res?.data) {
            setGuestData(res.data);
        } else {
            console.error('Failed to fetch guest details:', res);
        }
        setLoading(false);
    };

    const handleManualCheckIn = () => {
        if (onManualCheckIn && guestId) {
            onManualCheckIn(guestId);
        }
        onClose();
    };

    const handleMakeManager = () => {
        if (onMakeManager && guestId) {
            onMakeManager(guestId);
        }
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Guest details</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#FF8A3C" />
                        </View>
                    ) : guestData ? (
                        <>
                            <View style={styles.detailsContainer}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Name:</Text>
                                    <Text style={styles.value}>
                                        {guestData.name || guestData.first_name + ' ' + guestData.last_name || 'N/A'}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Email:</Text>
                                    <Text style={styles.value}>{guestData.email || 'N/A'}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Contact:</Text>
                                    <Text style={styles.value}>{guestData.phone || guestData.contact || 'N/A'}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Registration Time:</Text>
                                    <Text style={styles.value}>
                                        {guestData.registration_time || guestData.created_at || 'N/A'}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Registered By:</Text>
                                    <Text style={styles.value}>{guestData.registered_by || 'N/A'}</Text>
                                </View>
                            </View>

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={handleManualCheckIn}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.buttonText}>Manual CheckIn</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={handleMakeManager}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.buttonText}>Make Manager</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Failed to load guest details</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default GuestDetailsModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: '100%',
        // maxWidth: 500,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111111',
    },
    closeButton: {
        width: 25,
        height: 25,
        borderRadius: 16,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: 15,
        color: '#666666',
        fontWeight: '600',
        alignSelf: 'center',
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    detailsContainer: {
        gap: 16,
        marginBottom: 24,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666666',
        width: 140,
        flexShrink: 0,
    },
    value: {
        fontSize: 14,
        color: '#111111',
        flex: 1,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#FF8A3C',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        shadowColor: '#FF8A3C',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    errorContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#BE2F2F',
    },
});
