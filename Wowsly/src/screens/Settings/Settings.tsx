import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Image, Switch, TextInput } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import BackButton from '../../components/BackButton';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { useNavigation, useRoute } from '@react-navigation/native';

const THEME_COLOR = '#FF8A3C';

const CustomSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: () => void }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onValueChange}
            style={[
                styles.switchContainer,
                { backgroundColor: value ? THEME_COLOR : '#E0E0E0' }
            ]}
        >
            <View style={[
                styles.switchThumb,
                { transform: [{ translateX: value ? scale(20) : 0 }] }
            ]} />
        </TouchableOpacity>
    );
};

const Settings = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventData } = route.params || {};

    const [eventType, setEventType] = useState<'public' | 'invite' | null>(null);
    const [ticketType, setTicketType] = useState<'free' | 'paid' | null>(null);
    const [settings, setSettings] = useState({
        registrationRequired: false,
        selfCheckIn: false,
        hasPolls: false,
        approvalBasis: false,
        exchangeDetails: false,
        buyMultipleTickets: false,
        registerAgain: false,
        hasExhibitors: false,
        otpOnRegistration: false,
    });

    const [whatsappExpanded, setWhatsappExpanded] = useState(false);
    const [whatsappSettings, setWhatsappSettings] = useState({
        key: '',
        phoneNumberId: '',
        templateId: '',
        detailsTemplateId: '',
        newUserTemplateId: '',
    });

    const [advancedSettings, setAdvancedSettings] = useState({
        senderEmail: false,
        ownerNotified: false,
        printDimensions: false,
    });

    const toggleSetting = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleAdvancedSetting = (key: keyof typeof advancedSettings) => {
        setAdvancedSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}

            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Event Title Section */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={eventData?.image ? { uri: eventData.image } : require('../../assets/img/common/noimage.png')}
                            style={styles.avatar}
                        />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName} numberOfLines={1}>{eventData?.title || "Event Name"}</Text>
                        <Text style={styles.profileEmail} numberOfLines={1}>{eventData?.date || "Event Date"}</Text>
                    </View>
                    <TouchableOpacity style={styles.editButton}>
                        <Image
                            source={require('../../assets/img/form/edit.png')}
                            style={styles.editIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>

                {/* Event Type Section */}
                <Text style={styles.sectionTitle}>Event type</Text>
                <View style={styles.radioGroup}>
                    <TouchableOpacity
                        style={[
                            styles.radioOption,
                            eventType === 'public' && styles.radioOptionSelected
                        ]}
                        onPress={() => setEventType('public')}
                        activeOpacity={0.8}
                    >
                        <View style={[
                            styles.radioCircle,
                            eventType === 'public' && styles.radioCircleSelected
                        ]}>
                            {eventType === 'public' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.radioLabel}>Public</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.radioOption,
                            eventType === 'invite' && styles.radioOptionSelected
                        ]}
                        onPress={() => setEventType('invite')}
                        activeOpacity={0.8}
                    >
                        <View style={[
                            styles.radioCircle,
                            eventType === 'invite' && styles.radioCircleSelected
                        ]}>
                            {eventType === 'invite' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.radioLabel}>Invite only</Text>
                    </TouchableOpacity>
                </View>

                {/* Ticket Type Section */}
                <Text style={[styles.sectionTitle, { marginTop: verticalScale(25) }]}>Ticket type</Text>
                <View style={styles.radioGroup}>
                    <TouchableOpacity
                        style={[
                            styles.radioOption,
                            ticketType === 'free' && styles.radioOptionSelected
                        ]}
                        onPress={() => setTicketType('free')}
                        activeOpacity={0.8}
                    >
                        <View style={[
                            styles.radioCircle,
                            ticketType === 'free' && styles.radioCircleSelected
                        ]}>
                            {ticketType === 'free' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.radioLabel}>Free</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.radioOption,
                            ticketType === 'paid' && styles.radioOptionSelected
                        ]}
                        onPress={() => setTicketType('paid')}
                        activeOpacity={0.8}
                    >
                        <View style={[
                            styles.radioCircle,
                            ticketType === 'paid' && styles.radioCircleSelected
                        ]}>
                            {ticketType === 'paid' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.radioLabel}>Paid</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Settings Section */}
                <Text style={[styles.sectionTitle, { marginTop: verticalScale(25) }]}>Main Settings</Text>

                <View style={styles.settingsList}>
                    <SettingItem label="Event Registration Form Required" value={settings.registrationRequired} onToggle={() => toggleSetting('registrationRequired')} />
                    <SettingItem label="Self Check-in" value={settings.selfCheckIn} onToggle={() => toggleSetting('selfCheckIn')} />
                    <SettingItem label="Has Polls" value={settings.hasPolls} onToggle={() => toggleSetting('hasPolls')} />
                    <SettingItem label="Registration On Approval Basis" value={settings.approvalBasis} onToggle={() => toggleSetting('approvalBasis')} />
                    <SettingItem label="Guest Can Exchange Details" value={settings.exchangeDetails} onToggle={() => toggleSetting('exchangeDetails')} />
                    <SettingItem label="Buy Multiple Tickets" value={settings.buyMultipleTickets} onToggle={() => toggleSetting('buyMultipleTickets')} />
                    <SettingItem label="Enable User to Register Again" value={settings.registerAgain} onToggle={() => toggleSetting('registerAgain')} />
                    <SettingItem label="Has Exhibitors" value={settings.hasExhibitors} onToggle={() => toggleSetting('hasExhibitors')} />
                    <SettingItem label="OTP On Registration Form" value={settings.otpOnRegistration} onToggle={() => toggleSetting('otpOnRegistration')} last />
                </View>

                {/* WhatsApp Integration Section */}
                <Text style={[styles.sectionTitle, { marginTop: verticalScale(25) }]}>WhatsApp Integration</Text>
                <TouchableOpacity
                    style={styles.whatsappContainer}
                    onPress={() => setWhatsappExpanded(!whatsappExpanded)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.whatsappLabel}>Add Your WhatsApp Number</Text>
                    <Image
                        source={require('../../assets/img/common/forwardarrow.png')}
                        style={[
                            styles.forwardArrow,
                            whatsappExpanded && { transform: [{ rotate: '90deg' }] }
                        ]}
                        resizeMode="contain"
                    />
                </TouchableOpacity>

                {whatsappExpanded && (
                    <View style={styles.whatsappFormContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>WhatsApp Key</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="WhatsApp Key"
                                placeholderTextColor="#999"
                                value={whatsappSettings.key}
                                onChangeText={(t) => setWhatsappSettings(prev => ({ ...prev, key: t }))}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Phone Number ID</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Phone Number ID"
                                placeholderTextColor="#999"
                                value={whatsappSettings.phoneNumberId}
                                onChangeText={(t) => setWhatsappSettings(prev => ({ ...prev, phoneNumberId: t }))}
                            />
                        </View>

                        <Text style={styles.groupLabel}>Send Ticket Template</Text>
                        <View style={styles.inputGroupNoLabel}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Template ID"
                                placeholderTextColor="#999"
                                value={whatsappSettings.templateId}
                                onChangeText={(t) => setWhatsappSettings(prev => ({ ...prev, templateId: t }))}
                            />
                        </View>

                        <Text style={styles.groupLabel}>Send Ticket With details Template</Text>
                        <View style={styles.inputGroupNoLabel}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Template ID"
                                placeholderTextColor="#999"
                                value={whatsappSettings.detailsTemplateId}
                                onChangeText={(t) => setWhatsappSettings(prev => ({ ...prev, detailsTemplateId: t }))}
                            />
                        </View>

                        <Text style={styles.groupLabel}>Send Ticket when new user registered Template</Text>
                        <View style={styles.inputGroupNoLabel}>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Template ID"
                                placeholderTextColor="#999"
                                value={whatsappSettings.newUserTemplateId}
                                onChangeText={(t) => setWhatsappSettings(prev => ({ ...prev, newUserTemplateId: t }))}
                            />
                        </View>

                        <View style={styles.inlineActions}>
                            <TouchableOpacity onPress={() => setWhatsappExpanded(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={() => setWhatsappExpanded(false)}
                            >
                                <Text style={styles.saveButtonText}>Save WhatsApp Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* API Token Section */}
                <Text style={[styles.sectionTitle, { marginTop: verticalScale(25) }]}>Your API Token</Text>
                <View style={styles.apiSection}>
                    <View style={styles.tokenBox}>
                        <Text style={styles.tokenText} numberOfLines={1}>291075e74er0vgj</Text>
                        <TouchableOpacity activeOpacity={0.7} style={styles.copyButton}>
                            <Image
                                source={require('../../assets/img/common/copy.png')}
                                style={styles.copyIcon}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity activeOpacity={0.8} style={styles.generateButton}>
                        <Text style={styles.generateButtonText}>Generate API Token</Text>
                    </TouchableOpacity>
                </View>

                {/* Advanced Settings Section */}
                <Text style={[styles.sectionTitle, { marginTop: verticalScale(25) }]}>Advanced Settings</Text>

                <View style={styles.advancedItem}>
                    <Text style={styles.settingLabel}>Add Sender Email ID</Text>
                    <CustomSwitch value={advancedSettings.senderEmail} onValueChange={() => toggleAdvancedSetting('senderEmail')} />
                </View>

                <View style={styles.advancedItem}>
                    <Text style={styles.settingLabel}>Owner Notified When Ticket Booked</Text>
                    <CustomSwitch value={advancedSettings.ownerNotified} onValueChange={() => toggleAdvancedSetting('ownerNotified')} />
                </View>

                <View style={styles.advancedItem}>
                    <Text style={styles.settingLabel}>Add Print Dimensions</Text>
                    <CustomSwitch value={advancedSettings.printDimensions} onValueChange={() => toggleAdvancedSetting('printDimensions')} />
                </View>

                {/* Main Save Button */}
                <View style={styles.footerActions}>
                    <TouchableOpacity style={styles.mainSaveButton} activeOpacity={0.8}>
                        {/* If we had an icon it would go here */}
                        {/* <Image source={require('../../assets/img/common/save.png')} ... /> */}
                        <Text style={styles.mainSaveButtonText}>Save Settings</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const SettingItem = ({ label, value, onToggle, last }: { label: string, value: boolean, onToggle: () => void, last?: boolean }) => (
    <View style={[styles.settingItem, last && { borderBottomWidth: 0 }]}>
        <Text style={styles.settingLabel}>{label}</Text>
        <CustomSwitch value={value} onValueChange={onToggle} />
    </View>
);

export default Settings;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white', // Slight off-white for background
    },
    header: {
        width: '100%',
        height: verticalScale(60),
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        paddingHorizontal: scale(20),
        // shadowColor: '#000',
        // shadowOffset: { width: 0, height: 1 },
        // shadowOpacity: 0.05,
        // elevation: 2,
    },
    headerTitle: {
        fontSize: moderateScale(18),
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginRight: scale(30),
        color: 'black',
    },
    scrollContent: {
        padding: scale(20),
        paddingBottom: verticalScale(50),
    },

    // Profile Card (Event Title)
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(16),
        marginBottom: verticalScale(25),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },
    avatarContainer: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(12),
        overflow: 'hidden',
        backgroundColor: '#F0F0F0',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    profileInfo: {
        flex: 1,
        marginLeft: scale(15),
    },
    profileName: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#1C1C1C',
        marginBottom: verticalScale(4),
    },
    profileEmail: {
        fontSize: moderateScale(13),
        color: '#888',
    },
    editButton: {
        padding: scale(10),
        backgroundColor: '#F9F9F9',
        borderRadius: scale(10),
    },
    editIcon: {
        width: scale(18),
        height: scale(18),
        tintColor: '#FF8A3C',
    },

    // Section Titles
    sectionTitle: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#1C1C1C',
        marginBottom: verticalScale(15),
    },

    // Radio Group
    radioGroup: {
        flexDirection: 'row',
        gap: scale(15),
    },
    radioOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(16),
        backgroundColor: 'white',
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    radioOptionSelected: {
        borderColor: THEME_COLOR,
        backgroundColor: '#FFF5EB', // Very light orange
    },
    radioCircle: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        borderWidth: 2,
        borderColor: '#CCC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(10),
    },
    radioCircleSelected: {
        borderColor: THEME_COLOR,
    },
    radioDot: {
        width: scale(10),
        height: scale(10),
        borderRadius: scale(5),
        backgroundColor: THEME_COLOR,
    },
    radioLabel: {
        fontSize: moderateScale(14),
        fontWeight: '500',
        color: '#333',
    },

    // Settings List
    settingsList: {
        backgroundColor: 'white',
        borderRadius: scale(16),
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: verticalScale(16),
        paddingHorizontal: scale(20),
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    settingLabel: {
        fontSize: moderateScale(14),
        fontWeight: '500',
        color: '#333',
        flex: 1,
        marginRight: scale(10),
    },

    // Custom Switch
    switchContainer: {
        width: scale(44),
        height: verticalScale(24),
        borderRadius: scale(12),
        padding: scale(2),
        justifyContent: 'center',
    },
    switchThumb: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },

    // WhatsApp Section
    whatsappContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        borderRadius: scale(12),
        paddingHorizontal: scale(20),
        height: verticalScale(60),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    whatsappLabel: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '500',
    },
    forwardArrow: {
        width: scale(22), // Increased size
        height: scale(22), // Increased size
        // tintColor removed as requested
    },
    whatsappFormContainer: {
        backgroundColor: 'white',
        borderRadius: scale(12),
        padding: scale(16),
        marginTop: verticalScale(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    inputGroup: {
        marginBottom: verticalScale(15),
    },
    inputLabel: {
        fontSize: moderateScale(14),
        color: '#666',
        marginBottom: verticalScale(8),
    },
    groupLabel: {
        fontSize: moderateScale(15),
        color: '#1C1C1C',
        fontWeight: '600',
        marginTop: verticalScale(10),
        marginBottom: verticalScale(10),
    },
    inputGroupNoLabel: {
        marginBottom: verticalScale(5),
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(12),
        fontSize: moderateScale(14),
        color: '#333',
        backgroundColor: 'white',
    },
    inlineActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: verticalScale(20),
    },
    cancelText: {
        fontSize: moderateScale(14),
        color: '#FF8A3C',
        fontWeight: '500',
        paddingHorizontal: scale(20),
    },
    saveButton: {
        backgroundColor: '#FF8A3C',
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(12),
        borderRadius: scale(10),
    },
    saveButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: moderateScale(14),
    },

    // API Token Section
    apiSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    tokenBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: verticalScale(45),
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
    },
    tokenText: {
        fontSize: moderateScale(14),
        color: '#333',
        flex: 1,
    },
    copyButton: {
        padding: scale(5),
    },
    copyIcon: {
        width: scale(18),
        height: scale(18),
        tintColor: '#FF6D00', // Or keep original color if preferred
    },
    generateButton: {
        backgroundColor: '#FF8A3C', // Strong orange
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(15),
        borderRadius: scale(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    generateButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: moderateScale(12),
    },

    // Advanced Settings
    advancedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: verticalScale(16),
        paddingHorizontal: scale(20),
        backgroundColor: '#F7F8F9', // Light gray/blueish background
        borderRadius: scale(12),
        marginBottom: verticalScale(15),
    },

    // Footer Actions
    footerActions: {
        alignItems: 'flex-end',
        marginTop: verticalScale(30),
        marginBottom: verticalScale(20),
    },
    mainSaveButton: {
        backgroundColor: '#FF8A3C', // Orange
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(25),
        borderRadius: scale(10),
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    mainSaveButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: moderateScale(16),
    },
});
