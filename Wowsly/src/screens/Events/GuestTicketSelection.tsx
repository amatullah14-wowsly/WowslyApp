import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, SafeAreaView, Alert, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import { getEventTickets, selectGuestTicket, getEventDetails } from '../../api/event';
import BackButton from '../../components/BackButton';
import Toast from 'react-native-toast-message';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

const GuestTicketSelection = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { eventId, guestUuid, registeredBy, eventName } = route.params || {};

    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, isTablet), [scale, verticalScale, moderateScale, isTablet]);

    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [ticketQuantities, setTicketQuantities] = useState<Record<number, number>>({});
    const [isMultipleTickets, setIsMultipleTickets] = useState(true);

    const [sendToWhatsapp, setSendToWhatsapp] = useState(true);
    const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);

    useEffect(() => {
        if (eventId) {
            fetchTickets();
        }
    }, [eventId]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            // Fetch tickets and event details in parallel
            const [ticketsRes, detailsRes] = await Promise.all([
                getEventTickets(eventId, { include_hidden_tickets: 0, has_split_share: 0 }),
                getEventDetails(eventId)
            ]);

            if (detailsRes && detailsRes.data) {
                const setting = detailsRes.data.is_multiple_tickets;
                if (setting !== undefined) {
                    setIsMultipleTickets(setting === 1 || setting === true);
                }
            }

            if (ticketsRes && ticketsRes.data) {
                setTickets(ticketsRes.data);

                // Fallback: Check if is_multiple_tickets is in tickets response too
                if (ticketsRes.is_multiple_tickets !== undefined) {
                    setIsMultipleTickets(ticketsRes.is_multiple_tickets === 1 || ticketsRes.is_multiple_tickets === true);
                }

                if (ticketsRes.data.length > 0) {
                    // Initialize with 0 for all tickets
                    const initialQuantities: Record<number, number> = {};
                    ticketsRes.data.forEach((t: any) => initialQuantities[t.id] = 0);
                    setTicketQuantities(initialQuantities);
                }
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
            Toast.show({ type: 'error', text1: 'Failed to load tickets' });
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityChange = (ticketId: number, change: number) => {
        const currentQ = ticketQuantities[ticketId] || 0;
        const newQ = currentQ + change;
        if (newQ >= 0) {
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket && ticket.max_ticket_limit && newQ > ticket.max_ticket_limit) {
                Toast.show({ type: 'info', text1: `Max limit is ${ticket.max_ticket_limit}` });
                return;
            }

            if (!isMultipleTickets && change > 0) {
                // If multiple tickets are not allowed, reset all other tickets to 0
                const updatedQuantities: Record<number, number> = {};
                tickets.forEach(t => {
                    updatedQuantities[t.id] = t.id === ticketId ? newQ : 0;
                });
                setTicketQuantities(updatedQuantities);

                // If switching tickets, also reset selected facilities as they might be ticket-specific
                if (currentQ === 0) {
                    setSelectedFacilities([]);
                }
            } else {
                setTicketQuantities(prev => ({ ...prev, [ticketId]: newQ }));
            }
        }
    };

    const handleSubmit = async () => {
        const selectedTickets = tickets.filter(t => (ticketQuantities[t.id] || 0) > 0);
        if (selectedTickets.length === 0) {
            Toast.show({ type: 'error', text1: 'Please select at least one ticket' });
            return;
        }

        // Determine if there are paid tickets
        const hasPaidTicket = selectedTickets.some(t => (t.amount && Number(t.amount) > 0));

        // Aggregate facilities from all selected tickets (de-duplicated)
        const allFacilities = Array.from(new Map(selectedTickets.flatMap(t => t.facilities || []).map(f => [f.id, f])).values());
        const includedFacilitiesList = allFacilities.filter((f: any) => f.is_included === 1 || f.is_free === 1);
        const optionalFacilitiesList = allFacilities.filter((f: any) => f.is_included === 0 && f.is_free === 0);

        // Facility Total Calculation
        let facilityTotal = 0;

        selectedTickets.forEach(ticket => {
            const qty = ticketQuantities[ticket.id] || 0;

            const ticketFacilities = (ticket.facilities || []).filter((f: any) =>
                selectedFacilities.includes(f.id) && f.is_free == 0 && f.is_included == 0
            );

            const perTicketFacilityCost = ticketFacilities.reduce(
                (sum: number, f: any) => sum + Number(f.price || 0),
                0
            );

            facilityTotal += perTicketFacilityCost * qty;
        });

        const ticketTotal = selectedTickets.reduce((sum, t) => sum + (Number(t.amount || 0) * ticketQuantities[t.id]), 0);
        const totalAmount = ticketTotal + facilityTotal + (sendToWhatsapp ? 2 : 0);

        const payload = {
            amount_currency: selectedTickets[0]?.currency || "rupees",
            facility_details: [
                ...includedFacilitiesList.map((f: any) => f.id),
                ...selectedFacilities
            ],
            guest_uuid: guestUuid,
            registered_by: registeredBy,
            selected_tickets: selectedTickets.map(t => ({
                ticket_id: t.id,
                ticket_name: t.title,
                ticket_count: ticketQuantities[t.id],
                ticket_price: t.amount || 0,
                facilities: t.facilities || []
            })),
            send_to_whatsapp: sendToWhatsapp ? 1 : 0,
            total_amount: totalAmount
        };

        setLoading(true);
        const res = await selectGuestTicket(eventId, payload);
        setLoading(false);

        if (res && res.data) {
            if (hasPaidTicket) {
                // Navigate to Payment Screen for paid tickets
                navigation.navigate("GuestPayment", {
                    eventId,
                    guestDetails: {
                        name: route.params?.guestDetails?.name || "Guest",
                        mobile: route.params?.guestDetails?.mobile || "",
                        email: route.params?.guestDetails?.email || ""
                    },
                    facilities: [
                        ...includedFacilitiesList,
                        ...optionalFacilitiesList.filter((f: any) => selectedFacilities.includes(f.id))
                    ],
                    ticketResponse: res,
                    sendToWhatsapp: sendToWhatsapp,
                    registeredBy: registeredBy,
                    eventName: eventName,
                    selectedTickets: selectedTickets.map(t => ({
                        id: t.id,
                        title: t.title,
                        quantity: ticketQuantities[t.id],
                        price: t.amount,
                        currency: t.currency,
                        facilities: (t.facilities || []).filter((f: any) =>
                            f.is_free === 1 || f.is_included === 1 || selectedFacilities.includes(f.id)
                        )
                    }))
                });
            } else {
                // Direct success for free tickets
                Alert.alert("Success", "Ticket Selected Successfully!", [{ text: "OK", onPress: () => navigation.navigate("EventDashboard", { eventId }) }]);
            }
        } else {
            Alert.alert("Error", res?.message || "Selection failed");
        }
    };

    const selectedTickets = useMemo(() => tickets.filter(t => (ticketQuantities[t.id] || 0) > 0), [tickets, ticketQuantities]);

    const includedFacilities = useMemo(() => {
        const allFacilities = selectedTickets.flatMap(t => t.facilities || []);
        // Remove duplicates if same facility exists in multiple tickets
        const uniqueFacilities = Array.from(new Map(allFacilities.map(f => [f.id, f])).values());
        return uniqueFacilities.filter((f: any) => f.is_included === 1 || f.is_free === 1);
    }, [selectedTickets]);

    const optionalFacilities = useMemo(() => {
        const allFacilities = selectedTickets.flatMap(t => t.facilities || []);
        const uniqueFacilities = Array.from(new Map(allFacilities.map(f => [f.id, f])).values());
        return uniqueFacilities.filter((f: any) => f.is_included === 0 && f.is_free === 0);
    }, [selectedTickets]);

    return (
        <ResponsiveContainer maxWidth={isTablet ? 800 : 420}>
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                {/* Header */}
                <View style={styles.header}>
                    <BackButton onPress={() => navigation.goBack()} />
                    <Text style={styles.headerTitle}>Select Ticket</Text>
                    <View style={{ width: scale(40) }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    {/* Section Title */}
                    <Text style={styles.sectionTitle}>Available Tickets</Text>

                    {/* Grid of Tickets */}
                    <View style={styles.ticketGrid}>
                        {tickets.map((ticket) => {
                            const qty = ticketQuantities[ticket.id] || 0;
                            const isSelected = qty > 0;
                            const currencySymbol = (ticket.currency === 'rupees' || ticket.currency === 'INR') ? '₹' : (ticket.currency || '₹');

                            return (
                                <View
                                    key={ticket.id}
                                    style={[styles.ticketCard, isSelected && styles.ticketCardSelected]}
                                >
                                    <View style={styles.cardHeaderSmall}>
                                        <Text style={styles.ticketTitle}>{ticket.title}</Text>
                                        <TouchableOpacity onPress={() => {/* Show Info Modal */ }}>
                                            <View style={styles.infoIconWrapper}>
                                                <Text style={styles.infoIconText}>i</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.priceContainer}>
                                        <Text style={styles.priceLabel}>Price: {ticket.amount > 0 ? `${ticket.amount} ${currencySymbol}` : 'Free'}</Text>
                                    </View>

                                    <View style={styles.qtyContainer}>
                                        <Text style={styles.qtyLabel}>Number of tickets:</Text>
                                        <View style={styles.qtyControls}>
                                            <TouchableOpacity
                                                onPress={() => handleQuantityChange(ticket.id, -1)}
                                                style={[styles.qtyBtn, qty === 0 && styles.qtyBtnDisabled]}
                                                disabled={qty === 0}
                                            >
                                                <View style={styles.minusBtn}>
                                                    <View style={styles.minusLine} />
                                                </View>
                                            </TouchableOpacity>

                                            <View style={styles.qtyBox}>
                                                <Text style={styles.qtyText}>{qty}</Text>
                                            </View>

                                            <TouchableOpacity onPress={() => handleQuantityChange(ticket.id, 1)} style={styles.qtyBtn}>
                                                <View style={styles.plusBtn}>
                                                    <View style={styles.plusLineH} />
                                                    <View style={styles.plusLineV} />
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Unified Facilities Section */}
                    {(includedFacilities.length > 0 || optionalFacilities.length > 0) && (
                        <View style={styles.facilitiesCard}>
                            {/* Included Facilities */}
                            {includedFacilities.length > 0 && (
                                <View style={styles.facilitySection}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(10) }}>
                                        <Text style={{ fontSize: moderateScale(14), marginRight: scale(6) }}>✅</Text>
                                        <Text style={styles.amenitiesTitle}>Included with Ticket</Text>
                                    </View>
                                    <View style={styles.chipContainer}>
                                        {includedFacilities.map((facility: any, index: number) => (
                                            <View key={index} style={styles.amenityChip}>
                                                <Text style={styles.amenityText}>{facility.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Divider if both exist */}
                            {includedFacilities.length > 0 && optionalFacilities.length > 0 && (
                                <View style={styles.sectionDivider} />
                            )}

                            {/* Optional Paid Facilities */}
                            {optionalFacilities.length > 0 && (
                                <View style={styles.facilitySection}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(10) }}>
                                        <Text style={{ fontSize: moderateScale(14), marginRight: scale(6) }}>➕</Text>
                                        <Text style={styles.amenitiesTitle}>Additional Add-ons</Text>
                                    </View>

                                    {optionalFacilities.map((facility: any) => {
                                        const checked = selectedFacilities.includes(facility.id);
                                        const currencySymbol = (facility.currency === 'rupees' || facility.currency === 'INR') ? '₹' : facility.currency;

                                        return (
                                            <TouchableOpacity
                                                key={facility.id}
                                                style={[styles.addOnRow, checked && styles.addOnRowSelected]}
                                                onPress={() => {
                                                    setSelectedFacilities(prev =>
                                                        prev.includes(facility.id)
                                                            ? prev.filter(id => id !== facility.id)
                                                            : [...prev, facility.id]
                                                    );
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.addOnTitle, checked && styles.addOnTitleSelected]}>{facility.name}</Text>
                                                    <Text style={styles.addOnPrice}>+ {currencySymbol}{facility.price}</Text>
                                                </View>

                                                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                                                    {checked && <Text style={styles.checkmark}>✓</Text>}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.divider} />

                    {/* Removed single Quantity Selector as it's now per ticket */}

                    {/* WhatsApp Toggle */}
                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => setSendToWhatsapp(!sendToWhatsapp)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.whatsappText}>Get ticket on WhatsApp</Text>
                        <View style={[styles.checkbox, sendToWhatsapp && styles.checkboxChecked]}>
                            {sendToWhatsapp && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                    </TouchableOpacity>

                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={[styles.nextButton, selectedTickets.length === 0 && styles.nextButtonDisabled]} onPress={handleSubmit} disabled={loading || selectedTickets.length === 0}>
                        <Text style={styles.nextButtonText}>{loading ? 'Processing...' : 'Confirm Selection'}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </ResponsiveContainer>
    );
};

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, isTablet: boolean = false) => StyleSheet.create({
    header: {
        width: '100%',
        paddingVertical: scale(16),
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        paddingHorizontal: scale(20),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: moderateScale(FontSize.xl),
        fontWeight: '600',
        color: '#333',
        flex: 1,
        textAlign: 'center',
        marginRight: scale(40)
    },
    content: {
        padding: scale(20),
        paddingBottom: verticalScale(100),
        width: '100%',
        alignSelf: 'center',
    },
    sectionTitle: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '600',
        color: '#333',
        marginBottom: verticalScale(15),
    },
    ticketGrid: {
        flexDirection: isTablet ? 'row' : 'column',
        flexWrap: 'wrap',
        gap: scale(15),
    },
    ticketCard: {
        backgroundColor: 'white',
        borderRadius: scale(10),
        padding: scale(16),
        borderWidth: 1,
        borderColor: '#EFEFEF',
        width: isTablet ? '48%' : '100%',
        minHeight: verticalScale(160),
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowOpacity: 0.04,
        shadowRadius: scale(4),
        elevation: 2,
    },
    ticketCardSelected: {
        borderColor: '#FF8A3C',
        borderWidth: 1.5,
    },
    cardHeaderSmall: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    ticketTitle: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '700',
        color: '#1E232C',
        flex: 1,
        marginRight: scale(10),
    },
    infoIconWrapper: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        backgroundColor: '#1C274C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoIconText: {
        color: 'white',
        fontSize: moderateScale(12),
        fontWeight: '800',
        fontStyle: 'italic',
    },
    priceContainer: {
        marginTop: verticalScale(8),
    },
    priceLabel: {
        fontSize: moderateScale(FontSize.md),
        color: '#666',
        fontWeight: '500',
    },
    qtyContainer: {
        marginTop: verticalScale(15),
    },
    qtyLabel: {
        fontSize: moderateScale(FontSize.md),
        color: '#666',
        marginBottom: verticalScale(10),
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: scale(12),
    },
    qtyBtn: {
        width: scale(28),
        height: scale(28),
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyBtnDisabled: {
        opacity: 0.5,
    },
    minusBtn: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        borderWidth: 1.5,
        borderColor: '#FF8A3C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    minusLine: {
        width: scale(12),
        height: 1.5,
        backgroundColor: '#FF8A3C',
    },
    plusBtn: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        borderWidth: 1.5,
        borderColor: '#FF8A3C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusLineH: {
        width: scale(12),
        height: 1.5,
        backgroundColor: '#FF8A3C',
        position: 'absolute',
    },
    plusLineV: {
        width: 1.5,
        height: scale(12),
        backgroundColor: '#FF8A3C',
        position: 'absolute',
    },
    qtyBox: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#D0D0D0',
        borderRadius: scale(4),
        paddingHorizontal: scale(18),
        paddingVertical: verticalScale(6),
        minWidth: scale(65),
        alignItems: 'center',
    },
    qtyText: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '600',
        color: '#1E232C',
    },
    footer: {
        padding: scale(20),
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    nextButton: {
        backgroundColor: '#FF8A3C',
        paddingVertical: verticalScale(16),
        borderRadius: scale(12),
        alignItems: 'center',
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.2,
        shadowRadius: scale(8),
        elevation: 4,
    },
    nextButtonDisabled: {
        backgroundColor: '#D1D1D1',
        shadowOpacity: 0,
        elevation: 0,
    },
    nextButtonText: {
        color: 'white',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    detailsContainer: {
        marginTop: verticalScale(25),
        backgroundColor: 'white',
        borderRadius: scale(12),
        padding: scale(16),
    },
    amenitiesTitle: {
        fontSize: moderateScale(FontSize.sm),
        fontWeight: '600',
        color: '#555',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(10),
    },
    amenityChip: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(6),
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    amenityText: {
        fontSize: moderateScale(FontSize.xs),
        color: '#555',
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#EAEAEA',
        marginVertical: verticalScale(25),
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(20),
        backgroundColor: 'white',
        padding: scale(16),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: '#EFEFEF'
    },
    whatsappText: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        fontWeight: '500',
    },
    checkbox: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(6),
        borderWidth: 2,
        borderColor: '#D0D0D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#FF8A3C',
        borderColor: '#FF8A3C',
    },
    checkmark: {
        color: 'white',
        fontSize: moderateScale(FontSize.sm),
        fontWeight: 'bold',
    },
    facilitiesCard: {
        marginTop: verticalScale(25),
        backgroundColor: 'white',
        borderRadius: scale(12),
        padding: scale(16),
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: verticalScale(1) },
        shadowOpacity: 0.03,
        shadowRadius: scale(2),
        elevation: 1,
    },
    facilitySection: {
        marginBottom: verticalScale(5),
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#EAEAEA',
        marginVertical: verticalScale(15),
    },
    addOnRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(12),
        borderRadius: scale(8),
        marginBottom: verticalScale(8),
        backgroundColor: '#FCFCFC',
        borderWidth: 1,
        borderColor: '#F5F5F5',
    },
    addOnRowSelected: {
        backgroundColor: '#FFF8F4',
        borderColor: '#FFE0CC',
    },
    addOnTitle: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        fontWeight: '500',
    },
    addOnTitleSelected: {
        color: '#FF8A3C',
        fontWeight: '600',
    },
    addOnPrice: {
        fontSize: moderateScale(FontSize.sm),
        color: '#FF8A3C',
        fontWeight: '600',
        marginTop: verticalScale(2),
    }
});

export default GuestTicketSelection;
