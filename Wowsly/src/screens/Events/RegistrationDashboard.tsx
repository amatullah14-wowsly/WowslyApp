import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Image, Modal, ScrollView, TextInput } from 'react-native'
import DatePicker from 'react-native-date-picker'
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
// import GuestScreenTemplate from '../Guests/GuestScreenTemplate'; // Removed per request
import { getRegistrationAnswers, exportRegistrationReplies, getExportStatus, getEventDetails, updateGuestStatus } from '../../api/event';
import { ToastAndroid, Alert, Platform, Linking } from 'react-native';
import RegistrationFormEditor from './RegistrationFormEditor';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';

const ActionMenu = React.memo(({ onSelect }: { onSelect: (status: 'accepted' | 'rejected' | 'blocked') => void }) => (
    <View style={styles.popupMenu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => onSelect('accepted')}>
            <Text style={styles.menuText}>Accept</Text>
        </TouchableOpacity>
        <View style={styles.menuSeparator} />
        <TouchableOpacity style={styles.menuItem} onPress={() => onSelect('rejected')}>
            <Text style={styles.menuText}>Reject</Text>
        </TouchableOpacity>
        <View style={styles.menuSeparator} />
        <TouchableOpacity style={[styles.menuItem, styles.menuItemDestructive]} onPress={() => onSelect('blocked')}>
            <Text style={[styles.menuText, { color: '#D32F2F' }]}>Reject & Block</Text>
        </TouchableOpacity>
    </View>
));

const ReplyRow = React.memo(({ item, onPress }: { item: any, onPress: (item: any) => void }) => {
    let name = "Guest";
    const nameQuestion = item.form_replies?.find((q: any) => q.question.toLowerCase().includes('name'));
    if (nameQuestion) {
        name = nameQuestion.answer;
    }

    const formatDate = (timestamp: string) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
        <TouchableOpacity
            style={styles.replyRow}
            onPress={() => onPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.replyInfo}>
                <Text style={styles.replyName}>{name}</Text>
                <Text style={styles.replyDate}>{formatDate(item.timestamp)}</Text>
            </View>
            <View style={styles.arrowContainer}>
                <Image source={require('../../assets/img/common/forwardarrow.png')} style={styles.arrowIcon} resizeMode="contain" />
            </View>
        </TouchableOpacity>
    );
});

