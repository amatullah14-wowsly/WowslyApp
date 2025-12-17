import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Image } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
// import GuestScreenTemplate from '../Guests/GuestScreenTemplate'; // Removed per request
import { getRegistrationAnswers } from '../../api/event';

const RegistrationDashboard = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId } = route.params || {};
    const [activeTab, setActiveTab] = useState<'Form' | 'Replies'>('Form');

    // Replies State
    const [replies, setReplies] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Fetch Logic
    const fetchReplies = async () => {
        if (loading || !hasMore) return;
        setLoading(true);

        try {
            // Loop until all pages are fetched (as requested: "fetch all the pages")
            // Or we can implement pagination if list is huge. 
            // Request said: "fetch all the pages for the replies"
            // I'll implement a loop here to fetch ONE page at a time if user scrolls, 
            // OR fetch ALL at once if that's strictly implied.
            // "fetch all the pages for the replies" implies getting everything. 
            // Let's try recursive fetch or loop to get everything initially if dataset isn't huge.
            // But typical mobile pattern is infinite scroll.
            // However, the screenshot shows a scrollbar. 
            // Optimally, I'll fetch page 1, and if Response has more pages, I'll fetch them.
            // BUT, strictly following "fetch all pages", I will loop.

            let allData: any[] = [];
            let page = 1;
            let fetching = true;

            while (fetching) {
                console.log(`Fetching replies page ${page}...`);
                const res = await getRegistrationAnswers(eventId, page);

                if (res && res.data && Array.isArray(res.data)) {
                    allData = [...allData, ...res.data];

                    if (res.current_page >= res.last_page || res.data.length === 0) {
                        fetching = false;
                    } else {
                        page++;
                    }
                    // Safety break
                    if (page > 50) fetching = false;
                } else {
                    fetching = false;
                }
            }

            setReplies(allData);
            setHasMore(false); // Fetched all

        } catch (error) {
            console.error("Error fetching replies:", error);
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
                {activeTab === 'Form' ? (
                    <View style={styles.placeholderContainer}>
                        <Text style={styles.placeholderText}>Registration Form Setup</Text>
                        <Text style={styles.placeholderSubText}>Coming Soon</Text>
                    </View>
                ) : (
                    <View style={styles.repliesContainer}>
                        {/* Export Buttons */}
                        <View style={styles.exportRow}>
                            <TouchableOpacity style={styles.exportButton}>
                                <Image source={require('../../assets/img/eventdashboard/export.png')} style={styles.exportIcon} resizeMode="contain" />
                                <Text style={styles.exportButtonText}>Export All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.exportButton}>
                                <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.exportIcon} resizeMode="contain" />
                                <Text style={styles.exportButtonText}>Export By Date</Text>
                            </TouchableOpacity>
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
    repliesContainer: {
        flex: 1,
    },
    exportRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        paddingVertical: 20,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF8A3C',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 24,
        gap: 8,
        backgroundColor: 'white',
    },
    exportButtonText: {
        color: '#FF8A3C',
        fontWeight: '600',
        fontSize: 14,
    },
    exportIcon: {
        width: 16,
        height: 16,
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
        borderBottomWidth: 0, // No separators visible in screenshot except nice spacing
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 16,
    },
    avatarPlaceholder: {
        backgroundColor: '#FFE0B2', // Light orange circle
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 20,
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
        fontWeight: '400',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 50,
    }
})
