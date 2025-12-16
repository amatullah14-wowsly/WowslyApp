import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    FlatList
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTicketCheckInRecords, getTicketCheckInCount } from '../../api/event';
import BackButton from '../../components/BackButton';

type FacilityCheckIn = {
    facility_name: string;
    check_in_count: string | number;
    facilities_taken_by_user: number;
};

type TicketStats = {
    total_event_check_in: {
        total_check_in: string | number;
        total_purchase_ticket: number;
    };
    total_facilities_check_in: {
        facilities: FacilityCheckIn[];
    };
};

type GuestRecord = {
    id: number;
    guest_id: number;
    name: string;
    email: string;
    mobile: string;
    check_in_count: number;
    check_in_time: string;
    invited_by_name: string | null;
    facilities: {
        facility_name: string;
        check_in_count: string;
        check_in_time: string[];
    }[];
};

const TicketCheckInDetails = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, ticketId, ticketName } = route.params || {};

    const [statsLoading, setStatsLoading] = useState(true);
    const [stats, setStats] = useState<TicketStats | null>(null);

    const [recordsLoading, setRecordsLoading] = useState(false);
    const [records, setRecords] = useState<GuestRecord[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [expandedGuestId, setExpandedGuestId] = useState<number | null>(null);

    useEffect(() => {
        if (eventId && ticketId) {
            fetchStats();
            fetchRecords(1);
        }
    }, [eventId, ticketId]);

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await getTicketCheckInCount(eventId, ticketId);
            setStats(res);
        } catch (error) {
            console.error("Failed to fetch stats", error);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchRecords = async (pageNum: number) => {
        setRecordsLoading(true);
        try {
            const res = await getTicketCheckInRecords(eventId, ticketId, pageNum);
            if (res && res.data) {
                setRecords(res.data);
                setPage(res.current_page);
                setTotalPages(res.last_page);
            }
        } catch (error) {
            console.error("Failed to fetch records", error);
        } finally {
            setRecordsLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedGuestId(expandedGuestId === id ? null : id);
    };

    const renderRecordItem = ({ item }: { item: GuestRecord }) => {
        const isExpanded = expandedGuestId === item.id;
        const hasFacilities = item.facilities && item.facilities.length > 0;

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.cardContent}
                    onPress={() => hasFacilities && toggleExpand(item.id)}
                    activeOpacity={hasFacilities ? 0.7 : 1}
                >
                    <View style={styles.cardHeader}>
                        <Text style={styles.guestName}>{item.name}</Text>
                        <Text style={styles.checkInTime}>
                            {new Date(item.check_in_time).toLocaleString('en-US', {
                                day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true
                            })}
                        </Text>
                    </View>

                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Email:</Text>
                        <Text style={styles.cardValue}>{item.email}</Text>
                    </View>
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Mobile:</Text>
                        <Text style={styles.cardValue}>+{item.dialing_code || '91'} {item.mobile}</Text>
                    </View>
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Guests:</Text>
                        <Text style={styles.cardValue}>1</Text>
                    </View>
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Invited By:</Text>
                        <Text style={styles.cardValue}>{item.invited_by_name || 'N/A'}</Text>
                    </View>

                    {hasFacilities && (
                        <View style={styles.expandHint}>
                            <Text style={styles.expandHintText}>
                                {isExpanded ? 'Hide Facilities' : 'Show Facilities'}
                            </Text>
                            <View style={styles.iconCircle}>
                                <Text style={styles.iconText}>{isExpanded ? '-' : '+'}</Text>
                            </View>
                        </View>
                    )}
                </TouchableOpacity>

                {isExpanded && hasFacilities && (
                    <View style={styles.facilitiesContainer}>
                        {item.facilities.map((fac, idx) => (
                            <View key={idx} style={styles.facilityItem}>
                                <View style={styles.facilityHeader}>
                                    <Text style={styles.facilityName}>{fac.facility_name}</Text>
                                    <Text style={styles.facilityCount}>Count: {fac.check_in_count}</Text>
                                </View>
                                <View style={styles.facilityTimes}>
                                    {fac.check_in_time.map((t, tIdx) => (
                                        <Text key={tIdx} style={styles.facilityTimeText}>
                                            {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>Ticket Check In Details</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={styles.content}>
                {statsLoading ? (
                    <ActivityIndicator size="small" color="#FF8A3C" />
                ) : stats ? (
                    <View style={styles.statsPanel}>
                        <View style={styles.statCard}>
                            <Text style={styles.statsTotalTitle}>Total Check In</Text>
                            <Text style={styles.statsTotalValue}>
                                {stats.total_event_check_in.total_check_in}/{stats.total_event_check_in.total_purchase_ticket}
                            </Text>
                        </View>
                        <View style={styles.facilitiesStatsRow}>
                            {stats.total_facilities_check_in?.facilities.map((fac, index) => (
                                <View key={index} style={styles.statChip}>
                                    <Text style={styles.statChipText}>
                                        {fac.facility_name}: {fac.check_in_count}/{fac.facilities_taken_by_user}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {recordsLoading ? (
                    <ActivityIndicator size="large" color="#FF8A3C" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={records}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderRecordItem}
                        contentContainerStyle={styles.listContent}
                    />
                )}

                <View style={styles.pagination}>
                    <TouchableOpacity
                        disabled={page <= 1}
                        onPress={() => fetchRecords(page - 1)}
                        style={[styles.pageBtn, page <= 1 && styles.disabledBtn]}
                    >
                        <Text style={styles.pageBtnText}>{'<'}</Text>
                    </TouchableOpacity>
                    <View style={styles.pageNumberContainer}>
                        <Text style={styles.pageNumberText}>{page}</Text>
                    </View>
                    <TouchableOpacity
                        disabled={page >= totalPages}
                        onPress={() => fetchRecords(page + 1)}
                        style={[styles.pageBtn, page >= totalPages && styles.disabledBtn]}
                    >
                        <Text style={styles.pageBtnText}>{'>'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default TicketCheckInDetails;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5', // Light gray background for better card contrast
    },
    header: {
        width: '100%',
        height: 60,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        backgroundColor: 'white',
        elevation: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: 'black',
    },
    content: {
        flex: 1,
    },
    statsPanel: {
        padding: 16,
        backgroundColor: 'white',
        marginBottom: 10,
        elevation: 1,
    },
    statCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        marginBottom: 10,
    },
    statsTotalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    statsTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF8A3C',
    },
    facilitiesStatsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statChip: {
        backgroundColor: '#FFF0E0',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#FFD2B3',
    },
    statChipText: {
        fontSize: 12,
        color: '#D95C0F',
        fontWeight: '500',
    },
    listContent: {
        padding: 16,
        paddingTop: 0,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardContent: {
        // padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 8,
    },
    guestName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
    checkInTime: {
        fontSize: 12,
        color: '#666',
    },
    cardRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    cardLabel: {
        width: 80,
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },
    cardValue: {
        flex: 1,
        fontSize: 13,
        color: '#333',
        fontWeight: '400',
    },
    expandHint: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F9F9F9',
    },
    expandHintText: {
        fontSize: 12,
        color: '#FF8A3C',
        marginRight: 6,
        fontWeight: '500',
    },
    iconCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FF8A3C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        lineHeight: 16,
    },
    facilitiesContainer: {
        marginTop: 10,
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        padding: 10,
    },
    facilityItem: {
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        paddingBottom: 8,
    },
    facilityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    facilityName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    facilityCount: {
        fontSize: 12,
        color: '#666',
    },
    facilityTimes: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    facilityTimeText: {
        fontSize: 11,
        color: '#888',
        backgroundColor: 'white',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 12,
        backgroundColor: '#F5F5F5',
    },
    pageBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 1,
    },
    disabledBtn: {
        opacity: 0.5,
        backgroundColor: '#E0E0E0',
        elevation: 0,
    },
    pageBtnText: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
    },
    pageNumberContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FF8A3C', // Orange
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    pageNumberText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