const RegistrationDashboard = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId } = route.params || {};
    const [activeTab, setActiveTab] = useState<'Form' | 'Replies'>('Form');
    const [hasForm, setHasForm] = useState<number | null>(null); // 0 = Created, 1 = Not Created (or vice versa per user req)
    const [isApprovalBasis, setIsApprovalBasis] = useState(false);
    // User said: "if has_registration_form : 0 then form created nathi" (0 means NOT created)
    // "and agr e 1 che to form created che" (1 means created)


    // Export State
    const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(false);

    // Modal State
    const [selectedReply, setSelectedReply] = useState<any>(null);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);

    // Date Modal State
    const [showDateModal, setShowDateModal] = useState(false);

    // Date Picker State
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    // Controls for individual pickers
    const [isStartPickerOpen, setStartPickerOpen] = useState(false);
    const [isEndPickerOpen, setEndPickerOpen] = useState(false);

    // Replies State
    const [replies, setReplies] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const handleExportAll = async () => {
        if (exportStatus === 'processing') {
            ToastAndroid.show("Export is already in process.", ToastAndroid.SHORT);
            return;
        }
        try {
            const res = await exportRegistrationReplies(eventId);
            if (res && res.success) {
                setExportStatus('processing');
                const msg = res.message || "Export started.";
                if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
            } else {
                if (Platform.OS === 'android') ToastAndroid.show("Export failed to start.", ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error("Export error:", error);
        }
    };

    const handleCheckStatus = async () => {
        if (checkingStatus) return;
        setCheckingStatus(true);
        try {
            const res = await getExportStatus(eventId);
            if (res && res.success) {
                if (res.status === 'completed') {
                    setExportStatus('completed');
                    setFileUrl(res.file_url);
                    if (Platform.OS === 'android') ToastAndroid.show("Export completed!", ToastAndroid.SHORT);
                } else if (res.status === 'processing') {
                    setExportStatus('processing'); // Keep processing
                    if (Platform.OS === 'android') ToastAndroid.show("Still processing...", ToastAndroid.SHORT);
                } else {
                    setExportStatus('idle'); // Reset if status is neither processing nor completed
                    if (Platform.OS === 'android') ToastAndroid.show("Export not found or failed.", ToastAndroid.SHORT);
                }
            } else {
                if (Platform.OS === 'android') ToastAndroid.show("Failed to check status.", ToastAndroid.SHORT);
            }
        } catch (error) {
            console.log("Check status error", error);
        } finally {
            setCheckingStatus(false);
        }
    }

    const handleDownload = () => {
        if (fileUrl) {
            Linking.openURL(fileUrl).catch(err => console.error("Couldn't load page", err));
        } else {
            if (Platform.OS === 'android') ToastAndroid.show("No file available for download.", ToastAndroid.SHORT);
        }
    }

    const handleExportByDatePress = () => {
        if (exportStatus === 'processing') {
            ToastAndroid.show("Export is already in process.", ToastAndroid.SHORT);
            return;
        }
        setStartDate(null);
        setEndDate(null);
        setShowDateModal(true);
    };

    const handleDateExportSubmit = async () => {
        let apiStartDate: string | undefined;
        let apiEndDate: string | undefined;

        if (startDate || endDate) {
            if (!startDate || !endDate) {
                Alert.alert("Invalid Range", "Please select both Start and End dates.");
                return;
            }

            // Convert Date object to YYYY-MM-DD
            const formatToYYYYMMDD = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            apiStartDate = formatToYYYYMMDD(startDate);
            apiEndDate = formatToYYYYMMDD(endDate);
        }

        setShowDateModal(false);

        try {
            console.log(`Starting export with dates: ${apiStartDate} to ${apiEndDate}`);
            const res = await exportRegistrationReplies(eventId, apiStartDate as any, apiEndDate as any);
            if (res && res.success) {
                setExportStatus('processing');
                const msg = res.message || "Export started.";
                if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
            } else {
                if (Platform.OS === 'android') ToastAndroid.show("Export failed to start.", ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error("Export error:", error);
            if (Platform.OS === 'android') ToastAndroid.show("Export error", ToastAndroid.SHORT);
        }
    };

    // Helper to display date safely
    const getDisplayDate = (date: Date | null) => {
        if (!date) return "dd-mm-yyyy";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Fetch Logic
    const fetchReplies = async (page = 1) => {
        if (loading) return;
        if (!eventId) {
            console.error("fetchReplies: No eventId");
            if (Platform.OS === 'android') ToastAndroid.show("Error: No Event ID", ToastAndroid.SHORT);
            return;
        }
        setLoading(true);

        try {
            console.log(`fetchReplies started for event ${eventId}, page ${page}`);

            const res = await getRegistrationAnswers(eventId, page);

            if (res && res.data && Array.isArray(res.data)) {
                setReplies(prev => page === 1 ? res.data : [...prev, ...res.data]);
                setHasMore(res.current_page < res.last_page);
                setCurrentPage(page);
            } else {
                setHasMore(false);
            }

        } catch (error) {
            console.error("Error fetching replies:", error);
            if (Platform.OS === 'android') ToastAndroid.show("Error fetching replies", ToastAndroid.SHORT);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreReplies = () => {
        if (!loading && hasMore) {
            fetchReplies(currentPage + 1);
        }
    };

    const handleUpdateStatus = async (status: 'accepted' | 'rejected' | 'blocked') => {
        // Enforce strict Guest ID usage.
        // Based on API JSON: 'event_user_id' holds the correct Guest ID (e.g., 1247897) matching the URL.
        const guestId = selectedReply?.event_user_id;

        if (!guestId) {
            Alert.alert("Error", "Guest ID missing. Please contact support.");
            return;
        }

        setShowActionMenu(false);

        try {
            console.log(`Sending Update for GuestId: ${guestId} (ReplyId: ${selectedReply.id})`);
            const res = await updateGuestStatus(eventId, guestId, status);

            if (res && res.success) {
                // User requirement: "user should get the notification"
                // Using Alert for explicit confirmation as Toast might be missed or "unselectable" context implying UX friction.
                Alert.alert("Success", `Guest status updated to ${status}.`, [
                    {
                        text: "OK", onPress: () => {
                            setShowReplyModal(false);
                            // Refresh list to reflect changes if needed (though list currently doesn't show status, it's good practice)
                            fetchReplies();
                        }
                    }
                ]);
            } else {
                Alert.alert("Error", res.message || "Update failed");
            }
        } catch (error) {
            console.error("Status update error", error);
            Alert.alert("Error", "Something went wrong.");
        }
    };

    useEffect(() => {
        if (activeTab === 'Replies' && eventId) {
            // Reset and fetch
            setReplies([]);
            setHasMore(true);
            setCurrentPage(1);
            fetchReplies(1);
        } else if (activeTab === 'Form' && eventId) {
            // Fetch details to check form status
            getEventDetails(eventId).then(res => {
                if (res && res.data) {
                    setHasForm(res.data.has_registration_form);
                    setIsApprovalBasis(res.data.registration_on_approval_basis === 1);
                }
            }).catch(err => console.log("Event details fetch error", err));
        }
    }, [activeTab, eventId]);

    const formatDate = (timestamp: string) => {
        if (!timestamp) return "";
        // timestamp format: "2025-12-09 12:17:34"
        // Target: "9th December 2025, 5:47 PM"
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const handleReplyPress = useCallback((item: any) => {
        requestAnimationFrame(() => {
            setSelectedReply(item);
            setShowReplyModal(true);
        });
    }, []);

    const renderReplyItem = useCallback(({ item }: { item: any }) => {
        return <ReplyRow item={item} onPress={handleReplyPress} />;
    }, [handleReplyPress]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>Registration Form</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Toggle */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleButton, activeTab === 'Form' && styles.activeButton]}
                    onPress={() => setActiveTab('Form')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.toggleText, activeTab === 'Form' && styles.activeText]}>Form</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, activeTab === 'Replies' && styles.activeButton]}
                    onPress={() => setActiveTab('Replies')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.toggleText, activeTab === 'Replies' && styles.activeText]}>Replies</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'Form' && hasForm === null ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#FF8A3C" />
                    </View>
                ) : activeTab === 'Form' ? (
                    hasForm === 1 ? (
                        <RegistrationFormEditor eventId={eventId} isEmbedded={true} />
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <View style={styles.createFormCard}>
                                <View style={styles.iconContainer}>
                                    <Image
                                        source={require('../../assets/img/eventdashboard/registration.png')}
                                        style={styles.mainIcon}
                                        resizeMode="contain"
                                    />
                                </View>
                                <Text style={styles.createFormTitle}>Create Registration Form</Text>
                                <Text style={styles.createFormSubtitle}>
                                    Collect details from your guests by creating a custom form.
                                </Text>
                                <TouchableOpacity
                                    style={styles.createButtonPrimary}
                                    activeOpacity={0.8}
                                    onPress={() => (navigation as any).navigate('RegistrationFormEditor', { eventId })}
                                >
                                    <Text style={styles.createButtonText}>Create Form</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )
                ) : (
                    <View style={styles.repliesContainer}>



                        {/* Export Buttons */}
                        <View style={styles.exportRow}>
                            <TouchableOpacity style={styles.exportButton} onPress={handleExportAll}>
                                <Image source={require('../../assets/img/eventdashboard/export.png')} style={styles.exportIcon} resizeMode="contain" />
                                <Text style={styles.exportButtonText}>Export All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.exportButton} onPress={handleExportByDatePress}>
                                <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.exportIcon} resizeMode="contain" />
                                <Text style={styles.exportButtonText}>Export By Date</Text>
                            </TouchableOpacity>

                            {/* Dynamic 3rd Button */}
                            {exportStatus === 'processing' ? (
                                <TouchableOpacity style={[styles.exportButton, styles.checkStatusButton]} onPress={handleCheckStatus}>
                                    <Image source={require('../../assets/img/eventdashboard/clock.png')} style={[styles.exportIcon, { tintColor: 'white' }]} resizeMode="contain" />
                                    <Text style={[styles.exportButtonText, { color: 'white' }]}>Check Status</Text>
                                </TouchableOpacity>
                            ) : exportStatus === 'completed' ? (
                                <TouchableOpacity style={[styles.exportButton, styles.downloadButton]} onPress={handleDownload}>
                                    <Image source={require('../../assets/img/eventdashboard/export.png')} style={[styles.exportIcon, { tintColor: 'white', transform: [{ rotate: '180deg' }] }]} resizeMode="contain" />
                                    <Text style={[styles.exportButtonText, { color: 'white' }]}>Download File</Text>
                                </TouchableOpacity>
                            ) : null}

                        </View>

                        {/* List */}
                        {loading && replies.length === 0 ? (
                            <ActivityIndicator size="large" color="#FF8A3C" style={{ marginTop: verticalScale(50) }} />
                        ) : (
                            <FlatList
                                data={replies}
                                renderItem={renderReplyItem}
                                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                                onEndReached={loadMoreReplies}
                                onEndReachedThreshold={0.5}
                                ListFooterComponent={loading && replies.length > 0 ? <ActivityIndicator color="#FF8A3C" style={{ margin: scale(20) }} /> : null}
                                ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No replies found</Text> : null}
                            />
                        )}
                    </View>
                )}
            </View>

            {/* Reply Details Modal */}
            <Modal
                visible={showReplyModal}
                transparent={true}
                animationType="none"
                onRequestClose={() => setShowReplyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Guest Details</Text>
                            <View style={styles.headerActions}>
                                {isApprovalBasis && (
                                    <TouchableOpacity
                                        style={styles.infoButton}
                                        onPress={() => {
                                            requestAnimationFrame(() => {
                                                setShowActionMenu(prev => !prev);
                                            });
                                        }}
                                    >
                                        <Image source={require('../../assets/img/common/info.png')} style={styles.infoIcon} resizeMode="contain" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => { setShowReplyModal(false); setShowActionMenu(false); }} style={styles.closeButton}>
                                    <Text style={styles.closeButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <FlatList
                            data={selectedReply?.form_replies}
                            keyExtractor={(_, i) => i.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{item.question}</Text>
                                    <Text style={styles.detailValue}>{item.answer || "-"}</Text>
                                </View>
                            )}
                            contentContainerStyle={styles.modalContent}
                        />

                        {/* Popup Menu */}
                        {showActionMenu && <ActionMenu onSelect={handleUpdateStatus} />}
                    </View>
                </View>
            </Modal>

            {/* Date Range Modal */}
            <Modal
                visible={showDateModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.dateModalContainer}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>Select Date Range</Text>
                            <TouchableOpacity onPress={() => setShowDateModal(false)}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dateInputContainer}>
                            <Text style={styles.dateLabel}>Start Date</Text>
                            <TouchableOpacity
                                style={styles.inputWrapper}
                                onPress={() => setStartPickerOpen(true)}
                            >
                                <Text style={[styles.dateInput, !startDate && { color: '#999' }]}>
                                    {getDisplayDate(startDate)}
                                </Text>
                                <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.inputIcon} resizeMode="contain" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dateInputContainer}>
                            <Text style={styles.dateLabel}>End Date</Text>
                            <TouchableOpacity
                                style={styles.inputWrapper}
                                onPress={() => setEndPickerOpen(true)}
                            >
                                <Text style={[styles.dateInput, !endDate && { color: '#999' }]}>
                                    {getDisplayDate(endDate)}
                                </Text>
                                <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.inputIcon} resizeMode="contain" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.helperText}>Select date range for export or leave empty for all replies</Text>

                        <View style={styles.dateModalFooter}>
                            <TouchableOpacity onPress={() => setShowDateModal(false)} style={styles.cancelButton}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleDateExportSubmit} style={styles.startExportButton}>
                                <Text style={styles.startExportButtonText}>Start Export</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <DatePicker
                modal
                open={isStartPickerOpen}
                date={startDate || new Date()}
                mode="date"
                onConfirm={(date) => {
                    setStartPickerOpen(false)
                    setStartDate(date)
                }}
                onCancel={() => {
                    setStartPickerOpen(false)
                }}
            />

            <DatePicker
                modal
                open={isEndPickerOpen}
                date={endDate || new Date()}
                mode="date"
                onConfirm={(date) => {
                    setEndPickerOpen(false)
                    setEndDate(date)
                }}
                onCancel={() => {
                    setEndPickerOpen(false)
                }}
            />
        </SafeAreaView>
    )
}

