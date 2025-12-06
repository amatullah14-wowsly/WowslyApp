import React, { useState, useEffect, useMemo } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Image,
    FlatList,
    TextInput,
    ActivityIndicator,
    DeviceEventEmitter,
} from 'react-native';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { getEventUsers, makeGuestManager, makeGuestUser, verifyQrCode } from '../../api/event';
import Toast from 'react-native-toast-message';
import GuestDetailsModal from '../../components/GuestDetailsModal';
import BackButton from '../../components/BackButton';
import { getLocalCheckedInGuests } from '../../db';
import { scanStore, getMergedGuest } from '../../context/ScanStore';

type GuestListRoute = RouteProp<
    {
        OnlineGuestList: {
            eventTitle?: string;
            eventId?: string;
        };
    },
    'OnlineGuestList'
>;

const SEARCH_ICON = {
    uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};
const NOGUESTS_ICON = require('../../assets/img/common/noguests.png');

type TabType = 'registered' | 'invited';

const statusChipStyles: Record<string, { backgroundColor: string; color: string }> = {
    'Checked In': { backgroundColor: '#E3F2FD', color: '#1565C0' },
    Pending: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
    'No-Show': { backgroundColor: '#FFE2E2', color: '#BE2F2F' },
    'blocked': { backgroundColor: '#FFEBEE', color: '#C62828' },
    'registered': { backgroundColor: '#E8F5E9', color: '#2E7D32' },
    'invited': { backgroundColor: '#E0F2F1', color: '#00695C' },
};

