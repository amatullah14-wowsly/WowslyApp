import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Switch } from 'react-native';
import DatePicker from 'react-native-date-picker';
import { useScale } from '../../../utils/useScale';
import { FontSize } from '../../../constants/fontSizes';
import { useTabletScale, useTabletModerateScale } from '../../../utils/tabletScaling';
import { ResponsiveContainer } from '../../../components/ResponsiveContainer';
import { useWindowDimensions } from 'react-native';

const THEME_COLOR = '#FF8A3C';

interface EditEventModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    eventData: any;
}

const EditEventModal = ({ visible, onClose, onSubmit, eventData }: EditEventModalProps) => {
    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = makeStyles(scale, verticalScale, moderateScale);

    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');

    // Location & Venue
    const [isOnline, setIsOnline] = useState(false); // false = Offline, true = Online
    const [multipleVenues, setMultipleVenues] = useState(false);

    // Address Details
    const [address, setAddress] = useState('');
    const [location, setLocation] = useState(''); // City
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [googleMapLink, setGoogleMapLink] = useState('');

    const [timezone, setTimezone] = useState('');

    // Date states
    const [startDate, setStartDate] = useState(new Date());
    const [openStartDate, setOpenStartDate] = useState(false);

    const [endDate, setEndDate] = useState(new Date());
    const [openEndDate, setOpenEndDate] = useState(false);

    useEffect(() => {
        if (eventData && visible) {
            setTitle(eventData.title || '');

            // Location & Venue
            setIsOnline(!!eventData.is_online);
            setMultipleVenues(!!eventData.multiple_venues);

            // Address Details
            setAddress(eventData.address || '');
            setLocation(eventData.city || '');
            setZip(eventData.zip || '');
            setState(eventData.state || '');
            setCountry(eventData.country || '');
            setGoogleMapLink(eventData.google_map_link || '');

            setTimezone(eventData.timezone || 'Asia/Kolkata');

            if (eventData.start_date) {
                const start = new Date(eventData.start_date + (eventData.start_time ? 'T' + eventData.start_time : ''));
                if (!isNaN(start.getTime())) setStartDate(start);
            }

            if (eventData.end_date) {
                const end = new Date(eventData.end_date + (eventData.end_time ? 'T' + eventData.end_time : ''));
                if (!isNaN(end.getTime())) setEndDate(end);
            }
        }
    }, [eventData, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            // Format dates for API: YYYY-MM-DD
            const formatDate = (date: Date) => {
                return date.toISOString().split('T')[0];
            };

            const formatTime = (date: Date) => {
                return date.toTimeString().split(' ')[0];
            };

            const payload = {
                title,
                start_date: formatDate(startDate),
                start_time: formatTime(startDate),
                end_date: formatDate(endDate),
                end_time: formatTime(endDate),
                timezone,

                // Location & Venue
                is_online: isOnline ? 1 : 0,
                multiple_venues: multipleVenues ? 1 : 0,

                // Address Details
                address,
                city: location,
                zip,
                state,
                country,
                google_map_link: googleMapLink,
            };

            await onSubmit(payload);
            onClose();
        } catch (error) {
            console.error("Failed to save event details", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <ResponsiveContainer maxWidth={isTablet ? 600 : 420}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Event Details</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Image
                                    source={require('../../../assets/img/common/close.png')}
                                    style={styles.closeIcon}
                                />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                            {/* Title */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Event Title</Text>
                                <TextInput
                                    style={styles.input}
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder="Enter event title"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Start Date */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Start Date & Time</Text>
                                <TouchableOpacity
                                    style={styles.dateInput}
                                    onPress={() => setOpenStartDate(true)}
                                >
                                    <Text style={styles.dateText}>
                                        {startDate.toLocaleString()}
                                    </Text>

                                </TouchableOpacity>
                                <DatePicker
                                    modal
                                    open={openStartDate}
                                    date={startDate}
                                    onConfirm={(date) => {
                                        setOpenStartDate(false);
                                        setStartDate(date);
                                    }}
                                    onCancel={() => {
                                        setOpenStartDate(false);
                                    }}
                                />
                            </View>

                            {/* End Date */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>End Date & Time</Text>
                                <TouchableOpacity
                                    style={styles.dateInput}
                                    onPress={() => setOpenEndDate(true)}
                                >
                                    <Text style={styles.dateText}>
                                        {endDate.toLocaleString()}
                                    </Text>

                                </TouchableOpacity>
                                <DatePicker
                                    modal
                                    open={openEndDate}
                                    date={endDate}
                                    onConfirm={(date) => {
                                        setOpenEndDate(false);
                                        setEndDate(date);
                                    }}
                                    onCancel={() => {
                                        setOpenEndDate(false);
                                    }}
                                />
                            </View>


                            {/* Timezone */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Timezone</Text>
                                <TextInput
                                    style={styles.input}
                                    value={timezone}
                                    onChangeText={setTimezone}
                                    placeholder="e.g. Asia/Kolkata"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Event Location (Offline/Online) */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Event Location</Text>
                                <View style={styles.radioGroup}>
                                    <TouchableOpacity
                                        style={[
                                            styles.radioOption,
                                            !isOnline && styles.radioOptionSelected
                                        ]}
                                        onPress={() => setIsOnline(false)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[
                                            styles.radioCircle,
                                            !isOnline && styles.radioCircleSelected
                                        ]}>
                                            {!isOnline && <View style={styles.radioDot} />}
                                        </View>
                                        <Text style={styles.radioLabel}>Offline</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.radioOption,
                                            isOnline && styles.radioOptionSelected
                                        ]}
                                        onPress={() => setIsOnline(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[
                                            styles.radioCircle,
                                            isOnline && styles.radioCircleSelected
                                        ]}>
                                            {isOnline && <View style={styles.radioDot} />}
                                        </View>
                                        <Text style={styles.radioLabel}>Online</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Multiple Venues Toggle */}
                            <View style={[styles.inputGroup, styles.toggleContainer]}>
                                <Text style={[styles.label, { marginBottom: 0 }]}>Event happening on multiple venues</Text>
                                <Switch
                                    trackColor={{ false: "#767577", true: THEME_COLOR }}
                                    thumbColor={multipleVenues ? "white" : "#f4f3f4"}
                                    ios_backgroundColor="#3e3e3e"
                                    onValueChange={setMultipleVenues}
                                    value={multipleVenues}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>

                            {/* Conditional Rendering for Address Fields */}
                            {!multipleVenues && (
                                <>
                                    {/* Address */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Event Address</Text>
                                        <TextInput
                                            style={[styles.input, styles.textArea]}
                                            value={address}
                                            onChangeText={setAddress}
                                            placeholder="Enter full address"
                                            placeholderTextColor="#999"
                                            multiline
                                            numberOfLines={3}
                                        />
                                    </View>

                                    {/* City & Zip Code Row */}
                                    <View style={styles.row}>
                                        <View style={[styles.inputGroup, { flex: 1, marginRight: scale(10) }]}>
                                            <Text style={styles.label}>City</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={location}
                                                onChangeText={setLocation}
                                                placeholder="City"
                                                placeholderTextColor="#999"
                                            />
                                        </View>
                                        <View style={[styles.inputGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>Zip code</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={zip}
                                                onChangeText={setZip}
                                                placeholder="Zip code"
                                                placeholderTextColor="#999"
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>

                                    {/* State & Country Row */}
                                    <View style={styles.row}>
                                        <View style={[styles.inputGroup, { flex: 1, marginRight: scale(10) }]}>
                                            <Text style={styles.label}>State</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={state}
                                                onChangeText={setState}
                                                placeholder="State"
                                                placeholderTextColor="#999"
                                            />
                                        </View>
                                        <View style={[styles.inputGroup, { flex: 1 }]}>
                                            <Text style={styles.label}>Country</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={country}
                                                onChangeText={setCountry}
                                                placeholder="Country"
                                                placeholderTextColor="#999"
                                            />
                                        </View>
                                    </View>

                                    {/* Google Map Link */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Google Map Link</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={googleMapLink}
                                            onChangeText={setGoogleMapLink}
                                            placeholder="Paste Google Map Link"
                                            placeholderTextColor="#999"
                                        />
                                    </View>
                                </>
                            )}

                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={onClose}
                                disabled={loading}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSave}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </ResponsiveContainer>
            </View>
        </Modal>
    );
};

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number) => number) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: moderateScale(20),
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: moderateScale(16),
        maxHeight: '85%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: moderateScale(20),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#333',
    },
    closeButton: {
        padding: moderateScale(5),
    },
    closeIcon: {
        width: moderateScale(14),
        height: moderateScale(14),
        resizeMode: 'contain',
        tintColor: '#999',
    },
    scrollContent: {
        padding: moderateScale(20),
    },
    inputGroup: {
        marginBottom: verticalScale(20),
    },
    label: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#666',
        marginBottom: verticalScale(8),
    },
    input: {
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: moderateScale(8),
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        fontSize: moderateScale(14),
        color: '#333',
        backgroundColor: '#FCFCFC',
    },
    textArea: {
        height: verticalScale(80),
        textAlignVertical: 'top',
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: moderateScale(8),
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(10),
        backgroundColor: '#FCFCFC',
    },
    dateText: {
        fontSize: moderateScale(14),
        color: '#333',
    },

    footer: {
        flexDirection: 'row',
        padding: moderateScale(20),
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        gap: moderateScale(15),
    },
    cancelButton: {
        flex: 1,
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(10),
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#666',
    },
    saveButton: {
        flex: 1,
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(10),
        backgroundColor: THEME_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: 'white',
        // textTransform: 'uppercase', // Optional to make it look like "SAVE" in screenshot
    },

    // New Styles for Radio & Toggles
    radioGroup: {
        flexDirection: 'row',
        gap: moderateScale(15),
    },
    radioOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: moderateScale(12),
        backgroundColor: 'white',
        borderRadius: moderateScale(8),
        borderWidth: 1,
        borderColor: '#DDD', // Default border
    },
    radioOptionSelected: {
        borderColor: THEME_COLOR,
        backgroundColor: '#FFF5EB',
    },
    radioCircle: {
        width: moderateScale(18),
        height: moderateScale(18),
        borderRadius: moderateScale(9),
        borderWidth: 2,
        borderColor: '#999',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: moderateScale(10),
    },
    radioCircleSelected: {
        borderColor: THEME_COLOR, // '#007AFF'
    },
    radioDot: {
        width: moderateScale(10),
        height: moderateScale(10),
        borderRadius: moderateScale(5),
        backgroundColor: THEME_COLOR, // '#007AFF'
    },
    radioLabel: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '500',
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
    }
});

export default EditEventModal;
