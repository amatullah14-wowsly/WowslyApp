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
} from 'react-native';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { initDB, getTicketsForEvent, updateTicketStatusLocal } from '../../db';
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

    useEffect(() => {
        loadGuests();
    }, [eventId]);

    // Listen for scan updates to refresh list in real-time
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('BROADCAST_SCAN_TO_CLIENTS', (data) => {
            console.log("OfflineGuestList received broadcast:", data);
            loadGuests();
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const loadGuests = async () => {
        try {
            await initDB();
            const tickets = await getTicketsForEvent(eventId);
            if (tickets) {
                setGuests(tickets);
            }
        } catch (error) {
            console.error('Error loading offline guests:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadGuests();
        setRefreshing(false);
    };

    const filteredGuests = useMemo(() => {
        if (!searchQuery) return guests;
        const query = searchQuery.toLowerCase();
        return guests.filter((g) => {
            const name = (g.guest_name || g.name || '').toLowerCase();
            const phone = (g.phone || '').toLowerCase();
            const qr = (g.qr_code || '').toLowerCase();
            const ticketId = (g.ticket_id || '').toString().toLowerCase();
            const uuid = (g.guest_uuid || '').toLowerCase();
            return name.includes(query) || phone.includes(query) || qr.includes(query) || ticketId.includes(query) || uuid.includes(query);
        });
    }, [guests, searchQuery]);

    const handleManualCheckIn = async (guestId: string) => {
        if (!selectedGuest) return;

        // Offline Manual Check-in
        try {
            const qrCode = selectedGuest.qr_code;
            if (qrCode) {
                await updateTicketStatusLocal(qrCode, 'checked_in', 1);

                // Broadcast update
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
                setModalVisible(false);
            }
        } catch (error) {
            console.error("Manual check-in failed:", error);
        }
    };

    const renderGuest = ({ item }: { item: any }) => {
        const name = item.guest_name || item.name || item.first_name + ' ' + item.last_name || 'Guest';
        const avatar = item.avatar || item.profile_photo;
        // Show status from database
        const status = item.status === 'checked_in' ? 'Checked In' : 'Pending';
        const style = statusChipStyles[status] || statusChipStyles['Pending'];

        return (
            <TouchableOpacity
                style={styles.guestRow}
                onPress={() => {
                    setSelectedGuest(item);
                    setModalVisible(true);
                }}
            >
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
                    <Text style={styles.guestDetails}>Ticket ID: {item.qr_code || item.ticket_id || item.guest_uuid || 'N/A'}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: style.backgroundColor }]}>
                    <Text style={[styles.statusChipText, { color: style.color }]}>{status}</Text>
                    {(item.total_entries > 1 || item.used_entries > 0) && (
                        <Text style={[styles.entryCountText, { color: style.color }]}>
                            {item.used_entries || 0}/{item.total_entries || 1}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <BackButton onPress={() => navigation.goBack()} />

                    <Text style={styles.title} numberOfLines={1}>
                        Offline Guest List
                    </Text>

                    <View style={{ width: 40 }} />
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Image source={SEARCH_ICON} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search guests..."
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* List */}
                <FlatList
                    data={filteredGuests}
                    keyExtractor={(item, index) => (item.qr_code || index).toString()}
                    renderItem={renderGuest}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8A3C" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                            <Text style={styles.emptyText}>No guests found</Text>
                        </View>
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
                    onManualCheckIn={() => handleManualCheckIn(selectedGuest?.guest_id)}
                />
            </View>
        </SafeAreaView>
    );
};

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
});
