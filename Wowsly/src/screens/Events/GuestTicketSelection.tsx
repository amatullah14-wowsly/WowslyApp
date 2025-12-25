import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, SafeAreaView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { getEventTickets, selectGuestTicket } from '../../api/event';
import BackButton from '../../components/BackButton';
import Toast from 'react-native-toast-message';

const GuestTicketSelection = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, guestUuid, registeredBy } = route.params || {};

    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [sendToWhatsapp, setSendToWhatsapp] = useState(true);

    useEffect(() => {
        if (eventId) {
            fetchTickets();
        }
    }, [eventId]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await getEventTickets(eventId, { include_hidden_tickets: 0, has_split_share: 0 });
            if (res && res.data) {
                setTickets(res.data);
                if (res.data.length > 0) {
                    setSelectedTicketId(res.data[0].id);
                }
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
            Toast.show({ type: 'error', text1: 'Failed to load tickets' });
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityChange = (change: number) => {
        const newQ = quantity + change;
        if (newQ >= 1) {
            const ticket = tickets.find(t => t.id === selectedTicketId);
            if (ticket && ticket.max_ticket_limit && newQ > ticket.max_ticket_limit) {
                Toast.show({ type: 'info', text1: `Max limit is ${ticket.max_ticket_limit}` });
                return;
            }
            setQuantity(newQ);
        }
    };

    const handleSubmit = async () => {
        if (!selectedTicketId) return;

        const ticket = tickets.find(t => t.id === selectedTicketId);
        if (!ticket) return;

        const payload = {
            amount_currency: ticket.currency || "rupees",
            facility_details: ticket.facilities ? ticket.facilities.map((f: any) => f.id) : [],
            guest_uuid: guestUuid,
            registered_by: registeredBy,
            selected_tickets: [{
                ticket_id: ticket.id,
                ticket_name: ticket.title,
                ticket_count: quantity,
                ticket_price: ticket.amount || 0,
                facilities: ticket.facilities || []
            }],
            send_to_whatsapp: sendToWhatsapp ? 1 : 0,
            total_amount: (ticket.amount || 0) * quantity
        };

        setLoading(true);
        const res = await selectGuestTicket(eventId, payload);
        setLoading(false);

        if (res && res.data) {
            Alert.alert("Success", "Ticket Selected Successfully!", [{ text: "OK", onPress: () => navigation.navigate("EventDashboard", { eventId }) }]);
        } else {
            Alert.alert("Error", res?.message || "Selection failed");
        }
    };

    const selectedTicket = tickets.find(t => t.id === selectedTicketId);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Select Ticket</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Section Title */}
                <Text style={styles.sectionTitle}>Available Tickets</Text>

                {/* Vertical List of Tickets */}
                <View style={styles.ticketList}>
                    {tickets.map((ticket) => {
                        const isSelected = selectedTicketId === ticket.id;
                        return (
                            <TouchableOpacity
                                key={ticket.id}
                                style={[styles.ticketCard, isSelected && styles.ticketCardSelected]}
                                onPress={() => { setSelectedTicketId(ticket.id); setQuantity(1); }}
                                activeOpacity={0.9}
                            >
                                <View style={styles.cardContent}>
                                    {/* Radio Indicator */}
                                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                                        {isSelected && <View style={styles.radioDot} />}
                                    </View>

                                    {/* Ticket Info */}
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={[styles.ticketTitle, isSelected && styles.ticketTitleSelected]}>{ticket.title}</Text>
                                        </View>
                                        <Text style={styles.ticketType}>{ticket.amount > 0 ? `${ticket.currency} ${ticket.amount}` : 'Free'}</Text>
                                    </View>

                                    {/* Checkmark or Info (Optional, keeping clean for now) */}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Selected Ticket Details (Amenities) */}
                {selectedTicket && selectedTicket.facilities && selectedTicket.facilities.length > 0 && (
                    <View style={styles.detailsContainer}>
                        <Text style={styles.amenitiesTitle}>Included Facilities</Text>
                        <View style={styles.chipContainer}>
                            {selectedTicket.facilities.map((facility: any, index: number) => (
                                <View key={index} style={styles.amenityChip}>
                                    <Text style={styles.amenityText}>{facility.name}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.divider} />

                {/* Quantity Selector */}
                <View style={styles.actionRow}>
                    <Text style={styles.quantityLabel}>Number of tickets</Text>
                    <View style={styles.quantityControls}>
                        <TouchableOpacity onPress={() => handleQuantityChange(-1)} style={styles.controlButton}>
                            <Text style={styles.controlButtonText}>-</Text>
                        </TouchableOpacity>

                        <View style={styles.quantityBox}>
                            <Text style={styles.quantityText}>{quantity}</Text>
                        </View>

                        <TouchableOpacity onPress={() => handleQuantityChange(1)} style={styles.controlButton}>
                            <Text style={styles.controlButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

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

            {/* Bottom Button */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.nextButton} onPress={handleSubmit} disabled={loading}>
                    <Text style={styles.nextButtonText}>{loading ? 'Processing...' : 'Confirm Selection'}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
        fontSize: moderateScale(18),
        fontWeight: '600',
        color: '#333',
        flex: 1,
        textAlign: 'center',
        marginRight: 40
    },
    content: {
        padding: scale(20),
        paddingBottom: verticalScale(100),
    },
    sectionTitle: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#333',
        marginBottom: verticalScale(15),
    },
    ticketList: {
        gap: verticalScale(12),
    },
    ticketCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: scale(16),
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    ticketCardSelected: {
        borderColor: '#FF8A3C',
        backgroundColor: '#FFF8F4',
        borderWidth: 1.5
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(15),
    },
    radioCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D0D0D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleSelected: {
        borderColor: '#FF8A3C',
    },
    radioDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF8A3C',
    },
    ticketTitle: {
        fontSize: moderateScale(16),
        fontWeight: '500',
        color: '#333',
    },
    ticketTitleSelected: {
        color: '#FF8A3C',
        fontWeight: '600',
    },
    ticketType: {
        fontSize: moderateScale(13),
        color: '#888',
        marginTop: 2,
    },
    detailsContainer: {
        marginTop: verticalScale(25),
        backgroundColor: 'white',
        borderRadius: 12,
        padding: scale(16),
    },
    amenitiesTitle: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#555',
        marginBottom: verticalScale(12),
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
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    amenityText: {
        fontSize: moderateScale(13),
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
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF'
    },
    quantityLabel: {
        fontSize: moderateScale(15),
        fontWeight: '500',
        color: '#333',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(15),
    },
    controlButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF1E8', // Light orange bg
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlButtonText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FF8A3C',
        lineHeight: 22,
    },
    quantityBox: {
        minWidth: 30,
        alignItems: 'center',
    },
    quantityText: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#333',
    },
    whatsappText: {
        fontSize: moderateScale(15),
        color: '#333',
        fontWeight: '500',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
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
        fontSize: 14,
        fontWeight: 'bold',
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
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    nextButtonText: {
        color: 'white',
        fontSize: moderateScale(16),
        fontWeight: '700',
        letterSpacing: 0.5,
    }
});

export default GuestTicketSelection;
