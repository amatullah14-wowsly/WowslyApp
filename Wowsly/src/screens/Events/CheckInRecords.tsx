import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    Image,
    TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getEventTicketCheckins } from '../../api/event';
import BackButton from '../../components/BackButton';

type FacilityStat = {
    facility_name: string;
    check_in_count: string | number;
    facilities_taken_by_user: number;
};

type TicketStat = {
    ticket_id: number;
    ticket_name: string;
    total_check_in: string | number;
    total_purchase_ticket: number;
    total_facilities_check_in?: {
        facilities: FacilityStat[];
    };
};

const INFO_ICON = require('../../assets/img/common/info.png');
const DOWNLOAD_ICON = { uri: 'https://img.icons8.com/ios-glyphs/30/000000/download.png' };

const CheckInRecords = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId } = route.params || {};
    const [loading, setLoading] = useState(true);
    const [checkInStats, setCheckInStats] = useState<TicketStat[]>([]);

    useEffect(() => {
        if (eventId) {
            fetchCheckInStats(eventId);
        }
    }, [eventId]);

    const fetchCheckInStats = async (id: string) => {
        setLoading(true);
        try {
            const res = await getEventTicketCheckins(id);
            const data = res?.data || (Array.isArray(res) ? res : []);
            setCheckInStats(data);
        } catch (error) {
            console.error("Failed to load check-in stats", error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: TicketStat }) => {
        const checkedIn = Number(item.total_check_in || 0);
        const total = Number(item.total_purchase_ticket || 0);
        const facilities = item.total_facilities_check_in?.facilities || [];

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.ticketName} numberOfLines={1}>{item.ticket_name}</Text>
                    <View style={styles.iconsRow}>
                        {/* Info Icon */}
                        <TouchableOpacity onPress={() => navigation.navigate('TicketCheckInDetails', {
                            eventId,
                            ticketId: item.ticket_id,
                            ticketName: item.ticket_name
                        })}>
                            <Image source={INFO_ICON} style={styles.icon} resizeMode="contain" />
                        </TouchableOpacity>
                        {/* Download Icon */}
                        <TouchableOpacity style={{ marginLeft: 8 }}>
                            <Image source={DOWNLOAD_ICON} style={styles.icon} resizeMode="contain" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <Text style={styles.entryText}>
                        Entry : {checkedIn}/{total}
                    </Text>
                    {facilities.map((facility, index) => (
                        <Text key={index} style={styles.entryText}>
                            {facility.facility_name} : {facility.check_in_count}/{facility.facilities_taken_by_user}
                        </Text>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>Event Check-In Records</Text>
                <View style={{ width: 32 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF8A3C" />
                </View>
            ) : (
                <FlatList
                    key={'check-in-grid-2'} // Force fresh render when columns change
                    data={checkInStats}
                    keyExtractor={(item, index) => `${item.ticket_id}-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No check-in records found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

export default CheckInRecords;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        width: '100%',
        height: 90,
        paddingTop: 20, // Push content down
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: 'black',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: 12,
    },
    card: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        minHeight: 120, // Increased min height
        width: '48%', // Adjusted for 2 columns with gap
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    ticketName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
        flex: 1,
        marginRight: 8,
    },
    iconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        width: 18,
        height: 18,
        tintColor: '#1F2937',
    },
    statsContainer: {
        gap: 4,
    },
    entryText: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
        lineHeight: 18,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    }
});
