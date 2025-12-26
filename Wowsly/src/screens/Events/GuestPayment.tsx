import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import BackButton from '../../components/BackButton';
import { payViaCash } from '../../api/event';
import Toast from 'react-native-toast-message';

const GuestPayment = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, guestDetails, ticketResponse, registeredBy } = route.params || {};

    const [loading, setLoading] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'Cash' | 'Online'>('Cash');
    const [sendToWhatsapp, setSendToWhatsapp] = useState(route.params?.sendToWhatsapp || false);
    const [showConfirm, setShowConfirm] = useState(false);

    const ticketData = ticketResponse?.data || {};
    const amountToPay = ticketData.amount_to_pay || 0;
    const currencySymbol = (ticketData.currency === 'rupees' || ticketData.currency === 'INR') ? '₹' : (ticketData.currency || '₹');

    const handleBack = () => navigation.goBack();

    const handleSubmit = () => {
        if (paymentMode === 'Cash') {
            setShowConfirm(true);
        } else {
            Alert.alert("Info", "Online payment is not supported yet.");
        }
    };

    const processCashPayment = async () => {
        setShowConfirm(false);
        setLoading(true);
        try {
            // Fix 1: Send ALL facility IDs for the selected ticket
            const facilityIds = (route.params?.facilities || []).map((f: any) => f.id);

            // Fix 4: Use correct payload shape (final)
            const payload = {
                guest_ticket_id: ticketData.id,
                payment_amount: amountToPay,
                amount_currency: "INR",
                amount_currency_symbol: "₹",
                current_timezone: "Asia/Calcutta",
                facility_details: facilityIds,
                registered_by: (registeredBy && Number(registeredBy) > 0) ? Number(registeredBy) : null,
                send_to_whatsapp: sendToWhatsapp ? 1 : 0
            };

            const res = await payViaCash(eventId, payload);

            if (res && (res.data || res.payment_id)) {
                Alert.alert("Success", "Payment Recorded Successfully!", [
                    {
                        text: "OK", onPress: () => {
                            navigation.navigate('EventDashboard', { eventId: eventId });
                        }
                    }
                ]);
            } else {
                Toast.show({ type: 'error', text1: res?.message || "Payment failed" });
            }
        } catch (error) {
            console.error("Payment Error:", error);
            Toast.show({ type: 'error', text1: "An error occurred" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={handleBack} />
                <Text style={styles.headerTitle}>Payment Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Internal Title */}
                <Text style={styles.screenHeading}>Confirm & Pay</Text>

                {/* Details Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardInternalTitle}>Booking Summary</Text>
                    </View>

                    <View style={styles.cardBody}>
                        {/* Guest Name */}
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Attendee Name</Text>
                            <Text style={styles.value}>{guestDetails?.name || 'Guest'}</Text>
                        </View>

                        {/* Guest Mobile */}
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Attendee Mobile Number</Text>
                            <Text style={styles.value}>{guestDetails?.mobile || '-'}</Text>
                        </View>

                        {/* Guest Email */}
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Attendee Email</Text>
                            <Text style={styles.value}>{guestDetails?.email || '-'}</Text>
                        </View>

                        {/* Event Name */}
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Event Name</Text>
                            <Text style={styles.value}>Trip</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Ticket Info */}
                        <View style={styles.ticketSummary}>
                            <View style={styles.ticketRow}>
                                <Text style={styles.ticketName}>{ticketData.ticket_name || ticketData.title || 'Ticket'}</Text>
                                <Text style={styles.ticketPrice}>Per Ticket Price: {ticketData.per_ticket_price} {currencySymbol}</Text>
                            </View>
                            <View style={styles.ticketRow}>
                                <Text style={styles.ticketQuantity}>Qty: {ticketData.tickets_bought}</Text>
                                <Text style={styles.itemTotal}>Total Ticket Amount: {Number(ticketData.per_ticket_price) * Number(ticketData.tickets_bought)} {currencySymbol}</Text>
                            </View>
                        </View>

                        {/* Facilities (Dynamic) */}
                        {(route.params?.facilities || []).map((facility: any, index: number) => (
                            <View key={index} style={styles.infoRow}>
                                <Text style={styles.label}>{facility.name || facility.facility_name || 'Facility'}</Text>
                                <Text style={styles.value}>{Number(facility.amount) > 0 ? `${facility.amount} ${currencySymbol}` : `0 ${currencySymbol}`}</Text>
                            </View>
                        ))}

                        <View style={styles.divider} />

                        {/* Total */}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Amount to pay</Text>
                            <Text style={styles.totalValue}>{amountToPay} {currencySymbol}</Text>
                        </View>
                    </View>
                </View>

                {/* WhatsApp Checkbox */}
                <TouchableOpacity
                    style={styles.whatsappRow}
                    onPress={() => setSendToWhatsapp(!sendToWhatsapp)}
                    activeOpacity={0.8}
                >
                    <View style={[styles.checkbox, sendToWhatsapp && styles.checkboxChecked]}>
                        {sendToWhatsapp && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.whatsappText}>Send ticket to WhatsApp</Text>
                </TouchableOpacity>

                {/* Payment Mode Selection */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Payment Mode</Text>
                </View>

                <View style={styles.paymentContainer}>
                    <TouchableOpacity
                        style={[styles.paymentOption, paymentMode === 'Cash' && styles.paymentOptionSelected]}
                        onPress={() => setPaymentMode('Cash')}
                        activeOpacity={0.9}
                    >
                        <View style={styles.paymentInfo}>
                            <View style={[styles.radioOuter, paymentMode === 'Cash' && styles.radioOuterSelected]}>
                                {paymentMode === 'Cash' && <View style={styles.radioInner} />}
                            </View>
                            <Text style={[styles.paymentText, paymentMode === 'Cash' && styles.paymentTextSelected]}>Cash</Text>
                        </View>
                        {paymentMode === 'Cash' && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Selected</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.paymentOption, paymentMode === 'Online' && styles.paymentOptionSelected]}
                        onPress={() => setPaymentMode('Online')}
                        activeOpacity={0.9}
                    >
                        <View style={styles.paymentInfo}>
                            <View style={[styles.radioOuter, paymentMode === 'Online' && styles.radioOuterSelected]}>
                                {paymentMode === 'Online' && <View style={styles.radioInner} />}
                            </View>
                            <Text style={[styles.paymentText, paymentMode === 'Online' && styles.paymentTextSelected]}>Online</Text>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
                    <Text style={styles.submitButtonText}>{loading ? 'Processing...' : `Pay ${amountToPay} ${currencySymbol}`}</Text>
                </TouchableOpacity>
            </View>

            {/* Confirmation Modal */}
            <Modal
                visible={showConfirm}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowConfirm(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cash Received?</Text>
                        <Text style={styles.modalMessage}>Have you received the cash payment?</Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowConfirm(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={processCashPayment}
                            >
                                <Text style={styles.confirmButtonText}>Yes, Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default GuestPayment;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(12),
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        flex: 1,
        marginRight: 40
    },
    content: {
        padding: scale(20),
        paddingBottom: verticalScale(100),
    },
    screenHeading: {
        fontSize: moderateScale(22),
        fontWeight: '700',
        color: '#1E232C',
        marginBottom: verticalScale(20),
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: verticalScale(20),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    cardHeader: {
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        backgroundColor: '#FCFCFC',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    cardInternalTitle: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: '#555',
    },
    cardBody: {
        padding: scale(20),
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: verticalScale(12),
    },
    label: {
        fontSize: moderateScale(14),
        color: '#888',
        fontWeight: '500',
    },
    value: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '600',
        maxWidth: '60%', // Prevent overflow for long emails
        textAlign: 'right'
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: verticalScale(12),
    },
    ticketSummary: {
        marginVertical: verticalScale(5),
    },
    ticketRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: verticalScale(6),
    },
    ticketName: {
        fontSize: moderateScale(15),
        color: '#333',
        fontWeight: '600',
    },
    ticketPrice: {
        fontSize: moderateScale(13),
        color: '#555',
        fontWeight: '500',
    },
    ticketQuantity: {
        fontSize: moderateScale(13),
        color: '#888',
    },
    itemTotal: {
        fontSize: moderateScale(13),
        color: '#333',
        fontWeight: '600',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: verticalScale(5),
    },
    totalLabel: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#333',
    },
    totalValue: {
        fontSize: moderateScale(20),
        fontWeight: '800',
        color: '#FF8A3C',
    },
    whatsappRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(30),
        marginTop: verticalScale(5),
        gap: scale(12),
        backgroundColor: 'white',
        padding: scale(16),
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF'
    },
    whatsappText: {
        fontSize: moderateScale(15),
        color: '#333',
        fontWeight: '500',
        flex: 1
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FF8A3C',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white'
    },
    checkboxChecked: {
        backgroundColor: '#FF8A3C',
    },
    checkmark: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    sectionHeader: {
        marginBottom: verticalScale(12),
    },
    sectionTitle: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#333',
    },
    paymentContainer: {
        gap: verticalScale(12),
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#EFEFEF',
        borderRadius: 12,
        padding: scale(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    paymentOptionSelected: {
        borderColor: '#FF8A3C',
        backgroundColor: '#FFF9F5',
        borderWidth: 1.5,
    },
    paymentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D1D1D1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: '#FF8A3C',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF8A3C',
    },
    paymentText: {
        fontSize: moderateScale(16),
        fontWeight: '500',
        color: '#555',
    },
    paymentTextSelected: {
        color: '#333',
        fontWeight: '600',
    },
    badge: {
        backgroundColor: '#FF8A3C',
        paddingHorizontal: scale(8),
        paddingVertical: verticalScale(4),
        borderRadius: 6,
    },
    badgeText: {
        color: 'white',
        fontSize: moderateScale(10),
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    footer: {
        padding: scale(20),
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        flexDirection: 'row',
        gap: scale(15),
        paddingBottom: Platform.OS === 'ios' ? 0 : scale(20)
    },
    backButton: {
        flex: 0.3,
        paddingVertical: verticalScale(16),
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    backButtonText: {
        color: '#555',
        fontSize: moderateScale(16),
        fontWeight: '600',
    },
    submitButton: {
        flex: 1,
        backgroundColor: '#1E232C',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: verticalScale(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: {
        color: 'white',
        fontSize: moderateScale(16),
        fontWeight: '700',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: scale(24),
        width: '90%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: moderateScale(20),
        fontWeight: '700',
        color: '#1E232C',
        marginBottom: verticalScale(12),
    },
    modalMessage: {
        fontSize: moderateScale(16),
        color: '#555',
        marginBottom: verticalScale(24),
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: scale(15),
        width: '100%',
    },
    modalButton: {
        flex: 1,
        paddingVertical: verticalScale(12),
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    confirmButton: {
        backgroundColor: '#FF8A3C', // Apps Orange
    },
    cancelButtonText: {
        color: '#555',
        fontSize: moderateScale(15),
        fontWeight: '600',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: moderateScale(15),
        fontWeight: '700',
    }
});
