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
    useWindowDimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { getEventUsers, makeGuestManager, makeGuestUser, verifyQrCode, getEventUsersPage } from '../../api/event';
import Toast from 'react-native-toast-message';
import GuestDetailsModal from '../../components/GuestDetailsModal';
import BackButton from '../../components/BackButton';
import { getLocalCheckedInGuests } from '../../db';
import { scanStore, getMergedGuest } from '../../context/ScanStore';
import { useRef } from 'react'; // Added useRef
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import Pagination from '../../components/Pagination';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

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
const PREV_ICON = require('../../assets/img/common/previous.png');
const NEXT_ICON = require('../../assets/img/common/next.png');

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

    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

    const [activeTab, setActiveTab] = useState<TabType>('registered');
    const [searchQuery, setSearchQuery] = useState('');
    const [guests, setGuests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState(0);

    // Performance & Locking refs
    const isFetching = useRef(false);
    const localCheckinsCache = useRef<any[] | null>(null);
    const refreshTimeout = useRef<NodeJS.Timeout | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [totalGuests, setTotalGuests] = useState(0);

    const eventTitle = route.params?.eventTitle ?? 'Selected Event';
    const eventId = route.params?.eventId;

    /* ---------------------- Real-time update listener ---------------------- */
    /* ---------------------- Real-time update listener ---------------------- */
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', () => {
            // Throttled refresh
            if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
            refreshTimeout.current = setTimeout(() => {
                fetchGuests(currentPage);
            }, 300);
        });

        const refreshSub = DeviceEventEmitter.addListener('REFRESH_GUEST_LIST', () => {
            fetchGuests(currentPage);
        });

        const manualCheckInSub = DeviceEventEmitter.addListener('GUEST_CHECKED_IN_MANUALLY', ({ guestId, count }: { guestId: number, count: number }) => {
            // Optimistic update
            setGuests(prevGuests => prevGuests.map(g => {
                if (g.id === guestId || g.guest_id === guestId) {
                    const newUsed = (g.used_entries || 0) + (count || 1);
                    return {
                        ...g,
                        check_in_status: 1,
                        status: 'Checked In',
                        used_entries: newUsed
                    };
                }
                return g;
            }));
            // Still trigger fetch to ensure consistency
            fetchGuests(currentPage);
        });

        return () => {
            refreshSub.remove();
            manualCheckInSub.remove();
        };
    }, [currentPage]);

    /* ---------------------- Fetch on load & tab/search change ---------------------- */
    useEffect(() => {
        if (eventId) {
            localCheckinsCache.current = null; // Invalidate cache on event switch
            // Reset to page 1 when tab changes
            fetchGuests(1);
        }
    }, [eventId, activeTab]);

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (eventId) fetchGuests(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);


    /* ---------------------- Fetch guest list ---------------------- */
    const fetchGuests = async (page = 1) => {
        if (isFetching.current) return;
        isFetching.current = true;
        setLoading(true);

        try {
            // Use getEventUsersPage for server-side pagination & search
            const res = await getEventUsersPage(eventId, page, activeTab, searchQuery);

            let fetchedGuests = res?.guests_list || res?.data || [];
            const meta = res?.meta || res?.pagination;

            if (res && res.guests_list) {
                fetchedGuests = res.guests_list;
            } else if (res && res.data && Array.isArray(res.data)) {
                fetchedGuests = res.data;
            } else if (Array.isArray(res)) {
                fetchedGuests = res;
            }

            // Update Pagination Info
            if (meta) {
                setLastPage(meta.last_page || 1);
                setTotalGuests(meta.total || 0);
                setCurrentPage(meta.current_page || page);
            } else {
                // Fallback if no meta (shouldn't happen with new API)
                setLastPage(1);
                setCurrentPage(page);
            }


            // 🔥 Normalize ID & Apply Role Filter
            // Filter OUT managers if accessing registered/invited tabs
            // This is client-side filtering on the PAGE, which is imperfect but safer than showing them mixed.
            // Ideally backend handles this.
            fetchedGuests = fetchedGuests.map((g: any) => ({
                ...g,
                id: g.id || g.guest_id || g.event_user_id,
            }));

            fetchedGuests = fetchedGuests.filter((g: any) => g.role !== 'manager');

            // Merge local DB check-ins for status updates
            try {
                // Cache local check-ins logic
                if (!localCheckinsCache.current) {
                    localCheckinsCache.current = await getLocalCheckedInGuests(Number(eventId));
                }
                const localCheckins = localCheckinsCache.current || [];

                fetchedGuests = fetchedGuests.map((apiGuest: any) => {
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

            setGuests(fetchedGuests);
        } catch (err) {
            console.error("Fetch error:", err);
            setGuests([]);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    };

    /* ---------------------- Data Processing ---------------------- */
    // User requested to REMOVE client-side filtering and use guests directly.
    const displayedGuests = guests;

    /* ---------------------- Render each guest ---------------------- */
    // Extracted to Memoized Component (defined below)
    const renderGuestItem = React.useCallback(({ item, index }: { item: any, index: number }) => {
        // Optimization: Disable swipeable for items far down the list if performance is key
        // User suggestion: "Disable Swipeable OR lazy-render it"
        const isSwipeEnabled = index < 50;

        return (
            <MemoizedGuestRow
                item={item}
                swipeEnabled={isSwipeEnabled}
                onPress={() => {
                    const id = (item.id || item.guest_id || item.event_user_id)?.toString();
                    console.log("Selected Guest ID:", id);
                    setSelectedGuestId(id);
                    setModalVisible(true);
                }}
                styles={styles}
            />
        );
    }, [styles]);

    /* ---------------------- UI ---------------------- */
    return (
        <SafeAreaView style={styles.safeArea}>
            <ResponsiveContainer maxWidth={isTablet ? 900 : 420}>
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
                                Registered
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'invited' && styles.activeTab]}
                            onPress={() => setActiveTab('invited')}
                        >
                            <Text style={[styles.tabText, activeTab === 'invited' && styles.activeTabText]}>
                                Invited
                            </Text>
                        </TouchableOpacity>


                    </View>

                    {/* Search - Standardized */}
                    <View style={styles.searchWrapper}>
                        <View style={styles.searchField}>
                            <Image source={SEARCH_ICON} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name"
                                placeholderTextColor="#9E9E9E"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Guest List */}
                    <GestureHandlerRootView style={styles.listWrapper}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#FF8A3C" />
                            </View>
                        ) : (
                            <FlatList
                                data={displayedGuests}
                                keyExtractor={(item, index) =>
                                    `${item.id || item.event_user_id}-${index}`
                                }
                                contentContainerStyle={styles.listContent}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                                renderItem={renderGuestItem}
                                getItemLayout={(data, index) => ({
                                    length: verticalScale(80), // Approx height + separator
                                    offset: verticalScale(80) * index,
                                    index,
                                })}
                                initialNumToRender={10}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                                removeClippedSubviews={true}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                                        <Text style={styles.emptyTitle}>No guests found</Text>
                                        <Text style={styles.emptySubtitle}>Try a different name</Text>
                                    </View>
                                }
                                ListFooterComponent={
                                    !loading && displayedGuests.length > 0 ? (
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={lastPage}
                                            onPageChange={fetchGuests}
                                        />
                                    ) : null
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
            </ResponsiveContainer>
        </SafeAreaView>
    );
};

