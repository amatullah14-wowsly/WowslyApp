import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Image } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
// import GuestScreenTemplate from '../Guests/GuestScreenTemplate'; // Removed per request
import { getRegistrationAnswers, exportRegistrationReplies, getExportStatus, getEventDetails } from '../../api/event';
import { ToastAndroid, Alert, Platform, Linking } from 'react-native';
import RegistrationFormEditor from './RegistrationFormEditor';

const RegistrationDashboard = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId } = route.params || {};
    const [activeTab, setActiveTab] = useState<'Form' | 'Replies'>('Form');
    const [hasForm, setHasForm] = useState<number | null>(null); // 0 = Created, 1 = Not Created (or vice versa per user req)
    // User said: "if has_registration_form : 0 then form created nathi" (0 means NOT created)
    // "and agr e 1 che to form created che" (1 means created)


    // Export State
    const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(false);

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
                    // The user said "has_registration_form" is in the response. 
                    // Usually getEventDetails returns { data: { ... } } or just the object?
                    // Let's assume safely.
                    const val = res.data.has_registration_form; // or directly res.has_registration_form?
                    // Based on api/event.js: return response.data;
                    // So if API returns standard JSON resource: { data: { ... } } -> res.data.has_registration_form
                    // If API returns direct object: { ... } -> res.has_registration_form
                    // I will try both or check logs if I could. User said "ana response ma has_registration_form avu male che"
                    setHasForm(val);
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
            <View style={styles.replyRow}>
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>
                        {name.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.replyInfo}>
                    <Text style={styles.replyName}>{name}</Text>
                    <Text style={styles.replyDate}>{formatDate(item.timestamp)}</Text>
                </View>
            </View>
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
                                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                                renderItem={renderReplyItem}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <Text>No replies found.</Text>
                                    </View>
                                }
                            />
                        )}
                    </View>
                )}
            </View>
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
    replyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 0,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: '#FFE0B2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    replyInfo: {
        flex: 1,
        gap: 4,
    },
    replyName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111',
    },
    replyDate: {
        fontSize: 13,
        color: '#666',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 50,
    }
})
