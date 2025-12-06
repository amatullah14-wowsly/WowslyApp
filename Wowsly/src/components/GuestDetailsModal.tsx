import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { getGuestDetails } from '../api/event';

type GuestDetailsModalProps = {
    visible: boolean;
    onClose: () => void;
    eventId?: string;
    guestId?: string;
    onManualCheckIn?: (guestId: string) => void;
    onMakeManager?: (guestId: string) => void;
    onMakeGuest?: (guestId: string) => void;
    guest?: any;
    offline?: boolean;
};

const GuestDetailsModal: React.FC<GuestDetailsModalProps> = ({
    visible,
    onClose,
    eventId,
    guestId,
    onManualCheckIn,
    onMakeManager,
    onMakeGuest,
    guest,
    offline = false,
}) => {
    const [loading, setLoading] = useState(false);
    const [guestData, setGuestData] = useState<any>(null);

    /* ---------------------- Fetch API details ---------------------- */
    useEffect(() => {
        if (visible && eventId && guestId && !offline) {
            fetchGuestDetails();
        }
    }, [visible, eventId, guestId, offline]);

    /* ---------------------- Merge list guest → modal guest ---------------------- */
    useEffect(() => {
        if (guest) {
            setGuestData(prev => ({ ...prev, ...guest }));
        }
    }, [guest]);

    const fetchGuestDetails = async () => {
        setLoading(true);
        const res = await getGuestDetails(eventId, guestId);

        if (res?.data) {
            setGuestData(prev => ({ ...prev, ...res.data }));
        }

        setLoading(false);
    };

    const isManager =
        guestData?.type === "manager" ||
        guestData?.role === "manager" ||
        guestData?.is_manager;

    return (
        <Modal visible={visible} transparent animationType="slide">
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Guest details</Text>
                        <TouchableOpacity onPress={onClose}>
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
                                    <Text style={styles.value}>{guestData.name || "N/A"}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Email:</Text>
                                    <Text style={styles.value}>{guestData.email || "N/A"}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Contact:</Text>
                                    <Text style={styles.value}>{guestData.phone || "N/A"}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Registration Time:</Text>
                                    <Text style={styles.value}>
                                        {guestData.registration_time || guestData.created_at || "N/A"}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Registered By:</Text>
                                    <Text style={styles.value}>{guestData.registered_by || "N/A"}</Text>
                                </View>

                                {guestData?.ticket_data && (
                                    <>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Ticket Title:</Text>
                                            <Text style={styles.value}>{guestData.ticket_data.ticket_title}</Text>
                                        </View>

                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Tickets Bought:</Text>
                                            <Text style={styles.value}>{guestData.ticket_data.tickets_bought}</Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            <View style={styles.buttonContainer}>
                                {onManualCheckIn && (
                                    <TouchableOpacity
                                        style={[
                                            styles.actionButton,
                                            (guestData?.status === 'Checked In' || guestData?.status === 'checked_in' || guestData?.check_in_status === 1) && styles.disabledButton
                                        ]}
                                        disabled={guestData?.status === 'Checked In' || guestData?.status === 'checked_in' || guestData?.check_in_status === 1}
                                        onPress={() => onManualCheckIn(guestId!)}
                                    >
                                        <Text style={styles.buttonText}>
                                            {(guestData?.status === 'Checked In' || guestData?.status === 'checked_in' || guestData?.check_in_status === 1) ? 'Checked In' : 'Manual CheckIn'}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {isManager ? (
                                    <TouchableOpacity style={styles.actionButton} onPress={() => onMakeGuest?.(guestId!)}>
                                        <Text style={styles.buttonText}>Make Guest</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.actionButton} onPress={() => onMakeManager?.(guestId!)}>
                                        <Text style={styles.buttonText}>Make Manager</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    ) : (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Failed to load guest details</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

export default GuestDetailsModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 0, // Remove padding to touch edges
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        width: '100%',
        padding: 24,
        paddingBottom: 40, // Extra padding for bottom safe area
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: -2 },
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
    disabledButton: {
        backgroundColor: '#CCC',
        shadowOpacity: 0,
        elevation: 0,
    },
});

