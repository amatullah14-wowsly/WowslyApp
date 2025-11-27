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
import AsyncStorage from '@react-native-async-storage/async-storage';

type OfflineGuestListRoute = RouteProp<
    {
        OfflineGuestList: {
            eventId: number;
            offlineData?: any[];
        };
    },
    'OfflineGuestList'
>;

const BACK_ICON = require('../../assets/img/common/back.png');
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
            const savedData = await AsyncStorage.getItem(`offline_guests_${eventId}`);
            if (savedData) {
                setGuests(JSON.parse(savedData));
            }
        } catch (error) {
            console.error('Error loading offline guests:', error);
        } finally {
            setLoading(false);
        }
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
        const avatar = item.avatar || item.profile_photo || 'https://ui-avatars.com/api/?name=' + name;
        // In offline mode, we might not have real-time status, but we can show what we have
        const status = item.status || 'Offline';

        return (
            <View style={styles.guestRow}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View style={styles.guestInfo}>
                    <Text style={styles.guestName}>{name}</Text>
                    <Text style={styles.guestDetails}>Ticket ID: {item.ticket_id || item.guest_uuid || 'N/A'}</Text>
                </View>
                <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>{status}</Text>
                </View>
            </View>
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
