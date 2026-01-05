import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    Modal,
    ScrollView,
    Image,
    useWindowDimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTicketCheckInRecords, getTicketCheckInCount } from '../../api/event';
import BackButton from '../../components/BackButton';
import { useScale } from '../../utils/useScale';
import Pagination from '../../components/Pagination';
import { numberToWords } from '../../utils/stringUtils';
import SystemNavigationBar from 'react-native-system-navigation-bar';

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

    const { scale, verticalScale, moderateScale } = useScale();

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: 'white',
        },
        header: {
            width: '100%',
            height: verticalScale(90),
            paddingTop: verticalScale(20),
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: moderateScale(20),
            backgroundColor: 'white',
            elevation: 2,
        },
        headerSpacer: {
            width: moderateScale(40), // Balance back button
        },
        title: {
            fontSize: moderateScale(18),
            fontWeight: '600',
            color: 'black',
            flex: 1,
            textAlign: 'center',
        },
        content: {
            flex: 1,
        },
        statsPanel: {
            padding: moderateScale(16),
            backgroundColor: 'white',
            marginBottom: verticalScale(0),
            elevation: 1,
        },
        statCard: {
            flexDirection: 'column',
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: '#EEE',
            borderRadius: moderateScale(12),
            padding: moderateScale(16),
            marginBottom: verticalScale(12),
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: moderateScale(4),
        },
        statsTotalTitle: {
            fontSize: moderateScale(16),
            fontWeight: 'bold',
            color: '#222',
            marginBottom: verticalScale(12),
        },
        statsRowHorizontal: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        statItemHalf: {
            flex: 1,
            alignItems: 'center',
        },
        statLabel: {
            fontSize: moderateScale(14),
            color: '#666',
            fontWeight: '500',
            marginBottom: verticalScale(4),
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        statValueHighlight: {
            fontSize: moderateScale(16), // Slightly larger
            fontWeight: 'bold',
            color: '#FF8A3C',
            textTransform: 'capitalize',
        },
        statValue: {
            fontSize: moderateScale(16), // Slightly larger
            fontWeight: '600',
            color: '#444',
            textTransform: 'capitalize',
        },
        statDividerVertical: {
            width: 1,
            height: '80%',
            backgroundColor: '#F0F0F0',
            marginHorizontal: moderateScale(16),
        },
        facilitiesStatsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: moderateScale(8),
        },
        statChip: {
            backgroundColor: '#FFF0E0',
            paddingHorizontal: moderateScale(10),
            paddingVertical: verticalScale(5),
            borderRadius: moderateScale(8),
            borderWidth: 1,
            borderColor: '#FFD2B3',
        },
        statChipText: {
            fontSize: moderateScale(12),
            color: '#D95C0F',
            fontWeight: '500',
        },
        listContent: {
            padding: moderateScale(16),
            paddingTop: verticalScale(8),
        },
        columnWrapper: {
            justifyContent: 'space-between',
            gap: moderateScale(12),
        },
        // Grid Card Styles
        gridCard: {
            backgroundColor: 'white',
            borderRadius: moderateScale(16),
            marginBottom: verticalScale(16),
            padding: moderateScale(12),
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: moderateScale(4),
            width: '48%',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: verticalScale(150),
            borderWidth: 1,
            borderColor: '#F5F5F5',
        },
        cardHeaderCenter: {
            alignItems: 'center',
            width: '100%',
            flex: 1,
            justifyContent: 'center',
            paddingVertical: verticalScale(4),
        },
        gridGuestName: {
            fontSize: moderateScale(15),
            fontWeight: '700',
            color: '#222',
            textAlign: 'center',
            marginBottom: verticalScale(8),
            lineHeight: verticalScale(20),
        },
        ticketBadge: {
            backgroundColor: '#FFF5E5',
            paddingHorizontal: moderateScale(10),
            paddingVertical: verticalScale(4),
            borderRadius: moderateScale(8),
            marginBottom: verticalScale(8),
            borderWidth: 1,
            borderColor: '#FFD2B3',
        },
        gridTicketCount: {
            fontSize: moderateScale(13),
            color: '#E65100',
            fontWeight: '600',
        },
        gridCheckInTime: {
            fontSize: moderateScale(11),
            color: '#888',
            marginTop: verticalScale(4),
        },
        viewDetailsButton: {
            marginTop: verticalScale(12),
            width: '100%',
            paddingVertical: verticalScale(8),
            backgroundColor: '#fff',
            borderRadius: moderateScale(8),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#EEEEEE',
        },
        viewDetailsText: {
            fontSize: moderateScale(12),
            fontWeight: '600',
            color: '#555',
        },

        // Pagination
        pagination: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: verticalScale(16),
            gap: moderateScale(12),
            backgroundColor: '#F8F9FA',
        },
        pageBtn: {
            width: moderateScale(32),
            height: moderateScale(32),
            borderRadius: moderateScale(16),
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
            fontSize: moderateScale(16),
            color: '#666',
            fontWeight: 'bold',
        },
        pageNumberContainer: {
            width: moderateScale(32),
            height: moderateScale(32),
            borderRadius: moderateScale(16),
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
            justifyContent: 'flex-end',
        },
        modalContainer: {
            width: '100%',
            maxHeight: '50%', // Compact height
            backgroundColor: 'white',
            borderTopLeftRadius: moderateScale(20),
            borderTopRightRadius: moderateScale(20),
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.2,
            shadowRadius: moderateScale(10),
            overflow: 'hidden',
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: moderateScale(20),
            paddingVertical: verticalScale(10), // Compact padding
            borderBottomWidth: 1,
            borderBottomColor: '#F0F0F0',
        },
        modalTitle: {
            fontSize: moderateScale(16), // Compact font
            fontWeight: '700',
            color: '#222',
        },
        closeButton: {
            padding: moderateScale(5),
        },
        closeButtonText: {
            fontSize: moderateScale(18),
            color: '#999',
        },
        modalBody: {
            padding: moderateScale(20),
            paddingBottom: verticalScale(30),
        },
        modalRow: {
            marginBottom: verticalScale(8), // Compact margin
        },
        modalLabel: {
            fontSize: moderateScale(11), // Compact font
            color: '#888',
            fontWeight: '600',
            textTransform: 'uppercase',
            marginBottom: verticalScale(2),
        },
        modalValueMain: {
            fontSize: moderateScale(16), // Compact font
            fontWeight: '700',
            color: '#111',
        },
        modalValue: {
            fontSize: moderateScale(14), // Compact font
            color: '#333',
            fontWeight: '500',
        },
        separator: {
            height: verticalScale(1),
            backgroundColor: '#F0F0F0',
            marginVertical: verticalScale(8), // Compact margin
        },
        modalFacilitiesContainer: {
            marginTop: verticalScale(8),
            backgroundColor: '#F9F9F9',
            borderRadius: moderateScale(12),
            padding: moderateScale(12),
        },
        modalSectionTitle: {
            fontSize: moderateScale(13),
            fontWeight: '700',
            color: '#444',
            marginBottom: verticalScale(8),
        },
        modalFacilityItem: {
            marginBottom: verticalScale(8),
            borderBottomWidth: 1,
            borderBottomColor: '#EEE',
            paddingBottom: verticalScale(6),
        },
        modalFacilityHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: verticalScale(4),
        },
        modalFacilityName: {
            fontSize: moderateScale(13),
            fontWeight: '600',
            color: '#333',
        },
        modalFacilityCount: {
            fontSize: moderateScale(12),
            color: '#666',
        },
        facilityTimes: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: moderateScale(6),
        },
        facilityTimeText: {
            fontSize: moderateScale(10),
            color: '#888',
            backgroundColor: 'white',
            paddingHorizontal: moderateScale(6),
            paddingVertical: verticalScale(2),
            borderRadius: moderateScale(4),
            borderWidth: 1,
            borderColor: '#EEE',
        },
        modalFooter: {
            padding: moderateScale(16),
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
        },
        modalCloseBtn: {
            backgroundColor: '#FF8A3C',
            borderRadius: moderateScale(12),
            paddingVertical: verticalScale(14),
            alignItems: 'center',
        },
        modalCloseBtnText: {
            color: 'white',
            fontSize: moderateScale(16),
            fontWeight: '700',
        }
    }), [scale, verticalScale, moderateScale]);

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
        SystemNavigationBar.stickyImmersive(); // Enforce immersive
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedGuest(null);
        SystemNavigationBar.stickyImmersive(); // Re-enforce on close just in case
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
                        <Text style={styles.gridTicketCount}>1 × Ticket</Text>
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
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.content}>
                {statsLoading ? (
                    <ActivityIndicator size="small" color="#FF8A3C" />
                ) : stats ? (
                    <View style={styles.statsPanel}>
                        <View style={styles.statCard}>
                            <Text style={styles.statsTotalTitle}>Total Check In</Text>

                            <View style={styles.statsRowHorizontal}>
                                <View style={styles.statItemHalf}>
                                    <Text style={styles.statLabel}>Checked In</Text>
                                    <Text style={styles.statValueHighlight}>
                                        {numberToWords(stats.total_event_check_in.total_check_in)}
                                    </Text>
                                </View>
                                <View style={styles.statDividerVertical} />
                                <View style={styles.statItemHalf}>
                                    <Text style={styles.statLabel}>Total Guests</Text>
                                    <Text style={styles.statValue}>
                                        {numberToWords(stats.total_event_check_in.total_purchase_ticket)}
                                    </Text>
                                </View>
                            </View>
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
                    <ActivityIndicator size="large" color="#FF8A3C" style={{ marginTop: verticalScale(20) }} />
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

                {!recordsLoading && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={fetchRecords}
                    />
                )}
            </View>

            {/* Details Modal */}
            <Modal
                animationType="slide"
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
