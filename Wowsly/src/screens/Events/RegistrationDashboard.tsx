import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Image, Modal, ScrollView } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
// import GuestScreenTemplate from '../Guests/GuestScreenTemplate'; // Removed per request
import { getRegistrationAnswers, exportRegistrationReplies, getExportStatus, getEventDetails, updateGuestStatus } from '../../api/event';
import { ToastAndroid, Alert, Platform, Linking } from 'react-native';
import RegistrationFormEditor from './RegistrationFormEditor';

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

    // Fetch Logic
    const fetchReplies = async () => {
        if (loading || !hasMore) return;
        if (!eventId) {
            console.error("fetchReplies: No eventId");
            if (Platform.OS === 'android') ToastAndroid.show("Error: No Event ID", ToastAndroid.SHORT);
            return;
        }
        setLoading(true);

        try {
            console.log(`fetchReplies started for event ${eventId}`);
            let allData: any[] = [];
            let page = 1;
            let fetching = true;

            while (fetching) {
                console.log(`Fetching replies page ${page}...`);
                const res = await getRegistrationAnswers(eventId, page);
                console.log(`Page ${page} res:`, res ? `Found ${res.data?.length} items` : 'No res');

                if (res && res.data && Array.isArray(res.data)) {
                    allData = [...allData, ...res.data];

                    if (res.current_page >= res.last_page || res.data.length === 0) {
                        fetching = false;
                    } else {
                        page++;
                    }
                    if (page > 50) fetching = false;
                } else {
                    fetching = false;
                }
            }

            console.log(`Total fetched: ${allData.length}`);
            setReplies(allData);
            setHasMore(false);

            // if (Platform.OS === 'android') ToastAndroid.show(`Fetched ${allData.length} replies`, ToastAndroid.SHORT);

        } catch (error) {
            console.error("Error fetching replies:", error);
            if (Platform.OS === 'android') ToastAndroid.show("Error fetching replies", ToastAndroid.SHORT);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch logic currently fetches all pages in loops, so loadMore is effectively no-op or re-fetch check
    const loadMoreReplies = () => {
        if (!loading && hasMore) {
            // Since fetchReplies fetches ALL pages in the while loop, we essentially don't need a per-page loadMore 
            // unless we refactor fetchReplies. For now, leave empty or log.
            // console.log("End reached");
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
            fetchReplies();
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

    const renderReplyItem = ({ item }: { item: any }) => {
        // Find Name from form_replies if top-level structure doesn't have it directly?
        // Payload sample had "form_replies": [{question: "Name", answer: "darshan"}]
        // And user object might not have "name" property at top level based on sample?
        // Sample: "id": 1883023, "timestamp": "...", "user_id": ..., "mobile": ..., "form_replies": [...]
        // I need to extract Name.

        let name = "Guest";
        const nameQuestion = item.form_replies?.find((q: any) => q.question.toLowerCase().includes('name'));
        if (nameQuestion) {
            name = nameQuestion.answer;
        }

        return (
            <TouchableOpacity
                style={styles.replyRow}
                onPress={() => {
                    setSelectedReply(item);
                    setShowReplyModal(true);
                }}
            >
                <View style={styles.replyInfo}>
                    <Text style={styles.replyName}>{name}</Text>
                    <Text style={styles.replyDate}>{formatDate(item.timestamp)}</Text>
                </View>
                {/* Custom Arrow Icon */}
                <View style={styles.arrowContainer}>
                    <Image source={require('../../assets/img/common/forwardarrow.png')} style={styles.arrowIcon} resizeMode="contain" />
                </View>
            </TouchableOpacity>
        );
    };

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
                                    onPress={() => navigation.navigate('RegistrationFormEditor', { eventId })}
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
                            <TouchableOpacity style={styles.exportButton}>
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
                            <ActivityIndicator size="large" color="#FF8A3C" style={{ marginTop: 50 }} />
                        ) : (
                            <FlatList
                                data={replies}
                                renderItem={renderReplyItem}
                                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                                onEndReached={loadMoreReplies}
                                onEndReachedThreshold={0.5}
                                ListFooterComponent={loading && replies.length > 0 ? <ActivityIndicator color="#FF8A3C" style={{ margin: 20 }} /> : null}
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
                animationType="slide"
                onRequestClose={() => setShowReplyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Guest Details</Text>
                            <View style={styles.headerActions}>
                                {isApprovalBasis && (
                                    <TouchableOpacity style={styles.infoButton} onPress={() => setShowActionMenu(!showActionMenu)}>
                                        <Image source={require('../../assets/img/common/info.png')} style={styles.infoIcon} resizeMode="contain" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => { setShowReplyModal(false); setShowActionMenu(false); }} style={styles.closeButton}>
                                    <Text style={styles.closeButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalContent} scrollEnabled={true}>
                            {selectedReply?.form_replies?.map((reply: any, index: number) => (
                                <View key={index} style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{reply.question}</Text>
                                    <Text style={styles.detailValue}>{reply.answer || "-"}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        {/* Popup Menu - Moved to end to ensure Z-Index priority over ScrollView */}
                        {showActionMenu && (
                            <View style={styles.popupMenu}>
                                <TouchableOpacity style={styles.menuItem} onPress={() => handleUpdateStatus('accepted')}>
                                    <Text style={styles.menuText}>Accept</Text>
                                </TouchableOpacity>
                                <View style={styles.menuSeparator} />
                                <TouchableOpacity style={styles.menuItem} onPress={() => handleUpdateStatus('rejected')}>
                                    <Text style={styles.menuText}>Reject</Text>
                                </TouchableOpacity>
                                <View style={styles.menuSeparator} />
                                <TouchableOpacity style={[styles.menuItem, styles.menuItemDestructive]} onPress={() => handleUpdateStatus('blocked')}>
                                    <Text style={[styles.menuText, { color: '#D32F2F' }]}>Reject & Block</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
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
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        fontSize: 20,
        fontWeight: '500',
        color: '#111',
    },
    toggleContainer: {
        flexDirection: 'row',
        width: '90%',
        alignSelf: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 4,
        marginBottom: 10,
        marginTop: 20,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeButton: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        elevation: 2,
    },
    toggleText: {
        fontSize: 15,
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
        gap: 10,
    },
    placeholderText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    placeholderSubText: {
        fontSize: 14,
        color: '#888',
    },
    createFormCard: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: 'white',
        borderRadius: 16,
        width: '90%',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFF3E0', // Light orange
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    mainIcon: {
        width: 40,
        height: 40,
        tintColor: '#FF8A3C',
    },
    createFormTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    createFormSubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 20,
    },
    createButtonPrimary: {
        backgroundColor: '#FF8A3C',
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 30,
        shadowColor: "#FF8A3C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
        width: '100%',
        alignItems: 'center',
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    repliesContainer: {
        flex: 1,
    },
    badgeContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    processingBadge: {
        backgroundColor: '#EF6C00', // Darker orange
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    processingText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 12,
    },
    exportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    exportButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FF8A3C',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 2,
        gap: 4,
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
        fontSize: 11,
        textAlign: 'center',
    },
    exportIcon: {
        width: 14,
        height: 14,
        tintColor: '#FF8A3C',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    arrowContainer: {
        padding: 4,
    },
    arrowIcon: {
        width: 24,
        height: 24,
        // No tintColor to keep original orange gradient from asset
    },
    replyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    replyInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingLeft: 20, // Slight nudge from edge per user feedback
    },
    replyName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        textTransform: 'capitalize', // Make it proper
        marginBottom: 4,
    },
    replyDate: {
        fontSize: 12,
        color: '#888',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 50,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '70%',
        paddingTop: 20,
        paddingHorizontal: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
    },
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 18,
        color: '#666',
        fontWeight: 'bold',
    },
    modalContent: {
        paddingTop: 20,
        paddingBottom: 40,
    },
    detailRow: {
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    detailLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValue: {
        fontSize: 16,
        color: '#111',
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#666',
        fontSize: 14,
    },
    // Menu Styles
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    infoButton: {
        padding: 4,
    },
    infoIcon: {
        width: 24,
        height: 24,
        tintColor: '#666',
    },
    popupMenu: {
        position: 'absolute',
        top: 60, // Below header
        right: 20,
        backgroundColor: 'white',
        borderRadius: 12, // Smoother corners for "App UI" feel
        elevation: 10, // Higher elevation
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        width: 180, // Slightly wider
        zIndex: 1000, // Ensure top
        paddingVertical: 8,
    },
    menuItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    menuItemDestructive: {
        // backgroundColor: '#FFEBEE', // Removed per user request ("nothing selected")
    },
    menuText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    menuSeparator: {
        height: 1,
        backgroundColor: '#eee',
    }
})
