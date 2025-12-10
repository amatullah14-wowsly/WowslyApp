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
    RefreshControl,
    DeviceEventEmitter,
    Animated,
    ImageSourcePropType,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { initDB, getTicketsForEvent, updateTicketStatusLocal, getTicketsForEventPage } from '../../db';
import { verifyQrCode } from '../../api/event';
import Toast from 'react-native-toast-message';
import BackButton from '../../components/BackButton';
import GuestDetailsModal from '../../components/GuestDetailsModal';

type OfflineGuestListRoute = RouteProp<
    {
        OfflineGuestList: {
            eventId: number;
            offlineData?: any[];
        };
    },
    'OfflineGuestList'
>;


const SEARCH_ICON = {
    uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};
const NOGUESTS_ICON = require('../../assets/img/common/noguests.png');
const DOTS_ICON = require('../../assets/img/common/dots.png');
const PREV_ICON = require('../../assets/img/common/previous.png');
const NEXT_ICON = require('../../assets/img/common/next.png');

const statusChipStyles: Record<string, { backgroundColor: string; color: string }> = {
    'Checked In': { backgroundColor: '#E3F2FD', color: '#1565C0' },
    Pending: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
    'No-Show': { backgroundColor: '#FFE2E2', color: '#BE2F2F' },
    blocked: { backgroundColor: '#FFEBEE', color: '#C62828' },
};

