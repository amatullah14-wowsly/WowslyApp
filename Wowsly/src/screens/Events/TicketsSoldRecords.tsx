import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    Image,
    LayoutAnimation,
    Platform,
    UIManager,
    Pressable,
    ScrollView,
    Dimensions,
    useWindowDimensions,
    TextInput,
    RefreshControl
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import { getTicketSoldUsers, getTicketList } from '../../api/event';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SoldUser = {
    name: string;
    mobile: string;
    tickets_bought: number;
    invited_by: string | null;
    registered_by: string | null;
    created_at: string;
    dialing_code?: string | number;
};

type TicketType = {
    id: string | number;
    title: string;
    type?: string;
    sold_out: number | string;
};

import SystemNavigationBar from 'react-native-system-navigation-bar';

type FlatListItem =
    | { type: 'HEADER'; data: TicketType }
    | { type: 'USER_ROW'; data: SoldUser[] }
    | { type: 'LOADING'; id: string | number }
    | { type: 'EMPTY'; id: string | number }
    | { type: 'FOOTER'; id: string | number };

const SEARCH_ICON = {
    uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};

const TicketsSoldRecords = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, tickets } = route.params || {};

    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);
    const insets = useSafeAreaInsets();

    const [expandedTicketId, setExpandedTicketId] = useState<string | number | null>(null);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [soldDataCache, setSoldDataCache] = useState<Record<string, SoldUser[]>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SoldUser | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [localTickets, setLocalTickets] = useState<TicketType[]>(tickets || []);

    useEffect(() => {
        SystemNavigationBar.stickyImmersive();

        return () => {
            SystemNavigationBar.navigationShow();
        };
    }, []);

    const toggleExpand = async (ticket: TicketType) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        if (expandedTicketId === ticket.id) {
            setExpandedTicketId(null);
            return;
        }

        setExpandedTicketId(ticket.id);

        if (!soldDataCache[ticket.id]) {
            fetchSoldUsers(ticket);
        }
    };

    const fetchSoldUsers = async (ticket: TicketType) => {
        setLoadingUsers(true);
        try {
            const eventType = (ticket.type || 'paid').toLowerCase();
            const res = await getTicketSoldUsers(eventId, ticket.id, eventType);

            let users: SoldUser[] = [];
            if (res?.data && Array.isArray(res.data)) {
                users = res.data;
            } else if (Array.isArray(res)) {
                users = res;
            }

            setSoldDataCache(prev => ({ ...prev, [ticket.id]: users }));
        } catch (error) {
            console.error("Failed to fetch sold users", error);
        } finally {
            setLoadingUsers(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            // 1. Refresh the ticket list itself (in case sold counts changed or new ticket types added)
            const res = await getTicketList(eventId);
            if (res?.data) {
                setLocalTickets(res.data);
            } else if (Array.isArray(res)) {
                setLocalTickets(res);
            }

            // 2. If a ticket is currently expanded, refresh its users too
            if (expandedTicketId) {
                const expandedTicket = (res?.data || res || []).find((t: any) => String(t.id) === String(expandedTicketId));
                if (expandedTicket) {
                    await fetchSoldUsers(expandedTicket);
                } else {
                    // Expanded ticket no longer exists?
                    setExpandedTicketId(null);
                }
            }
        } catch (error) {
            console.error("Refresh failed", error);
        } finally {
            setRefreshing(false);
        }
    };

    const formatTime = (timeString: string) => {
        if (!timeString) return '';

        let dateToParse = timeString;
        if (dateToParse.indexOf('T') === -1) {
            dateToParse = dateToParse.replace(' ', 'T');
        }

        if (!dateToParse.endsWith('Z') && !dateToParse.includes('+')) {
            dateToParse += 'Z';
        }

        const date = new Date(dateToParse);

        if (isNaN(date.getTime())) return timeString;

        return date.toLocaleString('en-US', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
    };

    const handleViewDetails = (user: SoldUser) => {
        setSelectedUser(user);
        setModalVisible(true);

        // Show navigation bar while modal is open
        SystemNavigationBar.navigationShow();
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedUser(null);

        // Restore immersive after modal closes
        setTimeout(() => {
            SystemNavigationBar.stickyImmersive();
        }, 300);
    };

    // Flatten logic
    const flatListData = useMemo(() => {
        if (!localTickets) return [];
        const data: FlatListItem[] = [];

        localTickets.forEach((ticket: TicketType) => {
            // 1. Add Header
            data.push({ type: 'HEADER', data: ticket });

            // 2. If Expanded, Add Content
            if (expandedTicketId === ticket.id) {
                let users = soldDataCache[ticket.id];

                // Filter users based on search
                if (users && searchQuery.trim().length > 0) {
                    const lower = searchQuery.toLowerCase();
                    users = users.filter(u =>
                        (u.name && u.name.toLowerCase().includes(lower)) ||
                        (u.mobile && String(u.mobile).includes(lower)) ||
                        (u.tickets_bought && String(u.tickets_bought).includes(lower))
                    );
                }

                if (loadingUsers && !soldDataCache[ticket.id]) { // Check original cache for loading
                    data.push({ type: 'LOADING', id: ticket.id });
                } else if (users && users.length > 0) {
                    // Chunk users into pairs for grid
                    for (let i = 0; i < users.length; i += 2) {
                        data.push({
                            type: 'USER_ROW',
                            data: users.slice(i, i + 2)
                        });
                    }
                } else if (!loadingUsers) {
                    data.push({ type: 'EMPTY', id: ticket.id });
                }

                // 3. Add Footer to close the card visual
                data.push({ type: 'FOOTER', id: ticket.id });
            }
        });

        return data;
    }, [localTickets, expandedTicketId, soldDataCache, loadingUsers, searchQuery]);

    const UserCard = React.useCallback(({ item }: { item: SoldUser }) => (
        <View style={styles.gridCard}>
            <View style={styles.cardHeaderCenter}>
                <Text style={styles.gridGuestName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.ticketBadge}>
                    <Text style={styles.gridTicketCount}>
                        {item.tickets_bought} × Ticket{item.tickets_bought !== 1 ? 's' : ''}
                    </Text>
                </View>
                <Text style={styles.gridCheckInTime}>
                    {formatTime(item.created_at)}
                </Text>
            </View>

            <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => handleViewDetails(item)}
            >
                <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
        </View>
    ), [handleViewDetails, styles]);

    const renderItem = ({ item }: { item: FlatListItem }) => {
        switch (item.type) {
            case 'HEADER': {
                const ticket = item.data;
                const expanded = expandedTicketId === ticket.id;
                const soldCount = Number(ticket.sold_out || 0);

                return (
                    <View style={[
                        styles.ticketCardHeader,
                        expanded ? styles.ticketCardHeaderExpanded : styles.ticketCardHeaderCollapsed
                    ]}>
                        <TouchableOpacity
                            style={styles.cardHeaderContent}
                            onPress={() => toggleExpand(ticket)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconContainer}>
                                <Image source={require('../../assets/img/eventdashboard/ticket.png')} style={styles.ticketIcon} resizeMode="contain" />
                            </View>
                            <View style={styles.headerInfo}>
                                <Text style={styles.ticketTitle}>{ticket.title}</Text>
                                <Text style={styles.soldText}>{soldCount} Sold</Text>
                            </View>
                            <View style={styles.arrowContainer}>
                                <Image
                                    source={require('../../assets/img/common/next.png')}
                                    style={[
                                        styles.arrowIcon,
                                        { transform: [{ rotate: expanded ? '90deg' : '0deg' }] }
                                    ]}
                                    resizeMode="contain"
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            }
            case 'USER_ROW': {
                return (
                    <View style={styles.rowWrapper}>
                        <View style={styles.usersGridContainer}>
                            {item.data.map((user, index) => (
                                <UserCard key={index} item={user} />
                            ))}
                            {/* If only 1 item in row, empty view to maintain alignment if using flex-between */}
                            {item.data.length === 1 && <View style={{ width: '48%' }} />}
                        </View>
                    </View>
                );
            }
            case 'LOADING': {
                return (
                    <View style={styles.loadingWrapper}>
                        <ActivityIndicator size="small" color="#FF8A3C" />
                    </View>
                );
            }
            case 'EMPTY': {
                return (
                    <View style={styles.emptyWrapper}>
                        <Text style={styles.noDataText}>No sold tickets found.</Text>
                    </View>
                );
            }
            case 'FOOTER': {
                return <View style={styles.cardFooter} />;
            }
            default:
                return null;
        }
    };

    return (
        <ResponsiveContainer maxWidth={isTablet ? 900 : 420}>
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <View style={[styles.header, { paddingTop: insets.top }]}>
                    <BackButton onPress={() => navigation.goBack()} />
                    <Text style={styles.title}>Tickets Sold Records</Text>
                    <View style={{ width: scale(32) }} />
                </View>

                {/* Search Bar */}
                {/* Search Bar - Standardized from EventListing */}
                <View style={styles.searchWrapper}>
                    <View style={styles.searchField}>
                        <Image source={SEARCH_ICON} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search guests..."
                            placeholderTextColor="#999"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                <FlatList
                    data={flatListData}
                    keyExtractor={(item, index) => {
                        if (item.type === 'HEADER') return `header_${item.data.id}`;
                        if (item.type === 'USER_ROW') return `row_${index}`;
                        return `${item.type}_${index}`;
                    }}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#FF8A3C"
                            colors={['#FF8A3C']}
                        />
                    }
                />

                {/* Details Overlay (Custom Modal) */}
                {modalVisible && (
                    <View style={styles.modalOverlay}>
                        <Pressable style={{ flex: 1 }} onPress={closeModal} />

                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Sold Ticket Details</Text>
                                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                                    <Text style={styles.closeButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            {selectedUser && (
                                <ScrollView contentContainerStyle={styles.modalBody}>
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Name</Text>
                                        <Text style={styles.modalValueMain}>{selectedUser.name}</Text>
                                    </View>
                                    <View style={styles.separator} />

                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Mobile</Text>
                                        <Text style={styles.modalValue}>
                                            +{selectedUser.dialing_code || 91} {selectedUser.mobile}
                                        </Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Registered By</Text>
                                        <Text style={styles.modalValue}>{selectedUser.registered_by || 'Self'}</Text>
                                    </View>
                                    {selectedUser.invited_by && (
                                        <View style={styles.modalRow}>
                                            <Text style={styles.modalLabel}>Invited By</Text>
                                            <Text style={styles.modalValue}>{selectedUser.invited_by}</Text>
                                        </View>
                                    )}
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Purchased</Text>
                                        <Text style={styles.modalValue}>{selectedUser.tickets_bought} × Ticket(s)</Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Time</Text>
                                        <Text style={styles.modalValue}>
                                            {formatTime(selectedUser.created_at)}
                                        </Text>
                                    </View>
                                </ScrollView>
                            )}

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                                    <Text style={styles.modalCloseBtnText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </ResponsiveContainer>
    );
};

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        width: '100%',
        paddingVertical: verticalScale(15),
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: moderateScale(20),
        backgroundColor: 'white',
        elevation: 2,
    },
    title: {
        fontSize: moderateScale(18),
        fontWeight: '600',
        color: 'black',
    },
    listContent: {
        padding: moderateScale(16),
        paddingBottom: verticalScale(50),
    },

    // Header Styles
    ticketCardHeader: {
        backgroundColor: 'white',
        borderTopLeftRadius: moderateScale(12),
        borderTopRightRadius: moderateScale(12),
        // Base elevation handled conditionally
    },
    ticketCardHeaderCollapsed: {
        borderRadius: moderateScale(12),
        marginBottom: verticalScale(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
        shadowOffset: { width: 0, height: verticalScale(2) },
    },
    ticketCardHeaderExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        elevation: 0,
    },
    cardHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: moderateScale(16),
    },

    // Content Styles
    rowWrapper: {
        backgroundColor: '#FAFAFA',
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(6),
    },
    loadingWrapper: {
        backgroundColor: '#FAFAFA',
        padding: moderateScale(20),
        alignItems: 'center',
    },
    emptyWrapper: {
        backgroundColor: '#FAFAFA',
        padding: moderateScale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardFooter: {
        backgroundColor: '#FAFAFA',
        height: verticalScale(12),
        borderBottomLeftRadius: moderateScale(12),
        borderBottomRightRadius: moderateScale(12),
        marginBottom: verticalScale(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
        shadowOffset: { width: 0, height: verticalScale(2) },
        marginTop: -1,
        borderTopWidth: 0,
    },

    // Old Styles reused
    iconContainer: {
        width: moderateScale(44),
        height: moderateScale(44),
        borderRadius: moderateScale(22),
        backgroundColor: '#FFF0E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: moderateScale(14),
    },
    ticketIcon: {
        width: moderateScale(22),
        height: moderateScale(22),
        tintColor: '#FF8A3C',
    },
    headerInfo: {
        flex: 1,
    },
    ticketTitle: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#111',
    },
    soldText: {
        fontSize: moderateScale(14),
        color: '#666',
        marginTop: verticalScale(2),
    },
    arrowContainer: {
        padding: moderateScale(4),
    },
    arrowIcon: {
        width: moderateScale(16),
        height: moderateScale(16),
        tintColor: '#999',
    },
    usersGridContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: moderateScale(12),
    },
    noDataText: {
        color: '#999',
        fontStyle: 'italic',
        fontSize: moderateScale(14),
    },

    // Compact Card Styles
    gridCard: {
        backgroundColor: 'white',
        borderRadius: moderateScale(12),
        padding: moderateScale(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(1) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(3),
        width: '48%',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: verticalScale(140),
        borderWidth: 1,
        borderColor: '#EAEAEA',
        marginBottom: verticalScale(4)
    },
    cardHeaderCenter: {
        alignItems: 'center',
        width: '100%',
        flex: 1,
        justifyContent: 'center',
    },
    gridGuestName: {
        fontSize: moderateScale(FontSize.sm),
        fontWeight: '700',
        color: '#222',
        textAlign: 'center',
        marginBottom: verticalScale(8),
        lineHeight: moderateScale(22),
    },
    ticketBadge: {
        backgroundColor: '#FFF0E0',
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(6),
        borderWidth: 1,
        borderColor: '#FFD2B3',
    },
    gridTicketCount: {
        fontSize: moderateScale(FontSize.xs),
        color: '#E65100',
        fontWeight: '700',
    },
    gridCheckInTime: {
        fontSize: moderateScale(FontSize.xs),
        color: '#999',
        marginTop: verticalScale(2),
    },
    viewDetailsButton: {
        marginTop: verticalScale(10),
        width: '100%',
        paddingVertical: verticalScale(6),
        backgroundColor: '#fff',
        borderRadius: moderateScale(6),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    viewDetailsText: {
        fontSize: moderateScale(FontSize.xs),
        fontWeight: '600',
        color: '#555',
    },

    // Modal Styles
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    modalContainer: {
        width: '100%',
        maxHeight: '50%',
        backgroundColor: 'white',
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(-2) },
        shadowOpacity: 0.2,
        shadowRadius: moderateScale(10),
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: moderateScale(20),
        paddingVertical: verticalScale(10),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
        color: '#222',
    },
    closeButton: {
        padding: moderateScale(5),
    },
    closeButtonText: {
        fontSize: moderateScale(FontSize.lg),
        color: '#999',
    },
    modalBody: {
        padding: moderateScale(20),
        paddingBottom: verticalScale(30),
    },
    modalRow: {
        marginBottom: verticalScale(8),
    },
    modalLabel: {
        fontSize: moderateScale(FontSize.xs),
        color: '#888',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: verticalScale(2),
    },
    modalValueMain: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
        color: '#111',
    },
    modalValue: {
        fontSize: moderateScale(FontSize.sm),
        color: '#333',
        fontWeight: '500',
    },
    separator: {
        height: verticalScale(1),
        backgroundColor: '#F0F0F0',
        marginVertical: verticalScale(8),
    },
    modalFooter: {
        padding: moderateScale(16),
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    modalCloseBtn: {
        backgroundColor: '#FF8A3C',
        borderRadius: moderateScale(12),
        paddingVertical: verticalScale(12),
        alignItems: 'center',
    },
    modalCloseBtnText: {
        color: 'white',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
    },
    // Search Styles
    // Search Styles - Standardized from EventListing.tsx
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        marginHorizontal: moderateScale(16),
        marginTop: verticalScale(20),
        marginBottom: verticalScale(5),
        borderRadius: moderateScale(20), // Matches EventListing default for phone
        paddingHorizontal: moderateScale(20),
        height: verticalScale(55),
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
        // marginRight removed as gap is used in wrapper, or kept if structure differs slightly
    },
    searchInput: {
        flex: 1,
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        paddingLeft: moderateScale(8),
    },
});

export default TicketsSoldRecords;