const OnlineGuestList = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<GuestListRoute>();
    const [activeTab, setActiveTab] = useState<TabType>('registered');
    const [searchQuery, setSearchQuery] = useState('');
    const [guests, setGuests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState(0);

    const eventTitle = route.params?.eventTitle ?? 'Selected Event';
    const eventId = route.params?.eventId;

    /* ---------------------- Fetch on load & tab change ---------------------- */
    useEffect(() => {
        if (eventId) fetchGuests();
    }, [eventId, activeTab]);

    /* ---------------------- Refresh when screen focused ---------------------- */
    useFocusEffect(
        React.useCallback(() => {
            if (eventId) fetchGuests();
        }, [eventId, activeTab])
    );

    /* ---------------------- Real-time update listener ---------------------- */
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', () => {
            setLastUpdate(Date.now());
        });

        return () => subscription.remove();
    }, []);

    /* ---------------------- Fetch guest list ---------------------- */
    const fetchGuests = async () => {
        setLoading(true);

        try {
            const res = await getEventUsers(eventId, 1, 'all');
            let allGuests = res?.data || [];

            // 🔥 Normalize ID (VERY IMPORTANT)
            allGuests = allGuests.map(g => ({
                ...g,
                id: g.id || g.guest_id || g.event_user_id,
            }));

            // Filter by invited vs registered
            let filtered = allGuests.filter((g: any) => {
                const isOwnerGenerated = g.generated_by_owner === 1;
                return activeTab === 'invited' ? isOwnerGenerated : !isOwnerGenerated;
            });

            // Merge local DB check-ins
            try {
                const localCheckins = await getLocalCheckedInGuests(Number(eventId));

                filtered = filtered.map((apiGuest: any) => {
                    const match = localCheckins.find(u =>
                        (u.qr_code && apiGuest.qr_code && u.qr_code === apiGuest.qr_code) ||
                        (u.guest_id && apiGuest.id && String(u.guest_id) === String(apiGuest.id))
                    );

                    if (!match) return apiGuest;

                    const localUsed = match.used_entries || 0;
                    const apiUsed = apiGuest.used_entries || 0;

                    return {
                        ...apiGuest,
                        used_entries: Math.max(apiUsed, localUsed),
                        status: 'Checked In',
                    };
                });
            } catch (err) {
                console.warn("Local check-ins failed:", err);
            }

            setGuests(filtered);
        } catch (err) {
            console.error("Fetch error:", err);
            setGuests([]);
        }

        setLoading(false);
    };

    /* ---------------------- Merge + search ---------------------- */
    const filteredGuests = useMemo(() => {
        return guests
            .map(g => getMergedGuest(g))
            .filter(guest => {
                const q = searchQuery.trim().toLowerCase();
                if (!q) return true;

                const name = (guest.name || `${guest.first_name} ${guest.last_name}`).toLowerCase();
                const phone = (guest.phone || '').toLowerCase();
                const id = (guest.id || '').toString();

                return (
                    name.includes(q) ||
                    phone.includes(q) ||
                    id.includes(q)
                );
            });
    }, [guests, searchQuery, lastUpdate]);

    /* ---------------------- Render each guest ---------------------- */
    const renderGuest = ({ item }: { item: any }) => {
        const name = item.name || `${item.first_name} ${item.last_name}`;
        const avatar = item.avatar || item.profile_photo;

        const rawStatus = item.status || activeTab;
        let status = rawStatus === 'active' ? 'Pending' : rawStatus;

        const ticketData = item.ticket_data || {};
        const totalEntries = item.total_entries || ticketData.tickets_bought || 1;
        const usedEntries = item.used_entries || ticketData.used_entries || 0;

        let statusStyle = statusChipStyles[status] || statusChipStyles['registered'];

        if (totalEntries > 1) {
            status = `${usedEntries}/${totalEntries}`;
            statusStyle = usedEntries >= totalEntries
                ? statusChipStyles['Checked In']
                : statusChipStyles['Pending'];
        }

        return (
            <Swipeable
                overshootRight={false}
                renderRightActions={() => (
                    <View style={styles.rowActions}>
                        <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
                            <Text style={styles.actionText}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                )}
            >
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        const id = (item.id || item.guest_id || item.event_user_id)?.toString();
                        console.log("Selected Guest ID:", id);
                        setSelectedGuestId(id);
                        setModalVisible(true);
                    }}
                >
                    <View style={styles.guestRow}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarPlaceholderText}>{name.charAt(0)}</Text>
                            </View>
                        )}

                        <View style={styles.guestInfo}>
                            <Text style={styles.guestName}>{name}</Text>
                        </View>

                        <View style={[styles.statusChip, statusStyle]}>
                            <Text style={[styles.statusChipText, { color: statusStyle.color }]}>
                                {status}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    /* ---------------------- UI ---------------------- */
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <BackButton onPress={() => navigation.goBack()} />
                    <Text style={styles.title}>{eventTitle}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <Text style={styles.pageTitle}>Guest Lists</Text>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'registered' && styles.activeTab]}
                        onPress={() => setActiveTab('registered')}
                    >
                        <Text style={[styles.tabText, activeTab === 'registered' && styles.activeTabText]}>
                            Registered Guests
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'invited' && styles.activeTab]}
                        onPress={() => setActiveTab('invited')}
                    >
                        <Text style={[styles.tabText, activeTab === 'invited' && styles.activeTabText]}>
                            Invited Guests
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <Image source={SEARCH_ICON} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Guest List */}
                <GestureHandlerRootView style={styles.listWrapper}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#FF8A3C" />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredGuests}
                            keyExtractor={(item, index) =>
                                `${item.id || item.event_user_id}-${index}`
                            }
                            contentContainerStyle={styles.listContent}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            renderItem={renderGuest}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                                    <Text style={styles.emptyTitle}>No guests found</Text>
                                    <Text style={styles.emptySubtitle}>Try a different name</Text>
                                </View>
                            }
                        />
                    )}
                </GestureHandlerRootView>

                {/* Modal */}
                <GuestDetailsModal
                    visible={modalVisible}
                    onClose={() => {
                        setModalVisible(false);
                        setSelectedGuestId(null);
                    }}
                    eventId={eventId}
                    guestId={selectedGuestId || undefined}
                    guest={guests.find(g => String(g.id) === String(selectedGuestId))}
                    onManualCheckIn={async () => {
                        const guest = guests.find(g => String(g.id) === String(selectedGuestId));
                        if (!guest) return;

                        const guestUuid = guest.uuid || guest.guest_uuid || guest.unique_id || guest.qr_code;

                        if (guestUuid) {
                            try {
                                const res = await verifyQrCode(eventId, { qrGuestUuid: guestUuid });
                                if (res && (res.message === "QR code verified" || res.success)) {
                                    Toast.show({
                                        type: 'success',
                                        text1: 'Check-in Successful',
                                        text2: `${guest.name || 'Guest'} checked in successfully`
                                    });
                                    fetchGuests(); // Refresh list
                                    setModalVisible(false);
                                } else {
                                    Toast.show({
                                        type: 'error',
                                        text1: 'Check-in Failed',
                                        text2: res?.message || 'Verification failed'
                                    });
                                }
                            } catch (error) {
                                console.error("Manual check-in error:", error);
                                Toast.show({
                                    type: 'error',
                                    text1: 'Check-in Failed',
                                    text2: 'An error occurred'
                                });
                            }
                        } else {
                            Toast.show({
                                type: 'error',
                                text1: 'Check-in Failed',
                                text2: 'Guest UUID not found'
                            });
                        }
                    }}
                    onMakeManager={async (guestId) => {
                        await makeGuestManager(eventId, guestId);
                        fetchGuests();
                    }}
                    onMakeGuest={async (guestId) => {
                        await makeGuestUser(eventId, guestId, activeTab);
                        fetchGuests();
                    }}
                />
            </View>
        </SafeAreaView>
    );
};

export default OnlineGuestList;



/* styles unchanged... */


const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'white',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },

    title: {
        flex: 1,
        marginHorizontal: 16,
        fontSize: 22,
        fontWeight: '700',
        color: '#1F1F1F',
        textAlign: 'center',
    },
    iconPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE8DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconPlaceholderText: {
        fontSize: 18,
        color: '#3B3B3B',
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F1F1F',
        marginBottom: 20,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 4,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTab: {
        backgroundColor: '#FF8A3C',
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FF8A3C',
    },
    activeTabText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    searchIcon: {
        width: 16,
        height: 16,
        marginRight: 8,
        tintColor: '#9B9B9B',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111111',
    },
    listWrapper: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 24,
    },
    separator: {
        height: 12,
    },
    guestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 24,
        marginRight: 16,
    },
    avatarPlaceholder: {
        backgroundColor: '#FF8A3C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    guestInfo: {
        flex: 1,
    },
    guestName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111111',
    },
    statusChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusChipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    rowActions: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
    },
    actionButton: {
        width: 70,
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
    },
    editButton: {
        backgroundColor: '#FF8A3C',
    },
    actionText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    emptyState: {
        marginTop: 80,
        alignItems: 'center',
        gap: 12,
    },
    emptyIcon: {
        width: 120,
        height: 120,
        resizeMode: 'contain',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#7A7A7A',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