export default OnlineGuestList;

// ⚡⚡⚡ MEMOIZED GUEST ROW COMPONENT ⚡⚡⚡
const MemoizedGuestRow = React.memo(({ item, onPress, swipeEnabled, styles }: { item: any, onPress: () => void, swipeEnabled?: boolean, styles: any }) => {
    const name = item.name || `${item.first_name} ${item.last_name}`;
    const avatar = item.avatar || item.profile_photo;

    // Content of the row
    const RowContent = (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.guestRow}>
                {avatar ? (
                    <FastImage
                        source={{ uri: avatar, priority: FastImage.priority.normal }}
                        style={styles.avatar}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarPlaceholderText}>{name.charAt(0)}</Text>
                    </View>
                )}

                <View style={styles.guestInfo}>
                    <Text style={styles.guestName}>{name}</Text>
                </View>
                {/* Status Chip Hidden */}
            </View>
        </TouchableOpacity>
    );

    if (swipeEnabled === false) {
        return RowContent;
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
            {RowContent}
        </Swipeable>
    );
});

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'white',
    },
    container: {
        flex: 1,
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(30),
        paddingBottom: verticalScale(32),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: verticalScale(24),
    },

    title: {
        flex: 1,
        marginHorizontal: scale(16),
        fontSize: moderateScale(FontSize.xl),
        fontWeight: '700',
        color: '#1F1F1F',
        textAlign: 'center',
    },
    iconPlaceholder: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE8DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconPlaceholderText: {
        fontSize: moderateScale(FontSize.lg), // 18 -> lg
        color: '#3B3B3B',
    },
    pageTitle: {
        fontSize: moderateScale(FontSize.xxl), // 22 -> xxl (24) roughly or xl (20). 22 is between. Let's use xxl (24) for title impact or xl (20). Let's go with xxl for 22/24. Or create a custom size if needed but we should stick to constants. I'll use xl (20) if 24 is too big, or xxl (24). 20->22 is small diff. 22->24 is small diff. I'll use xxl.
        fontWeight: '700',
        color: '#1F1F1F',
        marginBottom: verticalScale(20),
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(12),
        padding: scale(4),
        marginBottom: verticalScale(16),
        borderWidth: 1,
        borderColor: '#EEEEEE',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: scale(4),
        shadowOffset: { width: 0, height: verticalScale(2) },
    },
    tab: {
        flex: 1,
        paddingVertical: verticalScale(10),
        borderRadius: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTab: {
        backgroundColor: '#FF8A3C',
    },
    tabText: {
        fontSize: moderateScale(FontSize.sm), // 14 -> sm (Matches EventListing)
        fontWeight: '600',
        color: '#FF8A3C',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    // Search Styles - Standardized from EventListing.tsx
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: moderateScale(20),
        paddingHorizontal: moderateScale(20),
        height: verticalScale(55),
        marginBottom: verticalScale(16),
        shadowColor: '#999',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: moderateScale(6),
        elevation: 3,
        gap: moderateScale(12),
    },
    searchField: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    searchIcon: {
        width: moderateScale(18),
        height: moderateScale(18),
    },
    searchInput: {
        flex: 1,
        fontSize: moderateScale(FontSize.md),
        color: '#111111',
        paddingLeft: moderateScale(8),
    },
    listWrapper: {
        flex: 1,
    },
    listContent: {
        paddingBottom: verticalScale(24),
    },
    separator: {
        height: verticalScale(12),
    },
    guestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(18),
        padding: scale(16),
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: scale(4),
        shadowOffset: { width: 0, height: verticalScale(1) },
        elevation: 1,
    },
    avatar: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(24),
        marginRight: scale(16),
    },
    avatarPlaceholder: {
        backgroundColor: '#FF8A3C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderText: {
        fontSize: moderateScale(FontSize.lg), // 18 -> lg
        fontWeight: '600',
        color: '#FFFFFF',
    },
    guestInfo: {
        flex: 1,
    },
    guestName: {
        fontSize: moderateScale(FontSize.md), // 16 -> md
        fontWeight: '700',
        color: '#111111',
    },
    statusChip: {
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(6),
        borderRadius: scale(8),
    },
    statusChipText: {
        fontSize: moderateScale(FontSize.xs), // 12 -> xs
        fontWeight: '600',
    },
    rowActions: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
    },
    actionButton: {
        width: scale(70),
        justifyContent: 'center',
        alignItems: 'center',
        height: verticalScale(50),
    },
    editButton: {
        backgroundColor: '#FF8A3C',
    },
    actionText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    emptyState: {
        marginTop: verticalScale(80),
        alignItems: 'center',
        gap: scale(12),
    },
    emptyIcon: {
        width: scale(120),
        height: scale(120),
        resizeMode: 'contain',
    },
    emptyTitle: {
        fontSize: moderateScale(FontSize.md), // 16 -> md
        fontWeight: '600',
        color: '#111111',
    },
    emptySubtitle: {
        fontSize: moderateScale(FontSize.sm), // 14 -> sm
        color: '#7A7A7A',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paginationWrapper: {
        position: 'absolute',
        bottom: verticalScale(20),
        left: 0,
        right: 0,
        zIndex: 10,
        alignItems: 'center',
    },
});
