import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    Modal,
    Dimensions,
    ScrollView,
    Image
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTicketCheckInRecords, getTicketCheckInCount } from '../../api/event';
import BackButton from '../../components/BackButton';

const { width } = Dimensions.get('window');

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

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState<GuestRecord | null>(null);

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
            console.log(`FetchRecords Page ${pageNum} Res:`, JSON.stringify(res).substring(0, 200) + "...");
            if (res && res.data) {
                // Normalize data to array if it's an object (API inconsistency)
                let recordsData = res.data;
                if (recordsData && typeof recordsData === 'object' && !Array.isArray(recordsData)) {
                    // Assume it's an object keyed by index/id, convert to array values
                    recordsData = Object.values(recordsData);
                }

                setRecords(recordsData);

                // Handle pagination from root or meta object
                const meta = res.meta || res;
                const currentPage = meta.current_page || pageNum;
                const lastPage = meta.last_page || 1;

                setPage(currentPage);
                setTotalPages(lastPage);
                console.log(`Pagination updated: Page ${currentPage} of ${lastPage}`);
            }
        } catch (error) {
            console.error("Failed to fetch records", error);
        } finally {
            setRecordsLoading(false);
        }
    };

    const handleViewDetails = (guest: GuestRecord) => {
        setSelectedGuest(guest);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedGuest(null);
    };

    const formatTime = (timeString: string) => {
        if (!timeString) return '';

        let dateToParse = timeString;

        // Ensure ISO format with "T" separator
        if (dateToParse.indexOf('T') === -1) {
            dateToParse = dateToParse.replace(' ', 'T');
        }

        // The user confirmed API response is in UTC (UST).
        // If the string doesn't specify timezone (no 'Z' or offset), append 'Z' to treat it as UTC.
        // This ensures new Date() creates a UTC date, which toLocaleString then converts to Device Time (IST).
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

    const renderRecordItem = ({ item }: { item: GuestRecord }) => {
        return (
            <View style={styles.gridCard}>
                <View style={styles.cardHeaderCenter}>
                    {/* Avatar Removed as per request */}
                    <Text style={styles.gridGuestName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.ticketBadge}>
                        <Text style={styles.gridTicketCount}>1 Ticket</Text>
                    </View>
                    <Text style={styles.gridCheckInTime}>
                        {formatTime(item.check_in_time)}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.viewDetailsButton}
                    onPress={() => handleViewDetails(item)}
                >
                    <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>
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
                        key={'grid-view-records-compact'} // New key for layout change
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderRecordItem}
                        contentContainerStyle={styles.listContent}
                        numColumns={2}
                        columnWrapperStyle={styles.columnWrapper}
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

            {/* Details Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Guest Details</Text>
                            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedGuest && (
                            <ScrollView contentContainerStyle={styles.modalBody}>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Name:</Text>
                                    <Text style={styles.modalValueMain}>{selectedGuest.name}</Text>
                                </View>
                                <View style={styles.separator} />

                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Email:</Text>
                                    <Text style={styles.modalValue}>{selectedGuest.email}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Mobile:</Text>
                                    <Text style={styles.modalValue}>+{selectedGuest.mobile}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Invited By:</Text>
                                    <Text style={styles.modalValue}>{selectedGuest.invited_by_name || 'N/A'}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Check-In:</Text>
                                    <Text style={styles.modalValue}>
                                        {formatTime(selectedGuest.check_in_time)}
                                    </Text>
                                </View>

                                {selectedGuest.facilities && selectedGuest.facilities.length > 0 && (
                                    <View style={styles.modalFacilitiesContainer}>
                                        <Text style={styles.modalSectionTitle}>Facility Usage</Text>
                                        {selectedGuest.facilities.map((fac, idx) => (
                                            <View key={idx} style={styles.modalFacilityItem}>
                                                <View style={styles.modalFacilityHeader}>
                                                    <Text style={styles.modalFacilityName}>{fac.facility_name}</Text>
                                                    <Text style={styles.modalFacilityCount}>Used: {fac.check_in_count}</Text>
                                                </View>
                                                <View style={styles.facilityTimes}>
                                                    {fac.check_in_time.map((t, tIdx) => (
                                                        <Text key={tIdx} style={styles.facilityTimeText}>
                                                            {formatTime(t)}
                                                        </Text>
                                                    ))}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        )}

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                                <Text style={styles.modalCloseBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default TicketCheckInDetails;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
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
        paddingTop: 8,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: 12,
    },
    // Grid Card Styles
    gridCard: {
        backgroundColor: 'white',
        borderRadius: 12, // Slightly smaller radius
        marginBottom: 12,
        padding: 12, // Reduced padding
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        width: '48%',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 130, // Reduced height
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    cardHeaderCenter: {
        alignItems: 'center',
        width: '100%',
        flex: 1, // Take available space
        justifyContent: 'center',
    },
    // Removed avatar styles
    gridGuestName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#222',
        textAlign: 'center',
        marginBottom: 6,
        lineHeight: 18,
    },
    ticketBadge: {
        backgroundColor: '#FFF0E0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#FFD2B3',
    },
    gridTicketCount: {
        fontSize: 12,
        color: '#E65100', // Darker orange for highlighter text
        fontWeight: '700',
    },
    gridCheckInTime: {
        fontSize: 10,
        color: '#999',
        marginTop: 2,
    },
    viewDetailsButton: {
        marginTop: 10,
        width: '100%',
        paddingVertical: 6,
        backgroundColor: '#fff',
        borderRadius: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    viewDetailsText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#555',
    },

    // Pagination
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 12,
        backgroundColor: '#F8F9FA',
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
        backgroundColor: '#FF8A3C',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    pageNumberText: {
        color: 'white',
        fontWeight: 'bold',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: 'white',
        borderRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#222',
    },
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 20,
        color: '#999',
    },
    modalBody: {
        padding: 20,
    },
    modalRow: {
        marginBottom: 12,
        //       flexDirection: 'row',
        //       alignItems: 'center',
    },
    modalLabel: {
        fontSize: 12,
        color: '#888',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    modalValueMain: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
    },
    modalValue: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 12,
    },
    modalFacilitiesContainer: {
        marginTop: 10,
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        padding: 16,
    },
    modalSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#444',
        marginBottom: 10,
    },
    modalFacilityItem: {
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        paddingBottom: 8,
    },
    modalFacilityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    modalFacilityName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    modalFacilityCount: {
        fontSize: 13,
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
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    modalCloseBtn: {
        backgroundColor: '#FF8A3C',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalCloseBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    }
});
