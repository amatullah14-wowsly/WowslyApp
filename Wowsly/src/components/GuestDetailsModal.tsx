import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    DeviceEventEmitter,
    ScrollView,
    Animated,
    Easing,
    Dimensions
} from 'react-native';
import { scale, verticalScale, moderateScale } from '../utils/scaling';
import { getGuestDetails, verifyQrCode, checkInEventUser, getEventTickets } from '../api/event';
import { updateTicketStatusLocal, getFacilitiesForGuest, updateFacilityCheckInLocal } from '../db';
import Toast from 'react-native-toast-message';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ⚡⚡⚡ COMPONENT: PREMIUM SKELETON LOADER ⚡⚡⚡
const SkeletonRow = ({ width = '100%', height = verticalScale(20), style }: any) => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    backgroundColor: '#E0E0E0',
                    borderRadius: 4,
                    opacity,
                },
                style
            ]}
        />
    );
};

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

// ⚡⚡⚡ HELPER: SINGLE SOURCE OF TRUTH FOR UUID ⚡⚡⚡
// Normalizes conflicting keys to match SQLite (qrGuestUuid)
const getGuestUUID = (g: any) =>
    g?.qrGuestUuid ||
    g?.guest_uuid ||
    g?.uuid ||
    g?.qr_code ||
    null;

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
    const [selectedScanningOption, setSelectedScanningOption] = useState<string | number>('check_in');
    const [facilityStatus, setFacilityStatus] = useState<any[]>([]); // New state for tracking availability



    // ⚡⚡⚡ ANIMATION REFS ⚡⚡⚡
    // Initial state: Off-screen (bottom) and invisible
    const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    // ⚡⚡⚡ ANIMATION TRIGGER ⚡⚡⚡
    useEffect(() => {
        if (visible) {
            setLoading(true); // Reset loading on open
            // Trigger Enter Animation
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 350, // Slightly slower for "premium" feel
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Reset for next open (optional usually handled by unmount if controlled by parent, 
            // but if modal stays mounted we need to reset)
            slideAnim.setValue(SCREEN_HEIGHT);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    /* ---------------------- Fetch API details ---------------------- */
    useEffect(() => {
        if (visible && eventId && guestId) {
            // IMMEDIATE FETCH - No artificial delay
            // The Skeleton will handle the visual waiting state
            fetchGuestDetails();
            fetchFacilities();
        }
    }, [visible, eventId, guestId, offline]);

    /* ---------------------- Merge list guest → modal guest ---------------------- */
    useEffect(() => {
        if (guest) {
            setGuestData((prev: any) => ({ ...prev, ...guest }));
        }
    }, [guest]);

    const fetchFacilities = async () => {
        if (offline) {
            const uuid = getGuestUUID(guestData);
            if (!uuid) return;

            const localFacilities = await getFacilitiesForGuest(uuid);
            console.log("OFFLINE FACILITIES:", uuid, localFacilities);

            // FIX: Set FLAT list of facilities directly (Guest owns facilities)
            const flatFacilities = localFacilities.map(f => ({
                id: f.facilityId,
                name: f.name
            }));
            setFacilities(flatFacilities);

            // Set availability status
            setFacilityStatus(
                localFacilities.map(f => ({
                    id: f.facilityId,
                    available_scans: Math.max(0, (f.availableScans || 0) - (f.checkIn || 0))
                }))
            );
        }
        // Online: Do nothing. Facilities come from verifyQrCode response.
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

    // ⚡⚡⚡ HELPER: REFRESH FROM SQLITE (SINGLE SOURCE OF TRUTH) ⚡⚡⚡
    const refreshOfflineData = async (uuid: string) => {
        const { getGuestByUuid, getFacilitiesForGuest } = require('../db');
        const dbGuest = await getGuestByUuid(uuid);
        const dbFacilities = await getFacilitiesForGuest(uuid);

        if (dbGuest) {
            setGuestData((prev: any) => ({
                ...prev,
                used_entries: dbGuest.used_entries || 0,
                // Status update based on usage
                status: (dbGuest.used_entries || 0) > 0 ? 'checked_in' : prev.status
            }));
        }

        if (dbFacilities) {
            setFacilityStatus(
                dbFacilities.map((f: any) => ({
                    id: f.facilityId,
                    available_scans: Math.max(0, (f.availableScans || 0) - (f.checkIn || 0))
                }))
            );
        }
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
    // FIX: Facilities is now a flat list (Facility[]) owned by the guest
    const availableFacilities = facilities || [];
    const hasFacilities = availableFacilities.length > 0;

    // "Check-in" option should be disabled if fully checked in
    // Facilities should be disabled if NOT checked in (usedCount == 0) - per user req
    const isGuestCheckedIn = usedCount > 0 || guestData?.status === 'checked_in';

    return (
        <Modal visible={visible} transparent animationType="none">
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                {/* ⚡⚡⚡ ANIMATED CONTAINER ⚡⚡⚡ */}
                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            transform: [{ translateY: slideAnim }],
                            opacity: fadeAnim
                        }
                    ]}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Guest details</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {loading || !guestData ? (
                            /* ⚡⚡⚡ SKELETON LOADER ⚡⚡⚡ */
                            <View style={styles.skeletonContainer}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <View key={i} style={styles.detailRow}>
                                        <SkeletonRow width="30%" height={20} />
                                        <SkeletonRow width="50%" height={20} />
                                    </View>
                                ))}
                                <View style={{ marginTop: 20 }}>
                                    <SkeletonRow width="100%" height={50} style={{ borderRadius: 12 }} />
                                </View>
                            </View>
                        ) : (
                            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.scrollContent}>
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
                                                        ((isFullyCheckedIn && !hasFacilities) || (isFullyCheckedIn && hasFacilities && facilityStatus.length > 0 && availableFacilities.every(fac => {
                                                            const stat = facilityStatus.find(s => s.id == fac.id);
                                                            return stat ? stat.available_scans <= 0 : false;
                                                        }))) && styles.disabledButton
                                                    ]}
                                                    disabled={
                                                        (isFullyCheckedIn && !hasFacilities) ||
                                                        (isFullyCheckedIn && hasFacilities && facilityStatus.length > 0 && availableFacilities.every(fac => {
                                                            const stat = facilityStatus.find(s => s.id == fac.id);
                                                            return stat ? stat.available_scans <= 0 : false;
                                                        }))
                                                    }
                                                    onPress={async () => {
                                                        if (onManualCheckIn && guestId) {
                                                            onManualCheckIn(guestId);
                                                            return;
                                                        }
                                                        if (!eventId) return;

                                                        try {
                                                            // FIX: STRICT UUID LOOKUP
                                                            const uuid = guestData.qrGuestUuid || guestData.guest_uuid || guestData.uuid;

                                                            // Check if fully used (Main + Facilities) before allowing verify? 
                                                            // User logic: "if all the facilities got scanned or checked in then manual check in button should get disabled"
                                                            // We can calculate this using current data if we have it, OR rely on verify call to return status and THEN disable.
                                                            // But the button ITSELF is what triggers verify. So we need to disable it in render.

                                                            // Fallback if no UUID found - manual bypass (or error if strict)
                                                            if (!uuid) {
                                                                Toast.show({ type: 'error', text1: 'Invalid QR Verification', text2: 'Guest does not have a valid ticket.' });
                                                                return;
                                                            }

                                                            setLoading(true);

                                                            // ⚡⚡⚡ OFFLINE BYPASS: SKIP API ⚡⚡⚡
                                                            // Kotlin Logic: Offline = Trust local SQLite data. DO NOT call verifyQrCode.
                                                            if (offline) {
                                                                console.log("Offline Mode: Skipping QR API verify, using local data.");

                                                                // Proceed directly to Step 2
                                                                setLoading(false);
                                                                setCheckInStep('quantity');

                                                                // Ensure facilities are loaded (from SQLite)
                                                                // (Previous fix ensures they load correctly even without ticket_id)
                                                                await fetchFacilities();
                                                                return;
                                                            }

                                                            const res = await verifyQrCode(eventId, { qrGuestUuid: uuid });
                                                            console.log("VerifyQR Result:", res);

                                                            // 🟢 ONLINE success
                                                            if (res && (res.message === 'QR code verified' || res.success)) {
                                                                console.log("QR Verified. Fetching fresh details...");

                                                                // Handle guest_data as Array or Object
                                                                let mergedData = {};
                                                                if (res.guest_data) {
                                                                    if (Array.isArray(res.guest_data) && res.guest_data.length > 0) {
                                                                        mergedData = res.guest_data[0];
                                                                    } else if (!Array.isArray(res.guest_data)) {
                                                                        mergedData = res.guest_data;
                                                                    }
                                                                } else if (res.data) {
                                                                    mergedData = res.data;
                                                                }

                                                                // Update state immediately with verify response
                                                                setGuestData((prev: any) => ({ ...prev, ...mergedData }));

                                                                // Store facility availability status from verify response
                                                                if (res.facility_availability_status) {
                                                                    setFacilityStatus(res.facility_availability_status);
                                                                }

                                                                // FIX: Set facilities from verify response (Server Truth)
                                                                // Do NOT call fetchFacilities() or getEventTickets()
                                                                // mergedData comes from guest_data[0]
                                                                if (mergedData.facilities) {
                                                                    setFacilities(mergedData.facilities);
                                                                } else if (res.facilities) {
                                                                    setFacilities(res.facilities);
                                                                }

                                                                const detailsRes = await getGuestDetails(eventId, guestId);
                                                                // Removed await fetchFacilities();

                                                                if (detailsRes?.data) {
                                                                    const newData = detailsRes.data;
                                                                    setGuestData((prev: any) => ({ ...prev, ...newData }));
                                                                }

                                                                setLoading(false);
                                                                setCheckInStep('quantity');
                                                                // Default selection: If fully checked in, maybe select first facility?
                                                                // Or stick to 'check_in' and let user see it's disabled.
                                                                // If usedCount >= totalEntries, 'check_in' radio will be disabled in render but we should auto select something else?
                                                                // For now defaults to 'check_in'
                                                                return;
                                                            }

                                                            // 🟡 OFFLINE MODE (Network Error)
                                                            if (!res || res.status === false) {
                                                                if (offline) {
                                                                    Toast.show({
                                                                        type: 'info',
                                                                        text1: 'Offline Mode',
                                                                        text2: 'Verified locally. Using offline data.'
                                                                    });

                                                                    // Manually proceed as verified
                                                                    await fetchFacilities();     // load facilities from SQLite
                                                                    setCheckInStep('quantity');  // move to step 2
                                                                    setLoading(false);
                                                                    return;
                                                                }
                                                            }

                                                            // 🔴 REAL failure
                                                            Toast.show({ type: 'error', text1: 'Verification Failed', text2: res?.message || 'Invalid QR' });
                                                            setLoading(false);
                                                        } catch (e) {
                                                            console.error(e);
                                                            // 🟡 CATCH-ALL OFFLINE MODE (If calling verifyQrCode threw instead of returning error obj)
                                                            if (offline) {
                                                                Toast.show({
                                                                    type: 'info',
                                                                    text1: 'Offline Mode',
                                                                    text2: 'Verified locally. Using offline data.'
                                                                });

                                                                // Manually proceed as verified
                                                                await fetchFacilities();     // load facilities from SQLite
                                                                setCheckInStep('quantity');  // move to step 2
                                                                setLoading(false);
                                                                return;
                                                            }

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

                                            <View style={styles.radioGroup}>
                                                {/* CHECK-IN RADIO (Main Ticket) */}
                                                {/* Logic: Enabled ONLY if remaining tickets > 0 */}
                                                {(() => {
                                                    const remainingMain = Math.max(0, totalEntries - usedCount);
                                                    const mainCheckInDisabled = remainingMain <= 0;

                                                    return (
                                                        <TouchableOpacity
                                                            style={styles.radioItem}
                                                            onPress={() => !mainCheckInDisabled && setSelectedScanningOption('check_in')}
                                                            activeOpacity={mainCheckInDisabled ? 1 : 0.7}
                                                        >
                                                            <View style={[styles.radioOuter, { borderColor: mainCheckInDisabled ? '#CCC' : '#FF8A3C' }]}>
                                                                {selectedScanningOption === 'check_in' && <View style={[styles.radioInner, { backgroundColor: mainCheckInDisabled ? '#CCC' : '#FF8A3C' }]} />}
                                                            </View>
                                                            <Text style={[styles.radioLabel, mainCheckInDisabled && styles.disabledText]}>Check-In</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })()}

                                                {/* FACILITIES RADIOS */}
                                                {/* Logic: Enabled ONLY if Main Tickets <= 0 AND Facility Scans > 0 */}
                                                {availableFacilities.map((fac: any) => {
                                                    const remainingMain = Math.max(0, totalEntries - usedCount);
                                                    // Kotlin Rule: Facilities enabled after FIRST main check-in
                                                    const mainCheckedIn = usedCount > 0;

                                                    let facilityDisabled = !mainCheckedIn; // Disabled if NOT checked in yet

                                                    // Also check specific facility availability
                                                    if (!facilityDisabled && facilityStatus.length > 0) {
                                                        const status = facilityStatus.find((s: any) => s.id == fac.id);
                                                        if (status && status.available_scans <= 0) {
                                                            facilityDisabled = true;
                                                        }
                                                    }

                                                    return (
                                                        <TouchableOpacity
                                                            key={fac.id}
                                                            style={styles.radioItem}
                                                            onPress={() => !facilityDisabled && setSelectedScanningOption(fac.id)}
                                                            activeOpacity={facilityDisabled ? 1 : 0.7}
                                                        >
                                                            <View style={[styles.radioOuter, { borderColor: facilityDisabled ? '#CCC' : '#FF8A3C' }]}>
                                                                {selectedScanningOption === fac.id && <View style={[styles.radioInner, { backgroundColor: facilityDisabled ? '#CCC' : '#FF8A3C' }]} />}
                                                            </View>
                                                            <Text style={[styles.radioLabel, facilityDisabled && styles.disabledText]}>{fac.name}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
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
                                                    // Disable logic matching strict rules
                                                    (() => {
                                                        const remainingMain = Math.max(0, totalEntries - usedCount);
                                                        if (selectedScanningOption === 'check_in') {
                                                            return remainingMain <= 0; // Disable if no main tickets left
                                                        } else {
                                                            // Facility logic
                                                            // Kotlin Rule: Facilities enabled after FIRST main check-in
                                                            if (usedCount <= 0) return true; // Disable facility if NOT checked in yet

                                                            // Check specific facility availability
                                                            const stat = facilityStatus.find((s: any) => s.id == selectedScanningOption);
                                                            return stat ? stat.available_scans <= 0 : false;
                                                        }
                                                    })() && styles.disabledButton
                                                ]}
                                                disabled={
                                                    (() => {
                                                        const remainingMain = Math.max(0, totalEntries - usedCount);
                                                        if (selectedScanningOption === 'check_in') {
                                                            return remainingMain <= 0;
                                                        } else {
                                                            if (usedCount <= 0) return true; // Disabled if not checked in yet
                                                            const stat = facilityStatus.find((s: any) => s.id == selectedScanningOption);
                                                            return stat ? stat.available_scans <= 0 : false;
                                                        }
                                                    })()
                                                }
                                                onPress={async () => {
                                                    if ((!eventId && !offline) || (!guestData && offline)) return;
                                                    setLoading(true);
                                                    try {
                                                        // OFFLINE LOGIC
                                                        if (offline) {
                                                            const uuid = getGuestUUID(guestData);

                                                            if (selectedScanningOption === 'check_in') {
                                                                // STRICT GATE ENTRY (Using performGateCheckIn)
                                                                const { performGateCheckIn } = require('../db');
                                                                // REFACTORED: Guest-based identity only, scoped by Event
                                                                const rowsAffected = await performGateCheckIn(Number(eventId), uuid);

                                                                if (rowsAffected === 0) {
                                                                    Toast.show({ type: 'error', text1: 'Check-in Failed', text2: 'Guest already checked in' });
                                                                    setLoading(false);
                                                                    return;
                                                                }

                                                                // ⚡⚡⚡ OFFLINE STATE REFRESH (CRITICAL) ⚡⚡⚡
                                                                Toast.show({ type: 'success', text1: 'Success', text2: 'Checked in locally' });

                                                                // ⚡⚡⚡ OFFLINE STATE REFRESH (CRITICAL) ⚡⚡⚡
                                                                Toast.show({ type: 'success', text1: 'Success', text2: 'Checked in locally' });

                                                                // INLINE FIX: Explicit refresh to prove DB update
                                                                const { getGuestByUuid, getFacilitiesForGuest } = require('../db');
                                                                const dbGuest = await getGuestByUuid(uuid);
                                                                console.log("DB GUEST AFTER CHECKIN", dbGuest);

                                                                // Refresh Guest Data
                                                                if (dbGuest) {
                                                                    setGuestData((prev: any) => ({
                                                                        ...prev,
                                                                        used_entries: dbGuest.used_entries,
                                                                        checked_in_count: dbGuest.used_entries,   // 🔥 FIX: Ensure this is updated too
                                                                        status: dbGuest.used_entries > 0 ? 'checked_in' : prev.status
                                                                    }));
                                                                }

                                                                // Refresh Facilities (Unlocking depends on used_entries)
                                                                const dbFacilities = await getFacilitiesForGuest(uuid);
                                                                setFacilityStatus(
                                                                    dbFacilities.map((f: any) => ({
                                                                        id: f.facilityId,
                                                                        available_scans: Math.max(0, (f.availableScans || 0) - (f.checkIn || 0))
                                                                    }))
                                                                );

                                                                // 🔥 Kotlin behavior: AUTO SWITCH to first available facility
                                                                const firstAvailable = dbFacilities.find((f: any) =>
                                                                    (f.availableScans || 0) - (f.checkIn || 0) > 0
                                                                );
                                                                if (firstAvailable) {
                                                                    setSelectedScanningOption(firstAvailable.facilityId);
                                                                }

                                                                DeviceEventEmitter.emit('REFRESH_GUEST_LIST');
                                                                // Stay on 'quantity' step or go back?
                                                                // Gate check in successful -> usually we want to SCAN FACILITIES now.
                                                                // If we go back to 'initial' we lose the "Now scan facility" flow.
                                                                // Kotlin stays on screen.
                                                                // Keep step 'quantity' so user sees updated facility radios.
                                                                // setCheckInStep('initial');
                                                                setLoading(false);
                                                                return;
                                                            } else {
                                                                // Facility Check-In
                                                                // Ensure main ticket is checked in first? (Already disabled in UI)
                                                                const updated = await updateFacilityCheckInLocal(uuid, Number(selectedScanningOption), checkInQuantity);

                                                                if (updated > 0) {
                                                                    Toast.show({ type: 'success', text1: 'Success', text2: 'Facility checked in locally' });

                                                                    // ⚡⚡⚡ OFFLINE STATE REFRESH ⚡⚡⚡
                                                                    await refreshOfflineData(uuid);

                                                                    DeviceEventEmitter.emit('REFRESH_GUEST_LIST'); // Ensure list refreshes
                                                                    setLoading(false);
                                                                    return; // Stop here. Do NOT fall through to naive verification below.
                                                                } else {
                                                                    Toast.show({ type: 'error', text1: 'Check-in Failed', text2: 'Facility already checked in or not available' });
                                                                }
                                                            }

                                                            // Refresh Data
                                                            const updatedGuestData = {
                                                                ...guestData,
                                                                status: 'Checked In',
                                                                used_entries: selectedScanningOption === 'check_in'
                                                                    ? (Number(guestData?.used_entries) || 0) + checkInQuantity
                                                                    : (Number(guestData?.used_entries) || 0)
                                                            };
                                                            setGuestData(updatedGuestData);

                                                            if (selectedScanningOption !== 'check_in') {
                                                                // Update local status state
                                                                setFacilityStatus(prev => prev.map(f => {
                                                                    if (String(f.id) === String(selectedScanningOption)) {
                                                                        return { ...f, available_scans: Math.max(0, f.available_scans - checkInQuantity) };
                                                                    }
                                                                    return f;
                                                                }));
                                                            }

                                                            DeviceEventEmitter.emit('REFRESH_GUEST_LIST'); // Notify list to refresh from DB
                                                            setCheckInStep('initial');
                                                            setLoading(false);
                                                            return;
                                                        }

                                                        // Standard Payload base
                                                        let payload: any = {
                                                            event_id: Number(eventId),
                                                            guest_id: guestData?.id || guestData?.guest_id,
                                                            category_check_in_count: "",
                                                            other_category_check_in_count: 0,
                                                            ticket_id: guestData?.ticket_data?.ticket_id || guestData?.ticket_id, // ALWAYS Main Ticket ID
                                                            check_in_count: checkInQuantity
                                                        };

                                                        if (selectedScanningOption !== 'check_in') {
                                                            // Facility Check-in: Add guest_facility_id
                                                            payload.guest_facility_id = String(selectedScanningOption);
                                                        }

                                                        const res = await checkInEventUser(eventId, payload);

                                                        if (res && (res.success || res.id)) {
                                                            Toast.show({ type: 'success', text1: 'Success', text2: 'Checked in successfully' });

                                                            // Refresh data locally
                                                            const uuid = guestData.qrGuestUuid || guestData.guest_uuid || guestData.uuid;
                                                            if (selectedScanningOption === 'check_in' && uuid) {
                                                                try {
                                                                    // Sync main check-in to DB
                                                                    await updateTicketStatusLocal(uuid, 'checked_in', 1, false);

                                                                    // ⚡⚡⚡ OFFLINE STATE REFRESH (CRITICAL) ⚡⚡⚡
                                                                    // Recalculate used_entries from DB so UI unlocks facilities
                                                                    const { getGuestByUuid, getFacilitiesForGuest } = require('../db');

                                                                    const dbGuest = await getGuestByUuid(uuid);
                                                                    const dbFacilities = await getFacilitiesForGuest(uuid);

                                                                    if (dbGuest) {
                                                                        setGuestData((prev: any) => ({
                                                                            ...prev,
                                                                            used_entries: dbGuest.used_entries,
                                                                            status: dbGuest.used_entries > 0 ? 'checked_in' : prev.status
                                                                        }));
                                                                    }

                                                                    setFacilityStatus(
                                                                        dbFacilities.map((f: any) => ({
                                                                            id: f.facilityId,
                                                                            available_scans: Math.max(0, (f.availableScans || 0) - (f.checkIn || 0))
                                                                        }))
                                                                    );

                                                                } catch (err) {
                                                                    console.log('Error updating local ticket:', err);
                                                                }
                                                            }

                                                            // Optimistic Update
                                                            const updatedGuestData = {
                                                                ...guestData,
                                                                status: 'Checked In',
                                                                // Only increment used_entries if main check-in
                                                                used_entries: selectedScanningOption === 'check_in'
                                                                    ? (Number(guestData?.used_entries) || 0) + checkInQuantity
                                                                    : (Number(guestData?.used_entries) || 0)
                                                            };
                                                            setGuestData(updatedGuestData);

                                                            // Optimistic Facility Status Update
                                                            if (selectedScanningOption !== 'check_in') {
                                                                setFacilityStatus(prev => prev.map(f => {
                                                                    if (String(f.id) === String(selectedScanningOption)) {
                                                                        return { ...f, available_scans: Math.max(0, f.available_scans - checkInQuantity) };
                                                                    }
                                                                    return f;
                                                                }));
                                                            }

                                                            await fetchFacilities(); // Refresh facilities to check subsequent availability

                                                            DeviceEventEmitter.emit('REFRESH_GUEST_LIST');

                                                            setCheckInStep('initial');
                                                            // onClose(); // Keep modal open as per requirement
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
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity >
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
        borderTopLeftRadius: moderateScale(24),
        borderTopRightRadius: moderateScale(24),
        width: '100%',
        padding: moderateScale(24),
        paddingBottom: verticalScale(40),
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: moderateScale(4),
        shadowOffset: { width: 0, height: verticalScale(-2) },
        elevation: 5,
    },
    scrollContent: {
        paddingBottom: verticalScale(20)
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(20),
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: '700',
        color: '#111111',
    },
    closeButton: {
        width: moderateScale(25),
        height: moderateScale(25),
        borderRadius: moderateScale(16),
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: moderateScale(15),
        color: '#666666',
        fontWeight: '600',
        alignSelf: 'center',
    },
    loadingContainer: {
        paddingVertical: verticalScale(40),
        alignItems: 'center',
    },
    detailsContainer: {
        gap: verticalScale(16),
        marginBottom: verticalScale(24),
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    label: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: '#666666',
        width: moderateScale(140),
        flexShrink: 0,
    },
    value: {
        fontSize: moderateScale(14),
        color: '#111111',
        flex: 1,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: moderateScale(12),
        marginTop: verticalScale(8),
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#FF8A3C',
        borderRadius: moderateScale(12),
        paddingVertical: verticalScale(12),
        alignItems: 'center',
        shadowColor: '#FF8A3C',
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(8),
        shadowOffset: { width: 0, height: verticalScale(4) },
        elevation: 3,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: moderateScale(14),
        fontWeight: '700',
    },
    errorContainer: {
        paddingVertical: verticalScale(40),
        alignItems: 'center',
    },
    errorText: {
        fontSize: moderateScale(16),
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
        marginTop: verticalScale(4), // Reduced from 10
    },
    scanningReportsTitle: {
        fontSize: moderateScale(16),
        color: '#333',
        marginBottom: verticalScale(2), // Reduced from 4
        fontWeight: '500'
    },
    scanningForTitle: {
        fontSize: moderateScale(15),
        color: '#666',
        marginTop: verticalScale(4), // Reduced from 8
        marginBottom: verticalScale(8), // Reduced from 12
    },
    radioGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: verticalScale(12), // Reduced from 20
        gap: moderateScale(16)
    },
    radioItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: moderateScale(16),
        marginBottom: verticalScale(8) // Reduced from 10
    },
    radioOuter: {
        width: moderateScale(20),
        height: moderateScale(20),
        borderRadius: moderateScale(10),
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: moderateScale(8),
    },
    radioInner: {
        width: moderateScale(10),
        height: moderateScale(10),
        borderRadius: moderateScale(5),
    },
    radioLabel: {
        fontSize: moderateScale(14),
        color: '#111',
        fontWeight: '500',
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: verticalScale(16), // Reduced from 30
    },
    quantityLabel: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#111',
    },
    counterControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(12),
    },
    counterButton: {
        width: moderateScale(32),
        height: moderateScale(32),
        borderRadius: moderateScale(16),
        borderWidth: 1,
        borderColor: '#FF8A3C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterButtonText: {
        fontSize: moderateScale(20),
        color: '#FF8A3C',
        lineHeight: moderateScale(22),
        fontWeight: '600',
    },
    counterValueContainer: {
        width: moderateScale(40),
        height: moderateScale(40),
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: moderateScale(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterValue: {
        fontSize: moderateScale(18),
        fontWeight: '600',
        color: '#111',
    },
    confirmCheckInButton: {
        backgroundColor: '#FF8A3C',
        borderRadius: moderateScale(12),
        paddingVertical: verticalScale(14),
        alignItems: 'center',
        marginBottom: verticalScale(10),
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: moderateScale(16),
        fontWeight: '700',
    },
});
