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
    useWindowDimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { initDB, getTicketsForEvent, updateTicketStatusLocal, getTicketsForEventPage, performGateCheckIn } from '../../db';
import { verifyQrCode } from '../../api/event';
import Toast from 'react-native-toast-message';
import BackButton from '../../components/BackButton';
import GuestDetailsModal from '../../components/GuestDetailsModal';
import RNFS from 'react-native-fs';
import { getLocalCheckedInGuests } from '../../db';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

import Pagination from '../../components/Pagination';

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

    const { width } = useWindowDimensions();
    const isTablet = width >= 720;
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

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

    // Filter State - REMOVED


    useEffect(() => {
        loadGuests(1);
    }, [eventId]); // Reload when eventId changes

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

    const handleExport = async () => {
        toggleDropdown();

        try {
            Toast.show({
                type: 'info',
                text1: 'Exporting...',
                text2: 'Generating CSV file...',
            });

            const checkedInGuests = await getLocalCheckedInGuests(eventId);

            if (!checkedInGuests || checkedInGuests.length === 0) {
                Toast.show({
                    type: 'error',
                    text1: 'Export Failed',
                    text2: 'No checked-in guests found to export.',
                });
                return;
            }

            // CSV Header
            let csvString = 'UUID,Guest Name,Phone Number,Ticket ID,Status,Tickets Bought,Check In Count,Last Scanned Time\n';

            // CSV Rows
            checkedInGuests.forEach(guest => {
                const uuid = guest.qrGuestUuid || guest.guest_uuid || guest.uuid || guest.qr_code || '';
                const name = (guest.guest_name || guest.name || '').replace(/,/g, ' '); // Escape commas
                const phone = (guest.phone || '').replace(/,/g, ' ');
                const ticketId = guest.ticket_id || guest.qrTicketId || guest.qr_code || '';
                const status = guest.status || 'checked_in';
                const ticketsBought = guest.total_entries || 1;
                const count = guest.check_in_count || (guest.used_entries > 0 ? 1 : 0);
                const time = guest.scanned_at || guest.given_check_in_time || '';

                csvString += `${uuid},${name},${phone},${ticketId},${status},${ticketsBought},${count},${time}\n`;
            });

            // File Path
            const filename = `wowsly_export_${eventId}_${new Date().getTime()}.csv`;
            const path = Platform.OS === 'android'
                ? `${RNFS.DownloadDirectoryPath}/${filename}`
                : `${RNFS.DocumentDirectoryPath}/${filename}`;

            // Write File
            await RNFS.writeFile(path, csvString, 'utf8');

            Toast.show({
                type: 'success',
                text1: 'Export Successful',
                text2: `Saved to ${filename}`,
                visibilityTime: 4000
            });

        } catch (error) {
            console.error("Export failed:", error);
            Toast.show({
                type: 'error',
                text1: 'Export Failed',
                text2: 'Could not save CSV file.',
            });
        }
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
            // Use paginated fetch
            const res = await getTicketsForEventPage(eventId, page, 100, searchQuery);

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
            /* ⚡⚡⚡ REFACTORED: Use performGateCheckIn for Strict Single Entry ⚡⚡⚡ */
            const uuid = selectedGuest.qrGuestUuid || selectedGuest.guest_uuid || selectedGuest.uuid;

            if (uuid) {
                // 1. ATOMIC UPDATE (Returns 0 if already checked in)
                const rowsAffected = await performGateCheckIn(Number(eventId), uuid);

                if (rowsAffected === 0) {
                    Toast.show({
                        type: 'error',
                        text1: 'Check-in Failed',
                        text2: 'Guest already checked in'
                    });
                    return;
                }

                // 2. Call API to verify/sync immediately if possible
                // (Optional: can just queue it. But existing logic tried to sync)
                const guestUuid = uuid;
                if (guestUuid) {
                    verifyQrCode(eventId, { qrGuestUuid: guestUuid })
                        .then((res) => {
                            // ... silent success
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
                styles={styles}
            />
        );
    }, [styles]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ResponsiveContainer maxWidth={isTablet ? 900 : 420}>
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
                    <View style={{ marginTop: 10 }}>
                        {/* Search Bar - Standardized */}
                        <View style={styles.searchWrapper}>
                            <View style={styles.searchField}>
                                <Image source={SEARCH_ICON} style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search guests..."
                                    placeholderTextColor="#9E9E9E"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                        </View>
                    </View>



                    {/* List */}
                    <FlatList
                        data={guests}
                        /* ⚡⚡⚡ FIX: Use guest_uuid + ticket_id + index for UNIQUE key ⚡⚡⚡ */
                        keyExtractor={(item, index) => {
                            const uuid = item.qrGuestUuid || item.guest_uuid || item.uuid || item.qr_code || 'nouuid';
                            const tId = item.ticket_id || item.qrTicketId || '0';
                            return `${uuid}_${tId}_${index}`;
                        }}
                        renderItem={renderGuestItem}
                        contentContainerStyle={styles.listContent}
                        getItemLayout={(data, index) => ({
                            length: verticalScale(80), // Approx height + marginBottom(12)
                            offset: verticalScale(80) * index,
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
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={lastPage || 1}
                                    onPageChange={loadGuests}
                                />
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
            </ResponsiveContainer>
        </SafeAreaView>
    );
};

// ⚡⚡⚡ MEMOIZED GUEST ROW COMPONENT ⚡⚡⚡
const MemoizedGuestRow = React.memo(({ item, onPress, styles }: { item: any, onPress: () => void, styles: any }) => {
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
                {/* REMOVED: Ticket ID display per user request */}
            </View>
            {/* Status UI Hidden */}
        </TouchableOpacity>
    );
});

export default OfflineGuestList;

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
        fontSize: moderateScale(22),
        fontWeight: '700',
        color: '#1F1F1F',
        textAlign: 'center',
    },
    // Search Styles - Standardized from EventListing.tsx
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: moderateScale(20),
        paddingHorizontal: moderateScale(20),
        height: verticalScale(55),
        marginBottom: verticalScale(25),
        shadowColor: '#999',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: moderateScale(6),
        elevation: 3, // Slightly higher elevation for float effect
        gap: moderateScale(12),
        borderWidth: 0, // Ensure no border overrides shadow
    },
    searchField: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    searchIcon: {
        width: moderateScale(18),
        height: moderateScale(18),
        // removed margin as gap handles it
    },
    searchInput: {
        flex: 1,
        fontSize: moderateScale(FontSize.md),
        color: '#111111',
        paddingLeft: moderateScale(8),
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
        marginBottom: verticalScale(12),
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
    guestDetails: {
        fontSize: moderateScale(FontSize.xs), // 12 -> xs
        color: '#7A7A7A',
        marginTop: verticalScale(2),
    },
    statusChip: {
        backgroundColor: '#E3F8EB',
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(4),
        borderRadius: scale(12),
    },
    statusChipText: {
        fontSize: moderateScale(FontSize.xs), // 12 -> xs
        fontWeight: '600',
        color: '#16794C',
    },
    entryCountText: {
        fontSize: moderateScale(FontSize.xs), // 10 -> xs(12) or 10. Let's stick to xs for consistency or keep if really small needed. Instruction says "systematically apply moderateScale(FontSize.X)". So I should use constants.
        color: '#16794C',
        marginTop: verticalScale(2),
        textAlign: 'center',
    },
    emptyContainer: {
        marginTop: verticalScale(80),
        alignItems: 'center',
        gap: scale(12),
    },
    emptyIcon: {
        width: scale(120),
        height: scale(120),
        resizeMode: 'contain',
    },
    emptyText: {
        fontSize: moderateScale(FontSize.md), // 16 -> md
        fontWeight: '600',
        color: '#111111',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRight: {
        width: scale(40),
        alignItems: 'flex-end',
    },
    menuButton: {
        padding: scale(8),
    },
    menuIconImage: {
        width: scale(24),
        height: scale(24),
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
        top: verticalScale(70), // Adjust based on header height
        right: scale(20),
        backgroundColor: 'white',
        borderRadius: scale(12),
        paddingVertical: verticalScale(8),
        paddingHorizontal: scale(12),
        minWidth: scale(150),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.15,
        shadowRadius: scale(12),
        elevation: 10,
        zIndex: 100,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    menuItem: {
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(8),
    },
    menuItemText: {
        fontSize: moderateScale(FontSize.md), // 15 -> md (16)
        fontWeight: '500',
        color: '#333',
    },
    // Filter Styles
    filterButton: {
        height: scale(48),
        width: scale(48),
        backgroundColor: '#F6F6F6',
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: scale(12),
        marginBottom: verticalScale(16),
    },
    filterButtonActive: {
        backgroundColor: '#FF8A3C',
    },
    filterIcon: {
        width: scale(20),
        height: scale(20),
        tintColor: '#9B9B9B',
        resizeMode: 'contain',
    },
    filterDropdown: {
        position: 'absolute',
        top: verticalScale(140), // Below search bar
        right: scale(20),
        backgroundColor: 'white',
        borderRadius: scale(12),
        paddingVertical: verticalScale(8),
        minWidth: scale(160),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.15,
        shadowRadius: scale(12),
        elevation: 10,
        zIndex: 100,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    filterItem: {
        paddingVertical: verticalScale(12),
        paddingHorizontal: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    filterItemText: {
        fontSize: moderateScale(FontSize.sm), // 14 -> sm
        color: '#333',
        fontWeight: '500',
    },
    filterItemTextActive: {
        color: '#FF8A3C',
        fontWeight: '700',
    },
    activeDot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
        backgroundColor: '#FF8A3C',
    },
});
