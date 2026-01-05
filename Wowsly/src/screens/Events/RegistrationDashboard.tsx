import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Image, Modal, ScrollView, TextInput } from 'react-native'
import DatePicker from 'react-native-date-picker'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
// import GuestScreenTemplate from '../Guests/GuestScreenTemplate'; // Removed per request
import { getRegistrationAnswers, exportRegistrationReplies, getExportStatus, getEventDetails, updateGuestStatus } from '../../api/event';
import { ToastAndroid, Alert, Platform, Linking, useWindowDimensions } from 'react-native';
import RegistrationFormEditor from './RegistrationFormEditor';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';

const ActionMenu = React.memo(({ onSelect, styles }: { onSelect: (status: 'accepted' | 'rejected' | 'blocked') => void, styles: any }) => (
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

const HeaderMenu = React.memo(({ onSelect, onClose, styles }: { onSelect: (option: 'edit_form' | 'export_all' | 'export_date') => void, onClose: () => void, styles: any }) => (
    <Modal transparent visible={true} animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.headerMenuOverlay} activeOpacity={1} onPress={onClose}>
            <View style={styles.headerMenuContainer}>

                <TouchableOpacity style={styles.headerMenuItem} onPress={() => onSelect('edit_form')}>
                    <Text style={styles.headerMenuText}>Edit Form</Text>
                </TouchableOpacity>
                <View style={styles.headerMenuSeparator} />
                <TouchableOpacity style={styles.headerMenuItem} onPress={() => onSelect('export_all')}>
                    <Text style={styles.headerMenuText}>Export All</Text>
                </TouchableOpacity>
                <View style={styles.headerMenuSeparator} />
                <TouchableOpacity style={styles.headerMenuItem} onPress={() => onSelect('export_date')}>
                    <Text style={styles.headerMenuText}>Export By Date</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    </Modal>
));

const ReplyRow = React.memo(({ item, onPress, onActionPress, styles }: { item: any, onPress: (item: any) => void, onActionPress: (item: any) => void, styles: any }) => {
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
            <TouchableOpacity onPress={() => onPress(item)} style={styles.actionIconContainer}>
                <Image source={require('../../assets/img/common/info.png')} style={styles.actionIcon} resizeMode="contain" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});

const RegistrationDashboard = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId } = route.params || {};

    const { width } = useWindowDimensions();
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

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
    const [showQuickActionModal, setShowQuickActionModal] = useState(false); // New Quick Action Modal
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);

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

    const handleHeaderMenuSelect = (option: 'edit_form' | 'export_all' | 'export_date') => {
        setShowHeaderMenu(false);
        setTimeout(() => {
            if (option === 'edit_form') {
                (navigation as any).navigate('RegistrationFormEditor', { eventId });
            } else if (option === 'export_all') {
                handleExportAll();
            } else if (option === 'export_date') {
                handleExportByDatePress();
            }
        }, 300);
    };

    const handleQuickAction = async (status: 'accepted' | 'rejected' | 'blocked') => {
        const guestId = selectedReply?.event_user_id;
        if (!guestId) {
            Alert.alert("Error", "Guest ID missing.");
            return;
        }

        setShowQuickActionModal(false);

        try {
            const res = await updateGuestStatus(eventId, guestId, status);
            if (res && res.success) {
                Alert.alert("Success", `Guest status updated to ${status}.`, [
                    { text: "OK", onPress: () => fetchReplies() }
                ]);
            } else {
                Alert.alert("Error", res.message || "Update failed");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Something went wrong");
        }
    }

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
        if (eventId) {
            // Reset and fetch
            setReplies([]);
            setHasMore(true);
            setCurrentPage(1);
            fetchReplies(1);
        }
    }, [eventId]);

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

    const handleActionPress = useCallback((item: any) => {
        setSelectedReply(item);
        setShowQuickActionModal(true);
    }, []);

    const renderReplyItem = useCallback(({ item }: { item: any }) => {
        return <ReplyRow item={item} onPress={handleReplyPress} onActionPress={handleActionPress} styles={styles} />;
    }, [handleReplyPress, handleActionPress, styles]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>Replies</Text>
                <TouchableOpacity onPress={() => setShowHeaderMenu(true)} style={styles.menuButton}>
                    <Image source={require('../../assets/img/form/menu.png')} style={styles.menuIcon} resizeMode="contain" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.repliesContainer}>

                    {/* Status / Download Button (Only visible if active/completed) */}
                    {(exportStatus === 'processing' || exportStatus === 'completed') && (
                        <View style={styles.statusButtonContainer}>
                            {exportStatus === 'processing' ? (
                                <TouchableOpacity style={[styles.exportButton, styles.checkStatusButton]} onPress={handleCheckStatus}>
                                    <Image source={require('../../assets/img/eventdashboard/clock.png')} style={[styles.exportIcon, { tintColor: 'white' }]} resizeMode="contain" />
                                    <Text style={[styles.exportButtonText, { color: 'white' }]}>Check Status</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={[styles.exportButton, styles.downloadButton]} onPress={handleDownload}>
                                    <Image source={require('../../assets/img/eventdashboard/export.png')} style={[styles.exportIcon, { tintColor: 'white', transform: [{ rotate: '180deg' }] }]} resizeMode="contain" />
                                    <Text style={[styles.exportButtonText, { color: 'white' }]}>Download File</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* List */}
                    {loading && replies.length === 0 ? (
                        <ActivityIndicator size="large" color="#FF8A3C" style={{ marginTop: verticalScale(50) }} />
                    ) : (
                        <FlatList
                            data={replies}
                            renderItem={renderReplyItem}
                            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                            onEndReached={() => {
                                if (!loading && hasMore) {
                                    fetchReplies(currentPage + 1);
                                }
                            }}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={loading && replies.length > 0 ? <ActivityIndicator color="#FF8A3C" style={{ margin: scale(20) }} /> : null}
                            ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No replies found</Text> : null}
                        />
                    )}
                </View>
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

                        {/* Popup Menu (for Details Modal) */}
                        {showActionMenu && <ActionMenu onSelect={handleUpdateStatus} styles={styles} />}
                    </View>
                </View>
            </Modal>

            {/* Quick Action Modal (Center) */}
            <Modal
                visible={showQuickActionModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowQuickActionModal(false)}
            >
                <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={styles.quickActionCard}>
                        <Text style={styles.quickActionTitle}>Action for Guest</Text>
                        {selectedReply && (
                            <Text style={styles.quickActionsubtitle}>
                                {selectedReply.form_replies?.find((q: any) => q.question.toLowerCase().includes('name'))?.answer || "Guest"}
                            </Text>
                        )}
                        <TouchableOpacity style={styles.quickActionButton} onPress={() => handleQuickAction('accepted')}>
                            <Text style={styles.quickActionText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickActionButton} onPress={() => handleQuickAction('rejected')}>
                            <Text style={styles.quickActionText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.quickActionButton, { borderBottomWidth: 0 }]} onPress={() => handleQuickAction('blocked')}>
                            <Text style={[styles.quickActionText, { color: '#D32F2F' }]}>Reject & Block</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelActionButton} onPress={() => setShowQuickActionModal(false)}>
                            <Text style={styles.cancelActionText}>Cancel</Text>
                        </TouchableOpacity>
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
            {/* Header Menu */}
            {showHeaderMenu && (
                <HeaderMenu onSelect={handleHeaderMenuSelect} onClose={() => setShowHeaderMenu(false)} styles={styles} />
            )}
        </SafeAreaView>
    )
}

