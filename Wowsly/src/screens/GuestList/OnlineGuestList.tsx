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
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { getEventUsers, makeGuestManager, makeGuestUser } from '../../api/event';
import GuestDetailsModal from '../../components/GuestDetailsModal';

type GuestListRoute = RouteProp<
    {
        OnlineGuestList: {
            eventTitle?: string;
            eventId?: string;
        };
    },
    'OnlineGuestList'
>;

const BACK_ICON = require('../../assets/img/common/back.png');
const SEARCH_ICON = {
    uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};
const NOGUESTS_ICON = require('../../assets/img/common/noguests.png');

type TabType = 'registered' | 'invited';

const statusChipStyles: Record<
    string,
    { backgroundColor: string; color: string }
> = {
    'Checked In': { backgroundColor: '#E3F8EB', color: '#16794C' },
    Pending: { backgroundColor: '#FFF2D4', color: '#A46A00' },
    'No-Show': { backgroundColor: '#FFE2E2', color: '#BE2F2F' },
    'registered': { backgroundColor: '#E3F8EB', color: '#16794C' },
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

    const eventTitle = route.params?.eventTitle ?? 'Selected Event';
    const eventId = route.params?.eventId;

    useEffect(() => {
        if (eventId) {
            fetchGuests();
        }
    }, [eventId, activeTab]);

    const fetchGuests = async () => {
        setLoading(true);

        try {
            const type = activeTab.toLowerCase();
            const res = await getEventUsers(eventId, 1, type);
            const fetchedGuests = res?.data || [];
            setGuests(fetchedGuests);
        } catch (error) {
            console.error('Error fetching guests:', error);
            setGuests([]);
        }

        setLoading(false);
    };

    const filteredGuests = useMemo(() => {
        return guests.filter((guest) => {
            const name = guest.name || guest.first_name + ' ' + guest.last_name || 'Guest';
            const matchesSearch = name
                .toLowerCase()
                .includes(searchQuery.trim().toLowerCase());
            return matchesSearch;
        });
    }, [guests, searchQuery]);

    const renderGuest = ({ item }: { item: any }) => {
        const name = item.name || item.first_name + ' ' + item.last_name || 'Guest';
        const avatar = item.avatar || item.profile_photo;
        const status = item.status || activeTab;

        const renderRightActions = () => (
            <View style={styles.rowActions}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.actionButton, styles.editButton]}
                >
                    <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
            </View>
        );

        return (
            <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        setSelectedGuestId(item.id?.toString());
                        setModalVisible(true);
                    }}
                >
                    <View style={styles.guestRow}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarPlaceholderText}>
                                    {name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.guestInfo}>
                            <Text style={styles.guestName}>{name}</Text>
                        </View>
                        <View style={[styles.statusChip, statusChipStyles[status] || statusChipStyles[status.toLowerCase()] || statusChipStyles['registered']]}>
                            <Text
                                style={[
                                    styles.statusChipText,
                                    { color: (statusChipStyles[status] || statusChipStyles[status.toLowerCase()] || statusChipStyles['registered']).color },
                                ]}
                            >
                                {status}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.iconButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Image source={BACK_ICON} style={styles.backIcon} />
                    </TouchableOpacity>

                    <Text style={styles.title} numberOfLines={1}>
                        {eventTitle}
                    </Text>

                    <View style={styles.iconPlaceholder}>
                        <Text style={styles.iconPlaceholderText}>⚙︎</Text>
                    </View>
                </View>

                <Text style={styles.pageTitle}>Guest Lists</Text>

                {/* Horizontal Tab Slider */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === 'registered' && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab('registered')}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'registered' && styles.activeTabText,
                            ]}
                        >
                            Registered Guests
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === 'invited' && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab('invited')}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'invited' && styles.activeTabText,
                            ]}
                        >
                            Invited Guests
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Image source={SEARCH_ICON} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name"
                        placeholderTextColor="#A1A1A1"
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
                            keyExtractor={(item, index) => `${item.id}-${index}`}
                            contentContainerStyle={styles.listContent}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            renderItem={renderGuest}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                                    <Text style={styles.emptyTitle}>No guests found</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Try a different name or category.
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </GestureHandlerRootView>

                <GuestDetailsModal
                    visible={modalVisible}
                    onClose={() => {
                        setModalVisible(false);
                        setSelectedGuestId(null);
                    }}
                    eventId={eventId}
                    guestId={selectedGuestId || undefined}
                    guest={guests.find(g => g.id.toString() === selectedGuestId?.toString())}
                    onManualCheckIn={(guestId) => {
                        console.log('Manual check-in for guest:', guestId);
                        // TODO: Implement manual check-in API call
                    }}
                    onMakeManager={async (guestId) => {
                        console.log('Make manager for guest:', guestId);
                        try {
                            const res = await makeGuestManager(eventId, guestId);
                            if (res && (res.status === true || res.success === true || res.data)) {
                                // Update local state
                                setGuests(prevGuests =>
                                    prevGuests.filter(g => g.id.toString() !== guestId.toString())
                                );
                                setModalVisible(false);
                                setSelectedGuestId(null);
                            } else {
                                console.error('Failed to make guest manager', res);
                            }
                        } catch (err) {
                            console.error('Error making guest manager:', err);
                        }
                    }}
                    onMakeGuest={async (guestId) => {
                        console.log('Make guest for guest:', guestId);
                        try {
                            const guest = guests.find(g => g.id.toString() === guestId.toString());
                            let targetType = activeTab;

                            const res = await makeGuestUser(eventId, guestId, targetType);
                            if (res && (res.status === true || res.success === true || res.data)) {
                                setGuests(prevGuests =>
                                    prevGuests.map(g =>
                                        g.id.toString() === guestId.toString()
                                            ? { ...g, type: targetType, role: 'guest' }
                                            : g
                                    )
                                );
                                setModalVisible(false);
                                setSelectedGuestId(null);
                            } else {
                                console.error('Failed to make guest user', res);
                            }
                        } catch (err) {
                            console.error('Error making guest user:', err);
                        }
                    }}
                />
            </View>
        </SafeAreaView>
    );
};

export default OnlineGuestList;

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
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE8DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        width: 14,
        height: 22,
        resizeMode: 'contain',
        tintColor: '#1F1F1F',
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
