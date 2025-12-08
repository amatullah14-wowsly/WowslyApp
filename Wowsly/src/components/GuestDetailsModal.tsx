import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    DeviceEventEmitter
} from 'react-native';
import { getGuestDetails, verifyQrCode, checkInEventUser } from '../api/event';
import { updateTicketStatusLocal } from '../db';
import Toast from 'react-native-toast-message';

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
    const [checkInStep, setCheckInStep] = useState<'initial' | 'quantity'>('initial');
    const [checkInQuantity, setCheckInQuantity] = useState(1);

    /* ---------------------- Fetch API details ---------------------- */
    useEffect(() => {
        if (visible && eventId && guestId && !offline) {
            // Delay fetch to allow modal animation to complete (prevents UI freeze)
            const timer = setTimeout(() => {
                fetchGuestDetails();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [visible, eventId, guestId, offline]);

    /* ---------------------- Merge list guest → modal guest ---------------------- */
    useEffect(() => {
        if (guest) {
            setGuestData((prev: any) => ({ ...prev, ...guest }));
        }
    }, [guest]);

    const fetchGuestDetails = async () => {
        setLoading(true);
        const res = await getGuestDetails(eventId, guestId);

        if (res?.data) {
            // Normalize used_entries from various possible keys
            const data = res.data;
            const apiUsed = Number(data.used_entries || data.checked_in_count || data.ticket_data?.used_entries || data.ticket_data?.checked_in_count || 0);

            // Use requestAnimationFrame to avoid blocking the UI thread during updates
            requestAnimationFrame(() => {
                setGuestData((prev: any) => {
                    const currentUsed = Number(prev?.used_entries || 0);
                    const finalUsed = Math.max(currentUsed, apiUsed);

                    console.log('Fetched Guest Details (Merged):', {
                        id: data.id,
                        apiUsed,
                        currentUsed,
                        finalUsed,
                        bought: data.ticket_data?.tickets_bought
                    });

                    return {
                        ...prev,
                        ...data,
                        used_entries: finalUsed, // Keep the highest value to prevent overwrite by stale data
                        checked_in_count: finalUsed
                    };
                });
            });
        }

        requestAnimationFrame(() => {
            setLoading(false);
        });
    };

    const isManager =
        guestData?.type === "manager" ||
        guestData?.role === "manager" ||
        guestData?.is_manager;

    // Calculate disable state
    const usedCount = Number(guestData?.used_entries || guestData?.checked_in_count || 0);
    const totalEntries = Number(guestData?.ticket_data?.tickets_bought || guestData?.tickets_bought || guestData?.total_entries || 1);
    const isFullyCheckedIn = usedCount >= totalEntries;

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

                                        {(Number(guestData.ticket_data.tickets_bought) > 1) && (
                                            <View style={styles.detailRow}>
                                                <Text style={styles.label}>Entries Used:</Text>
                                                <Text style={styles.value}>
                                                    {guestData.used_entries || 0} / {guestData.ticket_data.tickets_bought}
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                )}

                                {checkInStep === 'initial' ? (
                                    <View style={styles.buttonContainer}>
                                        {(onManualCheckIn || (eventId && guestId)) && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.actionButton,
                                                    isFullyCheckedIn && styles.disabledButton
                                                ]}
                                                disabled={isFullyCheckedIn}
                                                onPress={async () => {
                                                    if (onManualCheckIn && guestId) {
                                                        onManualCheckIn(guestId);
                                                        return;
                                                    }
                                                    if (!eventId) return;

                                                    try {
                                                        const uuid = guestData.guest_uuid || guestData.uuid || guestData.qr_code;

                                                        // Fallback if no UUID found - manual bypass (or error if strict)
                                                        if (!uuid) {
                                                            console.log("No UUID found, proceeding to quantity (fallback)");
                                                            setCheckInStep('quantity');
                                                            return;
                                                        }

                                                        setLoading(true);
                                                        const res = await verifyQrCode(eventId, { qrGuestUuid: uuid });
                                                        console.log("VerifyQR Result:", res);

                                                        if (res && (res.message === 'QR code verified' || res.success)) {
                                                            // Enrich guestData with verification result if available
                                                            // This is CRITICAL if getGuestDetails was incomplete
                                                            if (res.data || res.guest_data || res.user) {
                                                                const newData = res.data || res.guest_data || res.user;
                                                                console.log("Enriching guestData from VerifyQR:", newData);
                                                                setGuestData((prev: any) => ({ ...prev, ...newData }));
                                                            }
                                                            setLoading(false);
                                                            setCheckInStep('quantity');
                                                        } else {
                                                            Toast.show({ type: 'error', text1: 'Verification Failed', text2: res?.message || 'Invalid QR' });
                                                            setLoading(false);
                                                        }
                                                    } catch (e) {
                                                        console.error(e);
                                                        Toast.show({ type: 'error', text1: 'Error', text2: 'Verification failed' });
                                                        setLoading(false);
                                                    }
                                                }}
                                            >
                                                <Text style={styles.buttonText}>
                                                    {isFullyCheckedIn ? 'Checked In' : 'Manual Check-In'}
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
                                ) : (
                                    /* ---------------------- STEP 2: Quantity Selection ---------------------- */
                                    <View style={styles.checkInContainer}>
                                        <Text style={styles.scanningForTitle}>Scanning for</Text>

                                        <View style={styles.radioRow}>
                                            <View style={styles.radioOuter}>
                                                <View style={styles.radioInner} />
                                            </View>
                                            <Text style={styles.radioLabel}>Check-In</Text>
                                        </View>

                                        <View style={styles.quantityRow}>
                                            <Text style={styles.quantityLabel}>Number of guests:</Text>

                                            <View style={styles.counterControl}>
                                                <TouchableOpacity
                                                    onPress={() => setCheckInQuantity(Math.max(1, checkInQuantity - 1))}
                                                    style={styles.counterButton}
                                                >
                                                    <Text style={styles.counterButtonText}>-</Text>
                                                </TouchableOpacity>

                                                <View style={styles.counterValueContainer}>
                                                    <Text style={styles.counterValue}>{checkInQuantity}</Text>
                                                </View>

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        const total = Number(guestData?.ticket_data?.tickets_bought || guestData?.tickets_bought || guestData?.total_entries || 1);
                                                        const used = Number(guestData?.used_entries || guestData?.checked_in_count || 0);
                                                        const remaining = Math.max(0, total - used);
                                                        setCheckInQuantity(Math.min(checkInQuantity + 1, remaining));
                                                    }}
                                                    style={styles.counterButton}
                                                >
                                                    <Text style={styles.counterButtonText}>+</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.confirmCheckInButton}
                                            onPress={async () => {
                                                if (!eventId || !guestId) return;
                                                setLoading(true);
                                                try {
                                                    // New payload per user request
                                                    const payload = {
                                                        event_id: Number(eventId),
                                                        guest_id: guestData?.id || guestData?.guest_id, // guest_id from data
                                                        ticket_id: guestData?.ticket_data?.ticket_id || guestData?.ticket_id,
                                                        check_in_count: checkInQuantity,
                                                        category_check_in_count: "",
                                                        other_category_check_in_count: 0
                                                    };

                                                    const res = await checkInEventUser(eventId, payload);

                                                    // API returns the created object (with id) on success, or { status: false } on failure
                                                    if (res && (res.success || res.id)) {
                                                        Toast.show({ type: 'success', text1: 'Success', text2: 'Guest checked in successfully' });

                                                        // ⚡⚡⚡ PERSIST TO DB ⚡⚡⚡
                                                        try {
                                                            const uuid = guestData.guest_uuid || guestData.uuid || guestData.qr_code;
                                                            // Ensure we have a valid guest object to save
                                                            if (uuid) {
                                                                const newUsed = (Number(guestData.used_entries) || 0) + Number(checkInQuantity);
                                                                const guestToSync = {
                                                                    ...guestData,
                                                                    qr_code: uuid,
                                                                    status: 'checked_in', // Explicitly set status
                                                                    used_entries: newUsed,
                                                                    check_in_count: checkInQuantity,
                                                                    synced: 1 // Online check-in is already synced
                                                                };

                                                                // Import insertOrReplaceGuests if not already imported (it is exported from ../db)
                                                                const { insertOrReplaceGuests } = require('../db');
                                                                await insertOrReplaceGuests(Number(eventId), [guestToSync]);
                                                                console.log("Persisted manual check-in to local DB");
                                                            }
                                                        } catch (err) {
                                                            console.warn("DB Persist Failed:", err);
                                                        }

                                                        // Prepare updated guest object for optimistic update
                                                        const updatedGuestData = {
                                                            ...guestData,
                                                            status: 'Checked In',
                                                            check_in_status: 1,
                                                            used_entries: (guestData?.used_entries || 0) + checkInQuantity
                                                        };
                                                        setGuestData(updatedGuestData);

                                                        DeviceEventEmitter.emit('REFRESH_GUEST_LIST');
                                                        DeviceEventEmitter.emit('GUEST_CHECKED_IN_MANUALLY', { guestId: guestId, count: checkInQuantity, fullGuestData: updatedGuestData });

                                                        // Close or reset
                                                        setCheckInStep('initial');
                                                        onClose();
                                                    } else {
                                                        Toast.show({ type: 'error', text1: 'Check-in Failed', text2: res?.message || 'Unknown error' });
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    Toast.show({ type: 'error', text1: 'Error', text2: 'Check-in failed' });
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                        >
                                            <Text style={styles.confirmButtonText}>Checkin</Text>
                                        </TouchableOpacity>
                                    </View>
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
        padding: 0,
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        width: '100%',
        padding: 24,
        paddingBottom: 40,
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
    // Multi-step Check-in Styles
    checkInContainer: {
        marginTop: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    sectionTitle: {
        fontSize: 16,
        color: '#333',
    },
    sectionArrow: {
        fontSize: 18,
        color: '#666',
        fontWeight: 'bold',
    },
    scanningForTitle: {
        fontSize: 15,
        color: '#666',
        marginTop: 16,
        marginBottom: 12,
    },
    radioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#FF8A3C',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF8A3C',
    },
    radioLabel: {
        fontSize: 16,
        color: '#111',
        fontWeight: '500',
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    quantityLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },
    counterControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    counterButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FF8A3C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterButtonText: {
        fontSize: 20,
        color: '#FF8A3C',
        lineHeight: 22,
        fontWeight: '600',
    },
    counterValueContainer: {
        width: 40,
        height: 40,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111',
    },
    confirmCheckInButton: {
        backgroundColor: '#FF8A3C',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