export default RegistrationDashboard

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: moderateScale(20),
        paddingTop: 30, // Fixed top padding
        paddingBottom: 10, // Fixed bottom padding
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        fontSize: moderateScale(20),
        fontWeight: '500',
        color: '#111',
    },
    tabContainer: {
        flexDirection: 'row',
        width: '90%',
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: moderateScale(12),
        padding: moderateScale(4),
        marginBottom: 10,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: moderateScale(4),
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10, // Increased padding
        borderRadius: moderateScale(8),
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTabButton: {
        backgroundColor: '#FF8A3C',
    },
    tabText: {
        fontSize: moderateScale(15),
        fontWeight: '600',
        color: '#FF8A3C', // Inactive is orange
    },
    activeTabText: {
        color: '#FFFFFF', // Active is white
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
        padding: moderateScale(30),
        backgroundColor: 'white',
        borderRadius: moderateScale(16),
        width: '90%',
    },
    iconContainer: {
        width: moderateScale(80),
        height: moderateScale(80),
        borderRadius: moderateScale(40),
        backgroundColor: '#FFF3E0', // Light orange
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: verticalScale(20),
    },
    mainIcon: {
        width: moderateScale(40),
        height: moderateScale(40),
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
        paddingVertical: 14,
        paddingHorizontal: moderateScale(40),
        borderRadius: moderateScale(30),
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(6),
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
        paddingHorizontal: moderateScale(16),
        paddingVertical: verticalScale(6),
        borderRadius: moderateScale(20),
    },
    processingText: {
        color: 'white',
        fontWeight: '700',
        fontSize: moderateScale(12),
    },
    exportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: moderateScale(8),
        paddingVertical: verticalScale(20),
        paddingHorizontal: moderateScale(16),
    },
    exportButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FF8A3C',
        borderRadius: moderateScale(8),
        paddingVertical: 10,
        paddingHorizontal: moderateScale(2),
        gap: moderateScale(4),
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
    statusButtonContainer: {
        paddingHorizontal: moderateScale(16),
        paddingVertical: verticalScale(10),
    },
    menuButton: {
        padding: moderateScale(8),
    },
    menuIcon: {
        width: moderateScale(20),
        height: moderateScale(20),
        tintColor: '#000000',
    },
    // Header Menu Styles
    headerMenuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.05)', // Very subtle dim for focus
    },
    headerMenuContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? verticalScale(100) : verticalScale(70),
        right: moderateScale(20),
        backgroundColor: 'white',
        borderRadius: moderateScale(12),
        width: moderateScale(200),
        // Clean Shadow
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(12),
        borderWidth: 1,
        borderColor: '#f5f5f5',
    },
    headerMenuItem: {
        paddingVertical: verticalScale(16),
        paddingHorizontal: moderateScale(20),
    },
    headerMenuText: {
        fontSize: moderateScale(FontSize.md),
        color: '#222',
        fontWeight: '500',
    },
    headerMenuSeparator: {
        height: 1,
        backgroundColor: '#F0F0F0',
    },
    exportButtonText: {
        color: '#FF8A3C',
        fontWeight: '600',
        fontSize: moderateScale(FontSize.xs), // 11 -> xs(12) or keep literal 11? xs is close enough.
        textAlign: 'center',
    },
    exportIcon: {
        width: moderateScale(14),
        height: moderateScale(14),
        tintColor: '#FF8A3C',
    },
    listContent: {
        paddingHorizontal: moderateScale(20),
        paddingBottom: verticalScale(20),
    },
    // arrowContainer removed
    // arrowIcon removed
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
        paddingLeft: moderateScale(10),
    },
    actionIconContainer: {
        padding: moderateScale(8),
        marginHorizontal: moderateScale(4),
    },
    actionIcon: {
        width: moderateScale(22),
        height: moderateScale(22),
        tintColor: '#FF8A3C'
    },
    replyName: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: 'bold',
        color: '#111',
        textTransform: 'capitalize', // Make it proper
        marginBottom: verticalScale(4),
    },
    replyDate: {
        fontSize: moderateScale(FontSize.xs),
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
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        height: '50%',
        paddingTop: verticalScale(20),
        paddingHorizontal: moderateScale(20),
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
        fontSize: moderateScale(FontSize.lg),
        fontWeight: 'bold',
        color: '#111',
    },
    closeButton: {
        padding: moderateScale(5),
    },
    closeButtonText: {
        fontSize: moderateScale(FontSize.lg),
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
        fontSize: moderateScale(FontSize.xs),
        color: '#888',
        marginBottom: verticalScale(4),
        textTransform: 'uppercase',
        letterSpacing: moderateScale(0.5),
    },
    detailValue: {
        fontSize: moderateScale(FontSize.md),
        color: '#111',
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: verticalScale(20),
        color: '#666',
        fontSize: moderateScale(FontSize.sm),
    },
    // Menu Styles
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(16),
    },
    infoButton: {
        padding: moderateScale(4),
    },
    infoIcon: {
        width: moderateScale(24),
        height: moderateScale(24),
        tintColor: '#666',
    },
    popupMenu: {
        position: 'absolute',
        top: verticalScale(60), // Below header
        right: moderateScale(20),
        backgroundColor: 'white',
        borderRadius: moderateScale(12), // Smoother corners for "App UI" feel
        elevation: 10, // Higher elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(6),
        width: moderateScale(180), // Slightly wider
        zIndex: 1000, // Ensure top
        paddingVertical: verticalScale(8),
    },
    menuItem: {
        paddingVertical: verticalScale(14),
        paddingHorizontal: moderateScale(16),
    },
    menuItemDestructive: {
        // backgroundColor: '#FFEBEE', // Removed per user request ("nothing selected")
    },
    menuText: {
        fontSize: moderateScale(FontSize.sm),
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
        borderRadius: moderateScale(16),
        padding: moderateScale(24),
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
        fontSize: moderateScale(FontSize.lg),
        fontWeight: 'bold',
        color: '#111',
    },
    dateInputContainer: {
        marginBottom: verticalScale(20),
    },
    dateLabel: {
        fontSize: moderateScale(FontSize.sm),
        color: '#666',
        marginBottom: verticalScale(8),
        position: 'absolute',
        top: verticalScale(-10),
        left: moderateScale(10),
        backgroundColor: 'white',
        paddingHorizontal: moderateScale(4),
        zIndex: 1,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: moderateScale(8),
        paddingHorizontal: moderateScale(12),
        height: verticalScale(50),
    },
    dateInput: {
        flex: 1,
        fontSize: moderateScale(FontSize.md),
        color: '#333',
    },
    inputIcon: {
        width: moderateScale(20),
        height: moderateScale(20),
        tintColor: '#333',
    },
    helperText: {
        fontSize: moderateScale(FontSize.xs),
        color: '#888',
        marginBottom: verticalScale(24),
    },
    dateModalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: moderateScale(16),
    },
    cancelButton: {
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(16),
    },
    cancelButtonText: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        fontWeight: '500',
    },
    startExportButton: {
        backgroundColor: '#EF6C00',
        paddingVertical: verticalScale(10),
        paddingHorizontal: moderateScale(24),
        borderRadius: moderateScale(8),
    },
    startExportButtonText: {
        fontSize: moderateScale(FontSize.md),
        color: 'white',
        fontWeight: '600',
    },
    quickActionCard: {
        backgroundColor: 'white',
        width: '80%',
        borderRadius: moderateScale(16),
        padding: moderateScale(20),
        alignItems: 'center',
        elevation: 10,
    },
    quickActionTitle: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: 'bold',
        marginBottom: verticalScale(5),
    },
    quickActionsubtitle: {
        fontSize: moderateScale(FontSize.sm),
        color: '#666',
        marginBottom: verticalScale(20),
    },
    quickActionButton: {
        paddingVertical: verticalScale(14),
        width: '100%',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    quickActionText: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        color: '#333',
    },
    cancelActionButton: {
        marginTop: verticalScale(10),
        paddingVertical: verticalScale(10),
    },
    cancelActionText: {
        fontSize: moderateScale(FontSize.sm),
        color: '#999',
        fontWeight: '600',
    }
})
