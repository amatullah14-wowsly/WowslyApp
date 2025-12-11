import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    DeviceEventEmitter,
    ScrollView
} from 'react-native';
import { getGuestDetails, verifyQrCode, checkInEventUser, getEventTickets, manualCheckInGuest } from '../api/event';
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

    // Facilities State
    const [facilities, setFacilities] = useState<any[]>([]);
    const [facilityAvailability, setFacilityAvailability] = useState<any[]>([]);
    const [selectedScanningOption, setSelectedScanningOption] = useState<string | number>('check_in');

    /* ---------------------- Reset State on Open ---------------------- */
    useEffect(() => {
        if (visible) {
            setCheckInStep('initial');
            setSelectedScanningOption('check_in');
            setCheckInQuantity(1);
        }
    }, [visible]);

    /* ---------------------- Fetch API details ---------------------- */
    useEffect(() => {
        if (visible && eventId && guestId && !offline) {
            // Delay fetch to allow modal animation to complete (prevents UI freeze)
            const timer = setTimeout(() => {
                fetchGuestDetails();
                fetchFacilities();
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

    const fetchFacilities = async () => {
        if (!eventId) return;
        const res = await getEventTickets(eventId);
        if (res && res.data) {
            // We need to find the specific ticket type for this guest to show relevant facilities
            // But usually facilities are returned per ticket type.
            // We'll filter later or store all and find match.
            // For now, let's store the raw data which is an array of tickets.
            // We will extract facilities for the CURRENT guest's ticket in render or effect.
            setFacilities(res.data);
        }
    };

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

    // Determine facilities for THIS guest
    const guestTicketId = guestData?.ticket_data?.ticket_id || guestData?.ticket_id;
    const currentTicketWithFacilities = facilities.find((t: any) => t.id == guestTicketId);
    const availableFacilities = currentTicketWithFacilities?.facilities || [];
    const hasFacilities = availableFacilities.length > 0;

    // "Check-in" option should be disabled if fully checked in
    // Facilities should be disabled if NOT checked in (usedCount == 0) - per user req
    const isGuestCheckedIn = usedCount > 0 || guestData?.status === 'checked_in';

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
                        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                                    <Text style={styles.label}>Ticket Title:</Text>
                                    <Text style={styles.value}>{guestData.ticket_data?.ticket_title || "Standard"}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Tickets Purchased:</Text>
                                    <Text style={styles.value}>{totalEntries}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Amount Paid:</Text>
                                    <Text style={styles.value}>{guestData.amount || guestData.price || 0} ₹</Text>
                                </View>



                                {checkInStep === 'initial' ? (
                                    <View style={styles.buttonContainer}>
                                        {(onManualCheckIn || (eventId && guestId)) && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.actionButton,
                                                    (isFullyCheckedIn && !hasFacilities) && styles.disabledButton
                                                ]}
                                                disabled={isFullyCheckedIn && !hasFacilities}
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
                                                            Toast.show({ type: 'error', text1: 'Invalid QR Verification', text2: 'Guest does not have a valid ticket.' });
                                                            return;
                                                        }

                                                        setLoading(true);
                                                        console.log("Starting Manual Check-in Verification...");
                                                        const res = await verifyQrCode(eventId, { qrGuestUuid: uuid });

                                                        if (res && (res.message === 'QR code verified' || res.success)) {
                                                            console.log("QR Verified. Fetching Tickets...");

                                                            // Handle guest_data array
                                                            const verifiedGuest = Array.isArray(res.guest_data) ? res.guest_data[0] : (res.guest_data || res.data);

                                                            if (verifiedGuest) {
                                                                // Calculate used entries from check_in_data availability
                                                                let calculatedUsed = 0;
                                                                if (Array.isArray(res.check_in_data)) {
                                                                    calculatedUsed = res.check_in_data.reduce((acc: number, curr: any) => acc + (Number(curr.check_in_count) || 0), 0);
                                                                }

                                                                setGuestData((prev: any) => ({
                                                                    ...prev,
                                                                    ...verifiedGuest,
                                                                    used_entries: calculatedUsed > 0 ? calculatedUsed : (prev?.used_entries || 0),
                                                                    checked_in_count: calculatedUsed
                                                                }));

                                                                // Set facilities from response if available (optimistic)
                                                                // We will overwrite this with getEventTickets shortly, but good for immediate feedback
                                                                if (verifiedGuest.facilities) {
                                                                    setFacilities([{ id: verifiedGuest.ticket_id, facilities: verifiedGuest.facilities }]);
                                                                }
                                                            }

                                                            // Set facility availability status
                                                            if (res.facility_availability_status) {
                                                                setFacilityAvailability(res.facility_availability_status);
                                                            }

                                                            // --- NEW STEP: Call Event Tickets API ---
                                                            // As per requirement: if verify is valid, call eventticket
                                                            const ticketsRes = await getEventTickets(eventId);
                                                            if (ticketsRes && ticketsRes.data) {
                                                                console.log("Tickets Fetched Successfully");
                                                                setFacilities(ticketsRes.data);
                                                            }

                                                            // Also refresh guest details to be sure
                                                            const detailsRes = await getGuestDetails(eventId, guestId);
                                                            if (detailsRes?.data) {
                                                                setGuestData((prev: any) => ({ ...prev, ...detailsRes.data }));
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
                                                    {isFullyCheckedIn && !hasFacilities ? 'Checked In' : 'Manual Check-In'}
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
                                        <Text style={styles.scanningReportsTitle}>Scanning Reports</Text>

                                        <Text style={styles.scanningForTitle}>Scanning for</Text>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radioGroup}>
                                            {/* CHECK-IN RADIO */}
                                            <TouchableOpacity
                                                style={styles.radioItem}
                                                onPress={() => !isFullyCheckedIn && setSelectedScanningOption('check_in')}
                                                activeOpacity={isFullyCheckedIn ? 1 : 0.7}
                                            >
                                                <View style={[styles.radioOuter, { borderColor: isFullyCheckedIn ? '#CCC' : '#FF8A3C' }]}>
                                                    {selectedScanningOption === 'check_in' && <View style={[styles.radioInner, { backgroundColor: isFullyCheckedIn ? '#CCC' : '#FF8A3C' }]} />}
                                                </View>
                                                <Text style={[styles.radioLabel, isFullyCheckedIn && styles.disabledText]}>Check-In</Text>
                                            </TouchableOpacity>

                                            {/* FACILITIES RADIOS */}
                                            {availableFacilities.map((fac: any) => {
                                                // Check availability from verifyQR response
                                                const availability = facilityAvailability.find((f: any) => f.id === fac.id);
                                                // Disable if guest NOT checked in yet OR if scans exhausted
                                                const isExhausted = availability && availability.available_scans <= 0;
                                                const facilityDisabled = !isGuestCheckedIn || isExhausted;

                                                return (
                                                    <TouchableOpacity
                                                        key={fac.id}
                                                        style={styles.radioItem}
                                                        onPress={() => {
                                                            if (facilityDisabled) return;
                                                            setSelectedScanningOption(fac.id);
                                                        }}
                                                        activeOpacity={facilityDisabled ? 1 : 0.7}
                                                    >
                                                        <View style={[styles.radioOuter, { borderColor: facilityDisabled ? '#CCC' : '#FF8A3C' }]}>
                                                            {selectedScanningOption === fac.id && <View style={[styles.radioInner, { backgroundColor: facilityDisabled ? '#CCC' : '#FF8A3C' }]} />}
                                                        </View>
                                                        <Text style={[styles.radioLabel, facilityDisabled && styles.disabledText]}>
                                                            {fac.name} {availability ? `(${availability.available_scans})` : ''}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>

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
                                                        let maxLimit = 1;
                                                        if (selectedScanningOption === 'check_in') {
                                                            const remaining = Math.max(0, totalEntries - usedCount);
                                                            maxLimit = remaining;
                                                        } else {
                                                            // Logic for facility limit?
                                                            // Usually same as total tickets bought? Or per facility logic?
                                                            // User didn't specify facility limits. Assuming same as ticket count.
                                                            maxLimit = totalEntries;
                                                        }
                                                        setCheckInQuantity(Math.min(checkInQuantity + 1, maxLimit));
                                                    }}
                                                    style={styles.counterButton}
                                                >
                                                    <Text style={styles.counterButtonText}>+</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={[
                                                styles.confirmCheckInButton,
                                                // Disable if trying to check-in main entries but full
                                                (selectedScanningOption === 'check_in' && isFullyCheckedIn) && styles.disabledButton,
                                                // Disable if facilities selected but not checked in (defensive)
                                                (selectedScanningOption !== 'check_in' && !isGuestCheckedIn) && styles.disabledButton
                                            ]}
                                            disabled={
                                                (selectedScanningOption === 'check_in' && isFullyCheckedIn) ||
                                                (selectedScanningOption !== 'check_in' && !isGuestCheckedIn)
                                            }
                                            onPress={async () => {
                                                if (!eventId || !guestId) return;
                                                setLoading(true);
                                                try {
                                                    // Unified Payload Logic
                                                    let payload: any = {
                                                        event_id: Number(eventId),
                                                        guest_id: guestData?.id || guestData?.guest_id,
                                                        category_check_in_count: "",
                                                        other_category_check_in_count: 0
                                                    };

                                                    if (selectedScanningOption === 'check_in') {
                                                        // Main Ticket Check-in
                                                        payload.ticket_id = guestData?.ticket_data?.ticket_id || guestData?.ticket_id;
                                                        payload.check_in_count = checkInQuantity;
                                                    } else {
                                                        // Facility Check-in: Treat facility as a distinct ticket ID
                                                        // Sending facility ID as ticket_id for /eventuser/checkin endpoint
                                                        payload.ticket_id = selectedScanningOption;
                                                        payload.check_in_count = checkInQuantity;
                                                    }

                                                    console.log('Sending Check-in Payload:', payload);
                                                    const res = await checkInEventUser(eventId, payload);

                                                    if (res && (res.success || res.id || res.message === 'Ticket checked in successfully')) {
                                                        Toast.show({ type: 'success', text1: 'Success', text2: 'Checked in successfully' });

                                                        // ---------------- SERVER-SIDE SYNC ----------------
                                                        // 1. Fetch fresh data from server (Guest + Facilities)
                                                        const freshGuestRes = await getGuestDetails(eventId, guestData?.id || guestData?.guest_id);

                                                        if (freshGuestRes?.data) {
                                                            const freshGuest = freshGuestRes.data;

                                                            // 2. Update Local State with optimistic/confirmed check-in data
                                                            setGuestData((prev: any) => {
                                                                const isMainCheckIn = selectedScanningOption === 'check_in';
                                                                const additionalUsed = isMainCheckIn ? checkInQuantity : 0;

                                                                // Calculate correct used_entries
                                                                const prevUsed = Number(prev?.used_entries || 0);
                                                                const freshUsed = Number(freshGuest?.used_entries || freshGuest?.checked_in_count || 0);
                                                                const newUsed = Math.max(prevUsed + additionalUsed, freshUsed);

                                                                return {
                                                                    ...prev,
                                                                    ...freshGuest,
                                                                    used_entries: newUsed,
                                                                    checked_in_count: newUsed,
                                                                    status: newUsed > 0 ? 'checked_in' : (freshGuest.status || prev.status)
                                                                };
                                                            });

                                                            // Update Facility Availability Optimistically
                                                            if (selectedScanningOption !== 'check_in') {
                                                                setFacilityAvailability((prevStats: any[]) => {
                                                                    return prevStats.map((fac: any) => {
                                                                        if (fac.id === selectedScanningOption) {
                                                                            return {
                                                                                ...fac,
                                                                                available_scans: Math.max(0, fac.available_scans - checkInQuantity)
                                                                            };
                                                                        }
                                                                        return fac;
                                                                    });
                                                                });
                                                            }

                                                            // 3. Save to Local DB (SQLite) to keep offline mode accurate
                                                            try {
                                                                const { insertOrReplaceGuests } = require('../db');
                                                                // insertOrReplaceGuests expects an array of guests
                                                                // It handles 'facilities' field if present in the object
                                                                await insertOrReplaceGuests(Number(eventId), [{
                                                                    ...freshGuest,
                                                                    // Ensure we pass the QR code if not in fresh response, preventing it from being null
                                                                    qr_code: guestData.qr_code || guestData.guest_uuid || freshGuest.uuid,
                                                                    synced: 1 // Mark as synced since it came from server
                                                                }]);
                                                                console.log("Local DB synced with fresh server data.");
                                                            } catch (err) {
                                                                console.error("Failed to sync local DB:", err);
                                                            }
                                                        }

                                                        DeviceEventEmitter.emit('REFRESH_GUEST_LIST');
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
                        </ScrollView>
                    ) : (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Failed to load guest details</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal >
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
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: -2 },
        elevation: 5,
    },
    scrollContent: {
        paddingBottom: 20
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
    disabledText: {
        color: '#AAA'
    },
    // Multi-step Check-in Styles
    checkInContainer: {
        marginTop: 10,
    },
    scanningReportsTitle: {
        fontSize: 16,
        color: '#333',
        marginBottom: 4,
        fontWeight: '500'
    },
    scanningForTitle: {
        fontSize: 15,
        color: '#666',
        marginTop: 8,
        marginBottom: 12,
    },
    radioGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 16
    },
    radioItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    radioLabel: {
        fontSize: 14,
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