const OfflineGuestList = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<OfflineGuestListRoute>();
    const { eventId, offlineData: initialData } = route.params;

    const [guests, setGuests] = useState<any[]>(initialData || []);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState<any>(null);

    // Performance Lock
    const isFetching = React.useRef(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const [dropdownVisible, setDropdownVisible] = useState(false);
    const dropdownAnim = React.useRef(new Animated.Value(0)).current;

    // Filter State
    const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Checked In'>('All');
    const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);

    useEffect(() => {
        loadGuests(1);
    }, [eventId, filterStatus]); // Reload when filter changes

    const toggleDropdown = () => {
        if (dropdownVisible) {
            Animated.timing(dropdownAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => setDropdownVisible(false));
        } else {
            setDropdownVisible(true);
            Animated.spring(dropdownAnim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
            }).start();
        }
    };

    const handleExport = () => {
        toggleDropdown();
        Toast.show({
            type: 'info',
            text1: 'Exporting...',
            text2: 'Export feature is coming soon.',
        });
        // Logic to export guest list to CSV can be added here using react-native-fs
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadGuests(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Listen for scan updates to refresh list in real-time
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', (data) => {
            console.log("OfflineGuestList received broadcast:", data);
            loadGuests(currentPage);
        });

        const refreshSub = DeviceEventEmitter.addListener('REFRESH_GUEST_LIST', () => {
            console.log("OfflineGuestList received refresh request");
            loadGuests(currentPage);
        });

        return () => {
            subscription.remove();
            refreshSub.remove();
        };
    }, [currentPage]);

    const loadGuests = async (page = 1) => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            await initDB();

            // Use paginated fetch
            // Use paginated fetch with filter
            const res = await getTicketsForEventPage(eventId, page, 100, searchQuery, filterStatus);

            if (res) {
                setGuests(res.guests || []);
                setLastPage(res.last_page || 1);
                setCurrentPage(page);
            }
        } catch (error) {
            console.error('Error loading offline guests:', error);
            setGuests([]);
        } finally {
            isFetching.current = false;
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadGuests(1);
        setRefreshing(false);
    };

    const handleManualCheckIn = async (guestId: string) => {
        if (!selectedGuest) return;

        // Offline Manual Check-in
        try {
            const qrCode = selectedGuest.qr_code;

            if (!qrCode) {
                Toast.show({
                    type: 'error',
                    text1: 'Invalid QR Verification',
                    text2: 'Guest does not have a valid ticket.'
                });
                return;
            }

            if (qrCode) {
                // 1. Update local DB
                await updateTicketStatusLocal(qrCode, 'checked_in', 1);

                // 2. Call API to verify/sync immediately if possible
                const guestUuid = selectedGuest.guest_uuid || selectedGuest.uuid || selectedGuest.unique_id; // Try multiple fields if needed
                if (guestUuid) {
                    verifyQrCode(eventId, { qrGuestUuid: guestUuid })
                        .then((res) => {
                            if (res && (res.message === "QR code verified" || res.success)) {
                                Toast.show({
                                    type: 'success',
                                    text1: 'Check-in Successful',
                                    text2: `${selectedGuest.guest_name || 'Guest'} checked in successfully`
                                });
                            }
                        })
                        .catch(err => console.log("Manual verification API failed silently:", err));
                }

                // 3. Broadcast update
                const broadcastData = {
                    guest_name: selectedGuest.guest_name,
                    qr_code: qrCode,
                    total_entries: selectedGuest.total_entries,
                    used_entries: (selectedGuest.used_entries || 0) + 1,
                    facilities: selectedGuest.facilities,
                    guest_id: selectedGuest.guest_id
                };
                DeviceEventEmitter.emit('BROADCAST_SCAN_TO_CLIENTS', broadcastData);

                // Refresh list
                loadGuests();
                // Update selectedGuest locally so Modal reflects changes immediately
                setSelectedGuest((prev: any) => ({
                    ...prev,
                    status: 'checked_in',
                    used_entries: (prev.used_entries || 0) + 1
                }));
                // Do not close modal so user sees "Checked In" status
                // setModalVisible(false);
            }
        } catch (error) {
            console.error("Manual check-in failed:", error);
            Toast.show({
                type: 'error',
                text1: 'Check-in Failed',
                text2: 'Could not check in guest locally'
            });
        }
    };

    // Extracted logic to Memoized Component (defined below)
    const renderGuestItem = React.useCallback(({ item }: { item: any }) => {
        return (
            <MemoizedGuestRow
                item={item}
                onPress={() => {
                    setSelectedGuest(item);
                    setModalVisible(true);
                }}
            />
        );
    }, []);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <BackButton onPress={() => navigation.goBack()} />

                    <Text style={styles.title} numberOfLines={1}>
                        Offline Guest List
                    </Text>

                    {/* Right Side Menu */}
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={toggleDropdown} style={styles.menuButton}>
                            <Image source={DOTS_ICON} style={styles.menuIconImage} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Dropdown Menu */}
                {dropdownVisible && (
                    <>
                        <TouchableWithoutFeedback onPress={toggleDropdown}>
                            <View style={styles.menuOverlay} />
                        </TouchableWithoutFeedback>
                        <Animated.View
                            style={[
                                styles.dropdownMenu,
                                {
                                    opacity: dropdownAnim,
                                    transform: [
                                        { scale: dropdownAnim },
                                        { translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }
                                    ]
                                }
                            ]}
                        >
                            <TouchableOpacity style={styles.menuItem} onPress={handleExport}>
                                <Text style={styles.menuItemText}>Export List</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </>
                )}

                {/* Search & Filter Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                    {/* Search Bar */}
                    <View style={[styles.searchContainer, { flex: 1, marginBottom: 0 }]}>
                        <Image source={SEARCH_ICON} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search guests..."
                            placeholderTextColor="#999"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* Filter Button */}
                    <TouchableOpacity
                        style={[
                            styles.filterButton,
                            filterStatus !== 'All' && styles.filterButtonActive
                        ]}
                        onPress={() => setFilterDropdownVisible(!filterDropdownVisible)}
                    >
                        <Image
                            source={{ uri: 'https://img.icons8.com/ios-glyphs/30/000000/filter.png' }}
                            style={[
                                styles.filterIcon,
                                filterStatus !== 'All' && { tintColor: '#FFFFFF' }
                            ]}
                        />
                    </TouchableOpacity>
                </View>

                {/* Filter Dropdown */}
                {filterDropdownVisible && (
                    <>
                        <TouchableWithoutFeedback onPress={() => setFilterDropdownVisible(false)}>
                            <View style={styles.menuOverlay} />
                        </TouchableWithoutFeedback>
                        <View style={styles.filterDropdown}>
                            {['All', 'Pending', 'Checked In'].map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={styles.filterItem}
                                    onPress={() => {
                                        setFilterStatus(status as any);
                                        setFilterDropdownVisible(false);
                                        // Trigger load immediately
                                        // loadGuests(1, status); // Will be handled by useEffect or direct call
                                    }}
                                >
                                    <Text style={[
                                        styles.filterItemText,
                                        filterStatus === status && styles.filterItemTextActive
                                    ]}>
                                        {status}
                                    </Text>
                                    {filterStatus === status && (
                                        <View style={styles.activeDot} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* List */}
                <FlatList
                    data={guests}
                    keyExtractor={(item, index) => (item.qr_code || index).toString()}
                    renderItem={renderGuestItem}
                    contentContainerStyle={styles.listContent}
                    getItemLayout={(data, index) => ({
                        length: 80, // Approx height + marginBottom(12)
                        offset: 80 * index,
                        index,
                    })}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8A3C" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                            <Text style={styles.emptyText}>No guests found</Text>
                        </View>
                    }
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    ListFooterComponent={
                        guests.length > 0 && lastPage > 1 ? (
                            <View style={styles.paginationContainer}>
                                <TouchableOpacity
                                    disabled={currentPage === 1 || refreshing}
                                    onPress={() => loadGuests(currentPage - 1)} // loadGuests takes page num
                                >
                                    <Image
                                        source={PREV_ICON}
                                        style={[styles.pageIcon, currentPage === 1 && styles.disabledIcon]}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>

                                <Text style={styles.pageInfo}>{currentPage} / {lastPage || 1}</Text>

                                <TouchableOpacity
                                    disabled={currentPage >= lastPage || refreshing}
                                    onPress={() => loadGuests(currentPage + 1)}
                                >
                                    <Image
                                        source={NEXT_ICON}
                                        style={[styles.pageIcon, currentPage >= lastPage && styles.disabledIcon]}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                />

                <GuestDetailsModal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    eventId={eventId?.toString()}
                    guestId={selectedGuest?.guest_id?.toString()}
                    guest={{
                        ...selectedGuest,
                        name: selectedGuest?.guest_name,
                        ticket_data: {
                            ticket_title: selectedGuest?.ticket_title,
                            tickets_bought: selectedGuest?.total_entries
                        }
                    }}

                    offline={true}
                />
            </View>
        </SafeAreaView>
    );
};

// ⚡⚡⚡ MEMOIZED GUEST ROW COMPONENT ⚡⚡⚡
const MemoizedGuestRow = React.memo(({ item, onPress }: { item: any, onPress: () => void }) => {
    const name = item.guest_name || item.name || item.first_name + ' ' + item.last_name || 'Guest';
    const avatar = item.avatar || item.profile_photo;

    return (
        <TouchableOpacity
            style={styles.guestRow}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {avatar ? (
                <FastImage
                    source={{ uri: avatar, priority: FastImage.priority.normal }}
                    style={styles.avatar}
                    resizeMode={FastImage.resizeMode.cover}
                />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>
                        {name.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
            <View style={styles.guestInfo}>
                <Text style={styles.guestName}>{name}</Text>
                <Text style={styles.guestDetails}>Ticket ID: {item.qr_code || item.ticket_id || item.guest_uuid || 'N/A'}</Text>
            </View>
            {/* Status UI Hidden */}
        </TouchableOpacity>
    );
});

export default OfflineGuestList;

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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F6F6F6',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        marginBottom: 16,
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
        marginBottom: 12,
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
    guestDetails: {
        fontSize: 12,
        color: '#7A7A7A',
        marginTop: 2,
    },
    statusChip: {
        backgroundColor: '#E3F8EB',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#16794C',
    },
    entryCountText: {
        fontSize: 10,
        color: '#16794C',
        marginTop: 2,
        textAlign: 'center',
    },
    emptyContainer: {
        marginTop: 80,
        alignItems: 'center',
        gap: 12,
    },
    emptyIcon: {
        width: 120,
        height: 120,
        resizeMode: 'contain',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111111',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Pagination Styles
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingTop: 16,
        backgroundColor: '#FFFFFF',
    },
    pageButton: {
        backgroundColor: '#FF8A3C',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 12,
    },
    disabledPageButton: {
        backgroundColor: '#FFD2B3',
    },
    pageIcon: {
        width: 28,
        height: 28,
        tintColor: '#FF8A3C',
    },
    disabledIcon: {
        tintColor: '#E0E0E0',
    },
    pageInfo: {
        fontWeight: '600',
        color: '#333',
    },
    headerRight: {
        width: 40,
        alignItems: 'flex-end',
    },
    menuButton: {
        padding: 8,
    },
    menuIconImage: {
        width: 24,
        height: 24,
        tintColor: '#1F1F1F',
        resizeMode: 'contain',
    },
    menuOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99,
        // backgroundColor: 'rgba(0,0,0,0.1)', // Optional dimming
    },
    dropdownMenu: {
        position: 'absolute',
        top: 70, // Adjust based on header height
        right: 20,
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        zIndex: 100,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#333',
    },
    // Filter Styles
    filterButton: {
        height: 48,
        width: 48,
        backgroundColor: '#F6F6F6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
        marginBottom: 16,
    },
    filterButtonActive: {
        backgroundColor: '#FF8A3C',
    },
    filterIcon: {
        width: 20,
        height: 20,
        tintColor: '#9B9B9B',
        resizeMode: 'contain',
    },
    filterDropdown: {
        position: 'absolute',
        top: 140, // Below search bar
        right: 20,
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 8,
        minWidth: 160,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        zIndex: 100,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    filterItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    filterItemText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    filterItemTextActive: {
        color: '#FF8A3C',
        fontWeight: '700',
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF8A3C',
    },
});
