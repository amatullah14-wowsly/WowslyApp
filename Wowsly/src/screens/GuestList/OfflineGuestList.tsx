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
import { initDB, getTicketsForEvent } from '../../db';
import BackButton from '../../components/BackButton';

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

const OfflineGuestList = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<OfflineGuestListRoute>();
    const { eventId, offlineData: initialData } = route.params;

    const [searchQuery, setSearchQuery] = useState('');
    const [guests, setGuests] = useState<any[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);

    useEffect(() => {
        if (!initialData && eventId) {
            loadOfflineData();
        }
    }, [initialData, eventId]);

    const loadOfflineData = async () => {
        try {
            await initDB();
            const tickets = await getTicketsForEvent(eventId);
            if (tickets && tickets.length > 0) {
                setGuests(tickets);
                console.log(`Loaded ${tickets.length} guests from database for offline guest list`);
            }
        } catch (error) {
            console.error('Error loading offline guests:', error);
        } finally {
            setLoading(false);
        }
    };

    // Listen for real-time updates (from HostDashboard or ClientConnection)
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('REFRESH_GUEST_LIST', () => {
            console.log('Received REFRESH_GUEST_LIST event - reloading data');
            loadOfflineData();
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const filteredGuests = useMemo(() => {
        return guests.filter((guest) => {
            const query = searchQuery.trim().toLowerCase();
            
            if (!query) return true;

            const name = (guest.guest_name || guest.name || guest.first_name + ' ' + guest.last_name || 'Guest').toLowerCase();
            const phone = (guest.phone || guest.mobile || '').toString().toLowerCase();
            const qr = (guest.qr_code || '').toString().toLowerCase();
            const ticketId = (guest.ticket_id || '').toString().toLowerCase();
            const uuid = (guest.guest_uuid || '').toString().toLowerCase();

            return name.includes(query) || phone.includes(query) || qr.includes(query) || ticketId.includes(query) || uuid.includes(query);
        });
    }, [guests, searchQuery]);

    const renderGuest = ({ item }: { item: any }) => {
        const name = item.guest_name || item.name || item.first_name + ' ' + item.last_name || 'Guest';
        const avatar = item.avatar || item.profile_photo;
        // Show status from database
        const status = item.status === 'checked_in' ? 'Checked In' : 'Pending';

        return (
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
                    <Text style={styles.guestDetails}>Ticket ID: {item.qr_code || item.ticket_id || item.guest_uuid || 'N/A'}</Text>
                </View>
                <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>{status}</Text>
                    {(item.total_entries > 1 || item.used_entries > 0) && (
                        <Text style={styles.entryCountText}>
                            {item.used_entries || 0}/{item.total_entries || 1}
                        </Text>
                    )}
                </View>
            </View>
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
                        placeholder="Search by name"
                        placeholderTextColor="#A1A1A1"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Guest List */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FF8A3C" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredGuests}
                        keyExtractor={(item, index) => `${item.guest_id || item.id}-${index}`}
                        contentContainerStyle={styles.listContent}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        renderItem={renderGuest}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                                <Text style={styles.emptyTitle}>No guests found</Text>
                                <Text style={styles.emptySubtitle}>
                                    Try downloading data again if list is empty.
                                </Text>
                            </View>
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={() => {
                                    setLoading(true);
                                    loadOfflineData();
                                }}
                                colors={['#FF8A3C']}
                                tintColor="#FF8A3C"
                            />
                        }
                    />
                )}
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
