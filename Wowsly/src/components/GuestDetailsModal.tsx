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
    Switch,
    TouchableWithoutFeedback
} from 'react-native';
import { scale, verticalScale, moderateScale } from '../utils/scaling';
import { getGuestDetails, verifyQrCode, checkInEventUser, getEventTickets } from '../api/event';
import { updateTicketStatusLocal, getFacilitiesForGuest, updateFacilityCheckInLocal } from '../db';
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
    const [showAdditional, setShowAdditional] = useState(false);
    const [checkInStep, setCheckInStep] = useState<'initial' | 'quantity'>('initial');
    const [checkInQuantity, setCheckInQuantity] = useState(1);

    // Facilities State
    const [facilities, setFacilities] = useState<any[]>([]);
    const [selectedScanningOption, setSelectedScanningOption] = useState<string | number>('check_in');
    const [facilityStatus, setFacilityStatus] = useState<any[]>([]); // New state for tracking availability

    /* ---------------------- Fetch API details ---------------------- */
    useEffect(() => {
        if (visible && eventId && guestId) {
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
        if (offline) {
            const uuid = getGuestUUID(guestData);
            if (!uuid || !eventId) return;

            try {
                const dbFacilities = await getFacilitiesForGuest(Number(eventId), uuid);
                console.log("OFFLINE FACILITIES:", uuid, dbFacilities);

                // FIX: Set FLAT list of facilities directly (Guest owns facilities)
                if (dbFacilities.length > 0) {
                    const mapped = dbFacilities.map(f => ({
                        id: f.facilityId,
                        name: f.name,
                        quantity: f.total_scans,
                        scanned_count: f.used_scans
                    }));
                    setFacilities(mapped);

                    // Set availability status
                    setFacilityStatus(
                        dbFacilities.map(f => ({
                            id: f.facilityId,
                            available_scans: Math.max(0, (f.total_scans || 0) - (f.used_scans || 0))
                        }))
                    );
                }
            } catch (e) {
                console.error("Failed to fetch facilities offline:", e);
            }
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
        const dbFacilities = await getFacilitiesForGuest(Number(eventId), uuid); // Pass eventId

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
                    available_scans: Math.max(0, (f.total_scans || 0) - (f.used_scans || 0)) // Use total_scans and used_scans
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

    // 🔐 Lock quantity when selected option is exhausted
    const isQuantityLocked = (() => {
        const remainingMain = Math.max(0, totalEntries - usedCount);

        // Main ticket selected
        if (selectedScanningOption === 'check_in') {
            return remainingMain <= 0;
        }

        // Facility selected
        const stat = facilityStatus.find(s => String(s.id) === String(selectedScanningOption));
        if (!stat) return false;

        return stat.available_scans <= 0;
    })();

    useEffect(() => {
        if (isQuantityLocked) {
            setCheckInQuantity(1);
        }
    }, [isQuantityLocked]);

    // ⚡⚡⚡ HELPER: Format Date to IST ⚡⚡⚡
    const formatToIST = (dateInput: string | number | null | undefined) => {
        if (!dateInput) return null;
        try {
            const date = new Date(typeof dateInput === 'number' ? dateInput * 1000 : dateInput);
            return date.toLocaleString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
                timeZone: 'Asia/Kolkata' // Ensure IST
            });
        } catch (e) {
            return String(dateInput);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableWithoutFeedback onPress={() => { }}>
                    <View style={styles.modalContainer}>
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
                            <ScrollView
                                style={{ flexShrink: 1 }}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                                bounces={true}
                                overScrollMode="always"
                                keyboardShouldPersistTaps="handled"
                            >
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

                                    {guestData.registration_time && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Registration Time:</Text>
                                            <Text style={styles.value}>{formatToIST(guestData.registration_time)}</Text>
                                        </View>
                                    )}

                                    <View style={styles.detailRow}>
                                        <Text style={styles.label}>Ticket Name:</Text>
                                        <Text style={styles.value}>{guestData.ticket_data?.ticket_title || guestData.ticket_title || "Standard"}</Text>
                                    </View>

                                    {guestData.ticket_data?.ticket_id && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Ticket ID:</Text>
                                            <Text style={styles.value}>{guestData.ticket_data.ticket_id}</Text>
                                        </View>
                                    )}

                                    <View style={styles.detailRow}>
                                        <Text style={styles.label}>Tickets Purchased:</Text>
                                        <Text style={styles.value}>{totalEntries}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.label}>Amount Paid:</Text>
                                        <Text style={styles.value}>{guestData.ticket_data?.amount_paid || guestData.amount || guestData.price || 0} ₹</Text>
                                    </View>

                                    {guestData.ticket_data?.payment_id && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Payment ID:</Text>
                                            <Text style={styles.value}>{guestData.ticket_data.payment_id}</Text>
                                        </View>
                                    )}

                                    {guestData.ticket_data?.payment_method && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Payment Method:</Text>
                                            <Text style={styles.value}>{guestData.ticket_data.payment_method}</Text>
                                        </View>
                                    )}

                                    {guestData.ticket_data?.payment_time && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Payment Time:</Text>
                                            <Text style={styles.value}>{formatToIST(guestData.ticket_data.payment_time)}</Text>
                                        </View>
                                    )}

                                    {guestData.registered_by && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.label}>Registered By:</Text>
                                            <Text style={styles.value}>{guestData.registered_by}</Text>
                                        </View>
                                    )}

                                    {/* Additional Details Toggle */}
                                    <View style={styles.additionalToggleRow}>
                                        <Text style={styles.additionalText}>Show additional guest details</Text>
                                        <Switch
                                            value={showAdditional}
                                            onValueChange={setShowAdditional}
                                            trackColor={{ false: "#ccc", true: "#FF8A3C" }} // Using app theme color
                                            thumbColor={"#fff"}
                                        />
                                    </View>

                                    {/* Additional Details List */}
                                    {showAdditional && guestData?.additional_form_replies?.length > 0 && (
                                        <View style={styles.additionalDetailsContainer}>
                                            {guestData.additional_form_replies.map((item: any, index: number) => (
                                                <View key={index} style={styles.additionalItem}>
                                                    <Text style={styles.additionalQuestion}>{item.question}:</Text>
                                                    <Text style={styles.additionalAnswer}>{item.answer}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

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
                                                        disabled={isQuantityLocked}
                                                        onPress={() => !isQuantityLocked && setCheckInQuantity(Math.max(1, checkInQuantity - 1))}
                                                        style={[styles.counterButton, isQuantityLocked && styles.disabledButton]}
                                                    >
                                                        <Text style={styles.counterButtonText}>-</Text>
                                                    </TouchableOpacity>

                                                    <View style={styles.counterValueContainer}>
                                                        <Text style={styles.counterValue}>{checkInQuantity}</Text>
                                                    </View>

                                                    <TouchableOpacity
                                                        disabled={isQuantityLocked}
                                                        onPress={() => {
                                                            if (isQuantityLocked) return;

                                                            let maxLimit = 1;
                                                            if (selectedScanningOption === 'check_in') {
                                                                const remaining = Math.max(0, totalEntries - usedCount);
                                                                maxLimit = remaining;
                                                            } else {
                                                                const stat = facilityStatus.find(s => String(s.id) === String(selectedScanningOption));
                                                                maxLimit = stat ? stat.available_scans : 1;
                                                            }
                                                            setCheckInQuantity(Math.min(checkInQuantity + 1, maxLimit));
                                                        }}
                                                        style={[styles.counterButton, isQuantityLocked && styles.disabledButton]}
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
                                                                const rowsAffected = await performGateCheckIn(Number(eventId), uuid);

                                                                if (rowsAffected === 0) {
                                                                    Toast.show({ type: 'error', text1: 'Check-in Failed', text2: 'Guest already checked in' });
                                                                    setLoading(false);
                                                                    return;
                                                                }

                                                                Toast.show({ type: 'success', text1: 'Success', text2: 'Checked in locally' });

                                                                // INLINE FIX: Explicit refresh to prove DB update
                                                                const { getGuestByUuid, getFacilitiesForGuest } = require('../db');
                                                                const dbGuest = await getGuestByUuid(uuid);

                                                                // Refresh Guest Data
                                                                if (dbGuest) {
                                                                    setGuestData((prev: any) => ({
                                                                        ...prev,
                                                                        used_entries: dbGuest.used_entries,
                                                                        checked_in_count: dbGuest.used_entries,
                                                                        status: dbGuest.used_entries > 0 ? 'checked_in' : prev.status
                                                                    }));
                                                                }

                                                                // Refresh Facilities (Unlocking depends on used_entries)
                                                                const dbFacilities = await getFacilitiesForGuest(Number(eventId), uuid);
                                                                setFacilityStatus(
                                                                    dbFacilities.map((f: any) => ({
                                                                        id: f.facilityId,
                                                                        available_scans: Math.max(0, (f.total_scans || 0) - (f.used_scans || 0))
                                                                    }))
                                                                );

                                                                // 🔥 Kotlin behavior: AUTO SWITCH to first available facility
                                                                const firstAvailable = dbFacilities.find((f: any) =>
                                                                    (f.total_scans || 0) - (f.used_scans || 0) > 0
                                                                );
                                                                if (firstAvailable) {
                                                                    setSelectedScanningOption(firstAvailable.facilityId);
                                                                }

                                                                DeviceEventEmitter.emit('REFRESH_GUEST_LIST');
                                                                setLoading(false);
                                                                return;
                                                            } else {
                                                                // Facility Check-In
                                                                const updated = await updateFacilityCheckInLocal(Number(eventId), uuid, Number(selectedScanningOption), checkInQuantity);

                                                                if (updated > 0) {
                                                                    Toast.show({ type: 'success', text1: 'Success', text2: 'Facility checked in locally' });
                                                                    await refreshOfflineData(uuid);
                                                                    DeviceEventEmitter.emit('REFRESH_GUEST_LIST');
                                                                    setLoading(false);
                                                                    return;
                                                                } else {
                                                                    Toast.show({ type: 'error', text1: 'Check-in Failed', text2: 'Facility already checked in or not available' });
                                                                    setLoading(false);
                                                                    return;
                                                                }
                                                            }
                                                        }

                                                        // ONLINE LOGIC (Bypassed if offline)
                                                        let payload: any = {
                                                            event_id: Number(eventId),
                                                            guest_id: guestData?.id || guestData?.guest_id,
                                                            category_check_in_count: "",
                                                            other_category_check_in_count: 0,
                                                            ticket_id: guestData?.ticket_data?.ticket_id || guestData?.ticket_id,
                                                            check_in_count: checkInQuantity
                                                        };

                                                        if (selectedScanningOption !== 'check_in') {
                                                            payload.guest_facility_id = String(selectedScanningOption);
                                                        }

                                                        const res = await checkInEventUser(eventId, payload);

                                                        if (res && (res.success || res.id)) {
                                                            Toast.show({ type: 'success', text1: 'Success', text2: 'Checked in successfully' });

                                                            // Refresh data locally
                                                            const uuid = getGuestUUID(guestData);
                                                            if (selectedScanningOption === 'check_in' && uuid) {
                                                                try {
                                                                    await updateTicketStatusLocal(uuid, 'checked_in', 1, false);
                                                                    await refreshOfflineData(uuid);
                                                                } catch (err) {
                                                                    console.log('Error updating local ticket:', err);
                                                                }
                                                            } else if (uuid) {
                                                                await refreshOfflineData(uuid);
                                                            }

                                                            DeviceEventEmitter.emit('REFRESH_GUEST_LIST');
                                                            setCheckInStep('initial');
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
                    </View>

                </TouchableWithoutFeedback>
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
        color: '#666',
        fontWeight: '600'
    },
    // Additional Details Styles
    additionalToggleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: verticalScale(16),
        marginBottom: verticalScale(10), // Add some spacing before buttons
    },
    additionalText: {
        fontSize: moderateScale(14),
        fontWeight: "500",
        color: '#333',
    },
    additionalDetailsContainer: {
        marginTop: verticalScale(5),
        marginBottom: verticalScale(15),
        padding: scale(10),
        backgroundColor: '#F9F9F9',
        borderRadius: moderateScale(8),
    },
    additionalItem: {
        flexDirection: "row",
        marginBottom: verticalScale(8),
        flexWrap: 'wrap', // Allow wrapping for long addresses
    },
    additionalQuestion: {
        fontWeight: "600",
        marginRight: scale(6),
        color: '#444',
        fontSize: moderateScale(14),
    },
    additionalAnswer: {
        flex: 1,
        color: '#333',
        fontSize: moderateScale(14),
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