export default RegistrationDashboard

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(30),
        paddingBottom: verticalScale(10),
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: '500',
        color: '#111',
    },
    toggleContainer: {
        flexDirection: 'row',
        width: '90%',
        alignSelf: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: scale(12),
        padding: scale(4),
        marginBottom: verticalScale(10),
        marginTop: verticalScale(20),
    },
    toggleButton: {
        flex: 1,
        paddingVertical: verticalScale(10),
        alignItems: 'center',
        borderRadius: scale(10),
    },
    activeButton: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(1) },
        shadowOpacity: 0.1,
        elevation: 2,
    },
    toggleText: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: '#888',
    },
    activeText: {
        color: '#FF8A3C', // Theme Orange
    },
    content: {
        flex: 1,
        backgroundColor: 'white',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: verticalScale(10),
    },
    placeholderText: {
        fontSize: moderateScale(18),
        fontWeight: '600',
        color: '#333',
    },
    placeholderSubText: {
        fontSize: moderateScale(14),
        color: '#888',
    },
    createFormCard: {
        alignItems: 'center',
        padding: scale(30),
        backgroundColor: 'white',
        borderRadius: scale(16),
        width: '90%',
    },
    iconContainer: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: '#FFF3E0', // Light orange
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: verticalScale(20),
    },
    mainIcon: {
        width: scale(40),
        height: scale(40),
        tintColor: '#FF8A3C',
    },
    createFormTitle: {
        fontSize: moderateScale(20),
        fontWeight: '700',
        color: '#333',
        marginBottom: verticalScale(10),
        textAlign: 'center',
    },
    createFormSubtitle: {
        fontSize: moderateScale(14),
        color: '#666',
        textAlign: 'center',
        marginBottom: verticalScale(30),
        lineHeight: moderateScale(20),
    },
    createButtonPrimary: {
        backgroundColor: '#FF8A3C',
        paddingVertical: verticalScale(14),
        paddingHorizontal: scale(40),
        borderRadius: scale(30),
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: scale(6),
        elevation: 6,
        width: '100%',
        alignItems: 'center',
    },
    createButtonText: {
        color: 'white',
        fontSize: moderateScale(16),
        fontWeight: '600',
    },
    repliesContainer: {
        flex: 1,
    },
    badgeContainer: {
        alignItems: 'center',
        marginTop: verticalScale(10),
    },
    processingBadge: {
        backgroundColor: '#EF6C00', // Darker orange
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(6),
        borderRadius: scale(20),
    },
    processingText: {
        color: 'white',
        fontWeight: '700',
        fontSize: moderateScale(12),
    },
    exportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: scale(8),
        paddingVertical: verticalScale(20),
        paddingHorizontal: scale(16),
    },
    exportButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FF8A3C',
        borderRadius: scale(8),
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(2),
        gap: scale(4),
        backgroundColor: 'white',
    },
    checkStatusButton: {
        backgroundColor: '#EF6C00', // Orange fill
        borderColor: '#EF6C00',
    },
    downloadButton: {
        backgroundColor: '#2E7D32', // Green fill
        borderColor: '#2E7D32',
    },
    exportButtonText: {
        color: '#FF8A3C',
        fontWeight: '600',
        fontSize: moderateScale(11),
        textAlign: 'center',
    },
    exportIcon: {
        width: scale(14),
        height: scale(14),
        tintColor: '#FF8A3C',
    },
    listContent: {
        paddingHorizontal: scale(20),
        paddingBottom: verticalScale(20),
    },
    arrowContainer: {
        padding: scale(4),
    },
    arrowIcon: {
        width: scale(24),
        height: scale(24),
        // No tintColor to keep original orange gradient from asset
    },
    replyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    replyInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingLeft: scale(20), // Slight nudge from edge per user feedback
    },
    replyName: {
        fontSize: moderateScale(16),
        fontWeight: 'bold',
        color: '#111',
        textTransform: 'capitalize', // Make it proper
        marginBottom: verticalScale(4),
    },
    replyDate: {
        fontSize: moderateScale(12),
        color: '#888',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: verticalScale(50),
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        height: '50%',
        paddingTop: verticalScale(20),
        paddingHorizontal: scale(20),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: verticalScale(20),
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        color: '#111',
    },
    closeButton: {
        padding: scale(5),
    },
    closeButtonText: {
        fontSize: moderateScale(18),
        color: '#666',
        fontWeight: 'bold',
    },
    modalContent: {
        paddingTop: verticalScale(20),
        paddingBottom: verticalScale(40),
    },
    detailRow: {
        marginBottom: verticalScale(16),
        paddingBottom: verticalScale(12),
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    detailLabel: {
        fontSize: moderateScale(12),
        color: '#888',
        marginBottom: verticalScale(4),
        textTransform: 'uppercase',
        letterSpacing: scale(0.5),
    },
    detailValue: {
        fontSize: moderateScale(16),
        color: '#111',
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: verticalScale(20),
        color: '#666',
        fontSize: moderateScale(14),
    },
    // Menu Styles
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(16),
    },
    infoButton: {
        padding: scale(4),
    },
    infoIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: '#666',
    },
    popupMenu: {
        position: 'absolute',
        top: verticalScale(60), // Below header
        right: scale(20),
        backgroundColor: 'white',
        borderRadius: scale(12), // Smoother corners for "App UI" feel
        elevation: 10, // Higher elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: scale(6),
        width: scale(180), // Slightly wider
        zIndex: 1000, // Ensure top
        paddingVertical: verticalScale(8),
    },
    menuItem: {
        paddingVertical: verticalScale(14),
        paddingHorizontal: scale(16),
    },
    menuItemDestructive: {
        // backgroundColor: '#FFEBEE', // Removed per user request ("nothing selected")
    },
    menuText: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '500',
    },
    menuSeparator: {
        height: verticalScale(1),
        backgroundColor: '#eee',
    },
    // Date Modal Styles
    dateModalContainer: {
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(24),
        width: '90%',
        alignSelf: 'center',
        // Center vertically in overlay
        position: 'absolute',
        top: '30%',
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(24),
    },
    dateModalTitle: {
        fontSize: moderateScale(18),
        fontWeight: 'bold',
        color: '#111',
    },
    dateInputContainer: {
        marginBottom: verticalScale(20),
    },
    dateLabel: {
        fontSize: moderateScale(14),
        color: '#666',
        marginBottom: verticalScale(8),
        position: 'absolute',
        top: verticalScale(-10),
        left: scale(10),
        backgroundColor: 'white',
        paddingHorizontal: scale(4),
        zIndex: 1,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        height: verticalScale(50),
    },
    dateInput: {
        flex: 1,
        fontSize: moderateScale(16),
        color: '#333',
    },
    inputIcon: {
        width: scale(20),
        height: scale(20),
        tintColor: '#333',
    },
    helperText: {
        fontSize: moderateScale(12),
        color: '#888',
        marginBottom: verticalScale(24),
    },
    dateModalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: scale(16),
    },
    cancelButton: {
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(16),
    },
    cancelButtonText: {
        fontSize: moderateScale(16),
        color: '#333',
        fontWeight: '500',
    },
    startExportButton: {
        backgroundColor: '#EF6C00',
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(24),
        borderRadius: scale(8),
    },
    startExportButtonText: {
        fontSize: moderateScale(16),
        color: 'white',
        fontWeight: '600',
    }
})
