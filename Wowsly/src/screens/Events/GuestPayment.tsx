import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform, Modal, Image, BackHandler, LayoutAnimation, UIManager, TextInput, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useScale } from '../../utils/useScale';
import BackButton from '../../components/BackButton';
import { FontSize } from '../../constants/fontSizes';
import { payViaCash } from '../../api/event';
import Toast from 'react-native-toast-message';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GuestPayment = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, guestDetails, ticketResponse, registeredBy, eventName, ticketName } = route.params || {};

    const [loading, setLoading] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'Cash' | 'Online'>('Cash');
    const [sendToWhatsapp, setSendToWhatsapp] = useState(route.params?.sendToWhatsapp || false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showOnlineScreen, setShowOnlineScreen] = useState(false);

    const ticketData = ticketResponse?.data || {};
    const selectedTickets = route.params?.selectedTickets || [];

    // 1. Calculate Ticket Qty and Base Total
    let totalTicketQty = 0;
    let ticketBaseTotal = 0;

    if (selectedTickets.length > 0) {
        selectedTickets.forEach((t: any) => {
            const qty = Number(t.quantity || 0);
            totalTicketQty += qty;
            ticketBaseTotal += Number(t.price || 0) * qty;
        });
    } else {
        // Fallback for single ticket (backward compatibility)
        totalTicketQty = Number(route.params?.quantity || ticketData.tickets_bought || 1);
        ticketBaseTotal = Number(ticketData.per_ticket_price || ticketData.amount || 0) * totalTicketQty;
    }

    // 3. Map Facilities correctly (API uses 'price', we map to 'amount')
    const rawFacilities = route.params?.facilities || [];
    const facilities = rawFacilities.map((f: any) => ({
        ...f,
        amount: Number(f.price || 0),
        currency: f.currency || ticketData.currency
    }));

    // 4. Calculate Facility Total (Exclude free/included)
    const facilityTotal = facilities.reduce((sum: number, f: any) => {
        if (f.is_free || f.is_included) return sum;
        return sum + (Number(f.amount || 0) * totalTicketQty);
    }, 0);

    // 5. Final Payable Amount
    const amountToPay = ticketBaseTotal + facilityTotal + (sendToWhatsapp ? 2 : 0);

    const currencySymbol = (ticketData.currency === 'rupees' || ticketData.currency === 'INR') ? '₹' : (ticketData.currency || '₹');

    const { width } = useWindowDimensions();
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

    // Handle Hardware Back Button
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (showOnlineScreen) {
                    setShowOnlineScreen(false);
                    return true;
                }
                return false;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        }, [showOnlineScreen])
    );

    const handleBack = () => {
        if (showOnlineScreen) {
            setShowOnlineScreen(false);
        } else {
            navigation.goBack();
        }
    };

    const handleSubmit = () => {
        if (paymentMode === 'Cash') {
            setShowConfirm(true);
        } else {
            setShowOnlineScreen(true);
        }
    };

    const processCashPayment = async () => {
        setShowConfirm(false);
        setLoading(true);
        try {
            const facilityIds = (route.params?.facilities || []).map((f: any) => f.id);

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

    if (showOnlineScreen) {
        return (
            <OnlinePaymentScreen
                amount={amountToPay}
                currency={currencySymbol}
                mobile={guestDetails?.mobile}
                onBack={handleBack}
            />
        );
    }

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
                            <Text style={styles.value}>{eventName || 'Event'}</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Ticket Info */}
                        <View style={styles.ticketSummaryContainer}>
                            {selectedTickets.length > 0 ? (
                                selectedTickets.map((t: any, index: number) => {
                                    const tCurrency = (t.currency === 'rupees' || t.currency === 'INR') ? '₹' : (t.currency || '₹');
                                    return (
                                        <View key={index} style={{ marginBottom: index === selectedTickets.length - 1 ? 0 : verticalScale(12) }}>
                                            <View style={[styles.ticketRow, { marginBottom: verticalScale(4) }]}>
                                                <Text style={[styles.ticketName, { flex: 1, fontWeight: '700', fontSize: moderateScale(16) }]}>
                                                    {t.title || 'Ticket'}
                                                </Text>
                                                <Text style={styles.ticketQuantity}>Qty: {t.quantity}</Text>
                                            </View>
                                            <View style={styles.ticketRow}>
                                                <Text style={styles.ticketPrice}>
                                                    Price: {t.price} {tCurrency}
                                                </Text>
                                                <Text style={styles.itemTotal}>
                                                    Subtotal: {Number(t.price) * Number(t.quantity)} {tCurrency}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View>
                                    <View style={[styles.ticketRow, { marginBottom: verticalScale(4) }]}>
                                        <Text style={[styles.ticketName, { flex: 1, fontWeight: '700', fontSize: moderateScale(16) }]}>
                                            {ticketName || ticketData.ticket_name || ticketData.title || 'Ticket'}
                                        </Text>
                                        <Text style={styles.ticketQuantity}>Qty: {totalTicketQty}</Text>
                                    </View>
                                    <View style={styles.ticketRow}>
                                        <Text style={styles.ticketPrice}>
                                            Price: {ticketData.per_ticket_price} {currencySymbol}
                                        </Text>
                                        <Text style={styles.itemTotal}>
                                            Subtotal: {Number(ticketData.per_ticket_price) * totalTicketQty} {currencySymbol}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Facilities (Dynamic) */}
                        {facilities.map((facility: any, index: number) => {
                            const fAmount = Number(facility.amount || 0);
                            const totalFAmount = fAmount * totalTicketQty;
                            const isIncluded = facility.is_free || facility.is_included;

                            return (
                                <View key={index} style={styles.infoRow}>
                                    <Text style={[styles.label, { flex: 1 }]}>{facility.name || facility.facility_name || 'Facility'}</Text>
                                    <View style={{ alignItems: 'flex-end', maxWidth: '40%' }}>
                                        <Text style={[styles.value, { maxWidth: '100%' }]}>
                                            {isIncluded
                                                ? 'Included'
                                                : `${fAmount} ${currencySymbol}`}
                                        </Text>
                                        {!isIncluded && fAmount > 0 && (
                                            <Text style={[styles.value, { fontSize: moderateScale(12), color: '#888', marginTop: 2, maxWidth: '100%' }]}>
                                                Total: {totalFAmount} {currencySymbol}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}

                        {/* WhatsApp Fee Row */}
                        {sendToWhatsapp && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.label, { flex: 1 }]}>WhatsApp Fee</Text>
                                <Text style={styles.value}>2 {currencySymbol}</Text>
                            </View>
                        )}

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

                    {/* <TouchableOpacity
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
                    </TouchableOpacity> */}
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

// -- Data Structures --
const ALL_BANKS = [
    { id: 'airtel', name: 'Airtel Payments Bank' },
    { id: 'au', name: 'AU Small Finance Bank' },
    { id: 'axis', name: 'Axis Bank' },
    { id: 'bandhan', name: 'Bandhan Bank' },
    { id: 'bbk', name: 'Bank of Bahrain and Kuwait' },
    { id: 'bob_retail', name: 'Bank of Baroda - Retail Banking' },
    { id: 'bassein', name: 'Bassein Catholic Co-operative Bank' },
    { id: 'canara', name: 'Canara Bank' },
    { id: 'dcb', name: 'DCB Bank' },
    { id: 'deutsche', name: 'Deutsche Bank' },
    { id: 'dbs', name: 'Development Bank of Singapore' },
    { id: 'dhanlaxmi', name: 'Dhanlaxmi Bank' },
    { id: 'dhanlaxmi_corp', name: 'Dhanlaxmi Bank - Corporate Banking' },
    { id: 'equitas', name: 'Equitas Small Finance Bank' },
    { id: 'esaf', name: 'ESAF Small Finance Bank' },
    { id: 'federal', name: 'Federal Bank' },
    { id: 'fincare', name: 'Fincare Small Finance Bank' },
    { id: 'hsbc', name: 'HSBC' },
    { id: 'idbi_corp', name: 'IDBI - Corporate Banking' },
    { id: 'idfc', name: 'IDFC FIRST Bank' },
    { id: 'indian', name: 'Indian Bank' },
    { id: 'indian_allahabad', name: 'Indian Bank (Erstwhile Allahabad Bank)' },
    { id: 'iob', name: 'Indian Overseas Bank' },
    { id: 'indusind', name: 'IndusInd Bank' },
    { id: 'jk', name: 'Jammu and Kashmir Bank' },
    { id: 'kotak', name: 'Kotak Mahindra Bank' },
    { id: 'mehsana', name: 'Mehsana Urban Co-operative Bank' },
    { id: 'nkgsb', name: 'NKGSB Co-operative Bank' },
    { id: 'nsdl', name: 'NSDL Payments Bank' },
    { id: 'northeast', name: 'North East Small Finance Bank' },
    { id: 'pnb_united', name: 'PNB (Erstwhile-United Bank of India)' },
    { id: 'pnb_oriental', name: 'PNB (Erstwhile-Oriental Bank of Commerce)' },
    { id: 'punjab_sind', name: 'Punjab & Sind Bank' },
    { id: 'pnb_retail', name: 'Punjab National Bank - Retail Banking' },
    { id: 'rbl', name: 'RBL Bank' },
    { id: 'saraswat', name: 'Saraswat Co-operative Bank' },
    { id: 'south_indian', name: 'South Indian Bank' },
    { id: 'standard', name: 'Standard Chartered Bank' },
    { id: 'svc', name: 'SVC Co-Operative Bank Ltd.' },
    { id: 'svc_corp', name: 'SVC Co-Operative Bank Ltd. - Corporate' },
    { id: 'syndicate', name: 'Syndicate Bank' },
    { id: 'tmb', name: 'Tamilnad Mercantile Bank' },
    { id: 'tamilnadu_apex', name: 'Tamilnadu State Apex Co-operative Bank' },
    { id: 'thane', name: 'Thane Bharat Sahakari Bank' },
    { id: 'tjsb', name: 'TJSB Sahakari Bank' },
    { id: 'uco', name: 'UCO Bank' },
    { id: 'ujjivan', name: 'Ujjivan Small Finance Bank' },
    { id: 'union', name: 'Union Bank of India' },
    { id: 'varachha', name: 'Varachha Co-operative Bank' },
    { id: 'yes', name: 'Yes Bank' },
    { id: 'yes_corp', name: 'Yes Bank - Corporate Banking' },
    { id: 'zoroastrian', name: 'Zoroastrian Co-operative Bank' },
];

const gpayIcon = require('../../assets/img/payment/gpay.png');
const phonepeIcon = require('../../assets/img/payment/PhonePe.png');
const paytmIcon = require('../../assets/img/payment/icons8-paytm-48.png');
const credIcon = require('../../assets/img/payment/cred.png');
const amazonIcon = require('../../assets/img/payment/amazon.png');
const bhimIcon = require('../../assets/img/payment/bhim.webp');
const netbankingIcon = require('../../assets/img/payment/netbanking.png');
const walletIcon = require('../../assets/img/payment/wallet.png');

const UPI_APPS = [
    { id: 'gpay', name: 'Google Pay', icon: gpayIcon },
    { id: 'phonepe', name: 'PhonePe', icon: phonepeIcon },
    { id: 'paytm', name: 'Paytm', icon: paytmIcon },
    { id: 'cred', name: 'CRED', icon: credIcon },
    { id: 'amazon', name: 'Amazon Pay', icon: amazonIcon },
    { id: 'bhim', name: 'BHIM', icon: bhimIcon },
];

const BankSelectionScreen = ({ onClose, onSelect }: { onClose: () => void, onSelect: (bank: any) => void }) => {
    const [search, setSearch] = useState('');
    const { width } = useWindowDimensions();
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

    const filteredBanks = ALL_BANKS.filter(bank => bank.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <SafeAreaView style={styles.cleanContainer}>
            <View style={styles.bankHeader}>
                <TouchableOpacity onPress={onClose} style={styles.closeSearchBtn}>
                    <Text style={[styles.cleanBackArrow, { fontSize: 28 }]}>←</Text>
                </TouchableOpacity>
                <TextInput
                    style={styles.searchBar}
                    placeholder="Search for Banks"
                    placeholderTextColor="#999"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <ScrollView contentContainerStyle={styles.bankListContent}>
                <Text style={[styles.bankSectionTitle, { marginTop: 10 }]}>All Banks</Text>
                <View style={styles.allBanksList}>
                    {filteredBanks.map((bank, index) => (
                        <TouchableOpacity key={index} style={styles.bankRow} onPress={() => onSelect(bank)}>
                            {/* Placeholder Icon */}
                            <View style={styles.bankIconPlaceholder}>
                                <Text style={styles.bankIconPlaceholderText}>{bank.name.charAt(0)}</Text>
                            </View>
                            <View style={styles.bankInfo}>
                                <Text style={styles.bankName}>{bank.name}</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// -- Modern Minimalist Payment Screen --
const OnlinePaymentScreen = ({ amount, currency, mobile, onBack }: { amount: any, currency: string, mobile: any, onBack: () => void }) => {
    const [showBankScreen, setShowBankScreen] = useState(false);
    const { width } = useWindowDimensions();
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

    const handleBankSelect = (bank: any) => {
        setShowBankScreen(false);
        // Logic to handle bank selection, maybe set it as selected mode
        Alert.alert("Bank Selected", `You selected ${bank.name}`);
    };

    if (showBankScreen) {
        return <BankSelectionScreen onClose={() => setShowBankScreen(false)} onSelect={handleBankSelect} />;
    }

    return (
        <SafeAreaView style={styles.cleanContainer}>
            {/* Header */}
            <View style={styles.cleanHeader}>
                <TouchableOpacity onPress={onBack} style={styles.cleanBackBtn}>
                    <Text style={styles.cleanBackArrow}>←</Text>
                </TouchableOpacity>
                <Text style={styles.cleanHeaderTitle}>Checkout</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.cleanContent} showsVerticalScrollIndicator={false}>

                {/* Amount Section */}
                <View style={styles.cleanAmountSection}>
                    <Text style={styles.cleanAmountLabel}>Total Payable</Text>
                    <Text style={styles.cleanAmountValue}>{currency}{amount}</Text>
                </View>

                {/* Section: Recommended (Apps) */}
                <View style={styles.cleanSection}>
                    <Text style={styles.cleanSectionTitle}>Pay with UPI</Text>
                    <View style={styles.cleanAppsGrid}>
                        {UPI_APPS.map((app) => (
                            <TouchableOpacity key={app.id} style={styles.cleanAppItem} activeOpacity={0.7}>
                                <View style={styles.cleanAppIconContainer}>
                                    <Image source={app.icon} style={styles.cleanAppIcon} resizeMode="contain" />
                                </View>
                                <Text style={styles.cleanAppName}>{app.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.cleanInputContainer}>
                        <Text style={styles.cleanInputLabel}>Pay with UPI ID/NUMBER</Text>
                        <TextInput
                            style={styles.cleanInput}
                            placeholder="example@oksbi"
                            placeholderTextColor="#999"
                        />
                    </View>
                </View>

                {/* Section: Cards */}
                <View style={styles.cleanSection}>
                    <Text style={styles.cleanSectionTitle}>Credit / Debit Cards</Text>
                    <TouchableOpacity style={styles.cleanCardRow} activeOpacity={0.7}>
                        <View style={styles.cleanCardIconBox}>
                            <Text style={{ fontSize: 18 }}>💳</Text>
                        </View>
                        <Text style={styles.cleanCardText}>Add details</Text>
                        <Text style={styles.cleanChevron}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* Section: More Options */}
                <View style={styles.cleanSection}>
                    <Text style={styles.cleanSectionTitle}>More Options</Text>

                    <TouchableOpacity
                        style={styles.cleanOptionRow}
                        activeOpacity={0.7}
                        onPress={() => setShowBankScreen(true)}
                    >
                        <View style={styles.cleanOptionIconBox}>
                            <Image source={netbankingIcon} style={styles.cleanOptionIcon} resizeMode="contain" />
                        </View>
                        <Text style={styles.cleanOptionText}>Netbanking</Text>
                        <Text style={styles.cleanChevron}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.cleanOptionRow, { borderBottomWidth: 0 }]} activeOpacity={0.7}>
                        <View style={styles.cleanOptionIconBox}>
                            <Image source={walletIcon} style={styles.cleanOptionIcon} resizeMode="contain" />
                        </View>
                        <Text style={styles.cleanOptionText}>Wallets</Text>
                        <Text style={styles.cleanChevron}>›</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />

            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.cleanFooter}>
                <TouchableOpacity style={styles.cleanPayButton} activeOpacity={0.8}>
                    <Text style={styles.cleanPayButtonText}>Pay {currency}{amount}</Text>
                </TouchableOpacity>
                <View style={styles.cleanSecureRow}>
                    <Text style={{ fontSize: 12 }}>🔒</Text>
                    <Text style={styles.cleanSecureText}>Secured by Trusted Payments</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default GuestPayment;

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, width: number) => StyleSheet.create({
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
        maxWidth: '60%',
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
    ticketSummaryContainer: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: scale(12),
        marginVertical: verticalScale(16),
        borderWidth: 1,
        borderColor: '#EFEFEF'
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
        fontSize: moderateScale(FontSize.xl), // 20
        fontWeight: '700',
        color: '#1E232C',
        marginBottom: verticalScale(12),
    },
    modalMessage: {
        fontSize: moderateScale(FontSize.md), // 16
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
        backgroundColor: '#FF8A3C',
    },
    cancelButtonText: {
        color: '#555',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
    },

    // --- Modern Minimalist Styles ---
    cleanContainer: {
        flex: 1,
        backgroundColor: '#FAFAFA', // Very light grey/white
    },
    cleanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(16),
        backgroundColor: '#FAFAFA',
    },
    cleanBackBtn: {
        width: 40,
        height: 40,
        alignItems: 'flex-start',
        justifyContent: 'center'
    },
    cleanBackArrow: {
        fontSize: moderateScale(FontSize.xxl), // 24
        color: '#1A1A1A',
        fontWeight: '300'
    },
    cleanHeaderTitle: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        color: '#1A1A1A',
    },
    cleanContent: {
        padding: scale(24),
    },
    cleanAmountSection: {
        alignItems: 'center',
        marginBottom: verticalScale(40),
        marginTop: verticalScale(10),
    },
    cleanAmountLabel: {
        fontSize: moderateScale(FontSize.sm),
        color: '#666',
        marginBottom: 8,
        fontWeight: '500'
    },
    cleanAmountValue: {
        fontSize: moderateScale(36), // Keep 36
        color: '#1A1A1A',
        fontWeight: '700',
    },
    cleanSection: {
        marginBottom: verticalScale(32),
    },
    cleanSectionTitle: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: verticalScale(16),
    },
    cleanAppsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(16),
        justifyContent: 'space-between'
    },
    cleanAppItem: {
        width: (width - scale(48) - scale(32)) / 3, // 3 columns
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    cleanAppIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 16,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cleanAppIcon: {
        width: 32,
        height: 32,
    },
    cleanAppName: {
        fontSize: moderateScale(FontSize.xs),
        color: '#444',
        fontWeight: '500',
        textAlign: 'center'
    },
    cleanCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: scale(16),
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 1,
    },
    cleanCardIconBox: {
        width: 40,
        height: 28,
        backgroundColor: '#F5F5F5',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    cleanCardText: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        fontWeight: '500',
        flex: 1
    },
    cleanChevron: {
        fontSize: moderateScale(FontSize.xl),
        color: '#CCC',
        fontWeight: '300'
    },
    cleanOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    cleanOptionIconBox: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    cleanOptionText: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        fontWeight: '500',
        flex: 1
    },
    cleanOptionIcon: {
        width: 24,
        height: 24,
    },
    cleanFooter: {
        padding: scale(24),
        backgroundColor: '#FAFAFA',
        alignItems: 'center'
    },
    cleanPayButton: {
        width: '100%',
        backgroundColor: '#1E232C',
        paddingVertical: verticalScale(16),
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 16,
    },
    cleanPayButtonText: {
        color: 'white',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        letterSpacing: 0.5
    },
    cleanSecureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.6
    },
    cleanSecureText: {
        fontSize: moderateScale(FontSize.xs),
        color: '#666',
        fontWeight: '500'
    },
    cleanInputContainer: {
        marginTop: verticalScale(20),
    },
    cleanInputLabel: {
        fontSize: moderateScale(FontSize.sm),
        color: '#333',
        marginBottom: verticalScale(8),
        fontWeight: '500',
    },
    cleanInput: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(14),
        fontSize: moderateScale(FontSize.md),
        color: '#333',
    },
    bankHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(16),
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        gap: 12
    },
    closeSearchBtn: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBar: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(10),
        fontSize: moderateScale(FontSize.md),
        color: '#333',
    },
    bankListContent: {
        padding: scale(20),
    },
    bankSectionTitle: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        color: '#666',
        marginBottom: verticalScale(12),
    },
    allBanksList: {
        backgroundColor: 'white',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    bankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(14),
        paddingHorizontal: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    bankIconPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EEE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(12),
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    bankIconPlaceholderText: {
        fontSize: moderateScale(FontSize.md), // 16
        fontWeight: '600',
        color: '#555'
    },
    bankInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    bankName: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        fontWeight: '500',
    },
    chevron: {
        fontSize: moderateScale(FontSize.xl),
        color: '#CCC',
        fontWeight: '300'
    }

});
