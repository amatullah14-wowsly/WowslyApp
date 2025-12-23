import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    Image,
    TouchableOpacity,
    Platform,
    Alert,
    Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import { getEventTicketCheckins, downloadTicketCsv } from '../../api/event';
import RNFS from 'react-native-fs';
import Toast from 'react-native-toast-message';
import { PermissionsAndroid } from 'react-native';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';

const { width } = Dimensions.get('window');

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
// Using a generic download icon if specific asset isn't available, or keep existing url
const DOWNLOAD_ICON = { uri: 'https://img.icons8.com/ios-glyphs/30/000000/download.png' };

const CustomProgressBar = ({ current, total, color = '#FF8A3C', height }: { current: number, total: number, color?: string, height?: number }) => {
    const barHeight = height || 6;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const clampedPercentage = Math.min(100, Math.max(0, percentage));

    return (
        <View style={[styles.progressBarBackground, { height: barHeight }]}>
            <View style={[styles.progressBarFill, { width: `${clampedPercentage}%`, backgroundColor: color, height: barHeight }]} />
        </View>
    );
};

const CheckInRecords = () => {
    const navigation = useNavigation<any>();
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

    const handleDownload = async (item: TicketStat) => {
        try {
            if (Platform.OS === 'android' && Number(Platform.Version) < 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    {
                        title: "Storage Permission Required",
                        message: "App needs access to your storage to download the CSV file",
                        buttonNeutral: "Ask Me Later",
                        buttonNegative: "Cancel",
                        buttonPositive: "OK"
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert('Permission Denied', 'Storage permission is required to download files.');
                    return;
                }
            }

            Toast.show({
                type: 'info',
                text1: 'Downloading...',
                text2: 'Please wait while we generate the CSV file.'
            });

            const csvData = await downloadTicketCsv(eventId, item.ticket_id);

            if (!csvData) {
                Toast.show({ type: 'error', text1: 'Download Failed', text2: 'No data received from server.' });
                return;
            }

            // Create filename
            const timestamp = new Date().getTime();
            const sanitizedName = item.ticket_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `Checkins_${sanitizedName}_${timestamp}.csv`;

            // Determine path
            const path = Platform.OS === 'android'
                ? `${RNFS.DownloadDirectoryPath}/${filename}`
                : `${RNFS.DocumentDirectoryPath}/${filename}`;

            console.log('Writing file to:', path);

            await RNFS.writeFile(path, csvData, 'utf8');

            Toast.show({
                type: 'success',
                text1: 'Download Successful',
                text2: `Saved to ${Platform.OS === 'android' ? 'Downloads' : 'Documents'}`
            });

        } catch (error: any) {
            console.error('Download Error:', error);
            Toast.show({
                type: 'error',
                text1: 'Download Failed',
                text2: error.message || 'An error occurred.'
            });
        }
    };

    const renderItem = ({ item }: { item: TicketStat }) => {
        const checkedIn = Number(item.total_check_in || 0);
        const total = Number(item.total_purchase_ticket || 0);
        const facilities = item.total_facilities_check_in?.facilities || [];
        const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.ticketName} numberOfLines={1}>{item.ticket_name}</Text>
                        <Text style={styles.ticketPercentage}>{percentage}% Done</Text>
                    </View>
                    <View style={styles.iconsRow}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => navigation.navigate('TicketCheckInDetails', {
                                eventId,
                                ticketId: item.ticket_id,
                                ticketName: item.ticket_name
                            })}>
                            <Image source={INFO_ICON} style={styles.icon} resizeMode="contain" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.iconButton, { marginLeft: scale(8) }]}
                            onPress={() => handleDownload(item)}
                        >
                            <Image source={DOWNLOAD_ICON} style={styles.icon} resizeMode="contain" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Main Check-in Progress */}
                <View style={styles.mainProgressContainer}>
                    <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>Check-Ins</Text>
                        <Text style={styles.progressValue}>
                            <Text style={styles.highlightValue}>{checkedIn}</Text>
                            <Text style={styles.totalValue}> / {total}</Text>
                        </Text>
                    </View>
                    <CustomProgressBar current={checkedIn} total={total} height={8} />
                </View>

                {/* Separator if facilities exist */}
                {facilities.length > 0 && <View style={styles.separator} />}

                {/* Facilities List */}
                {facilities.length > 0 && (
                    <View style={styles.facilitiesContainer}>
                        <Text style={styles.facilitiesHeader}>Facilities</Text>
                        {facilities.map((facility, index) => {
                            const fCheckedIn = Number(facility.check_in_count || 0);
                            const fTotal = Number(facility.facilities_taken_by_user || 0);
                            return (
                                <View key={index} style={styles.facilityRow}>
                                    <View style={styles.facilityInfo}>
                                        <Text style={styles.facilityName} numberOfLines={1}>{facility.facility_name}</Text>
                                        <Text style={styles.facilityCount}>{fCheckedIn}/{fTotal}</Text>
                                    </View>
                                    <CustomProgressBar current={fCheckedIn} total={fTotal} height={4} color="#4CAF50" />
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>Event Check-In Records</Text>
                <View style={{ width: scale(32) }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF8A3C" />
                </View>
            ) : (
                <FlatList
                    key={'check-in-list-simple'} // Changed key to force fresh render for single column
                    data={checkInStats}
                    keyExtractor={(item, index) => `${item.ticket_id}-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
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
        backgroundColor: '#F8F9FA', // Slightly gray background for better card contrast
    },
    header: {
        width: '100%',
        height: 90,
        paddingTop: verticalScale(20),
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: scale(5),
        zIndex: 10,
    },
    title: {
        fontSize: moderateScale(18),
        fontWeight: '600',
        color: '#111',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: scale(16),
        paddingBottom: verticalScale(40),
    },
    card: {
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(16), // More padding
        marginBottom: verticalScale(16),
        width: '100%', // Full width cards look better for detailed info like this
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: scale(8),
        elevation: 3,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: verticalScale(16),
    },
    titleContainer: {
        flex: 1,
        marginRight: scale(10),
    },
    ticketName: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#222',
        marginBottom: verticalScale(4),
    },
    ticketPercentage: {
        fontSize: moderateScale(12),
        color: '#888',
        fontWeight: '600',
        backgroundColor: '#F0F0F0',
        alignSelf: 'flex-start',
        paddingHorizontal: scale(8),
        paddingVertical: verticalScale(2),
        borderRadius: scale(6),
        overflow: 'hidden',
    },
    iconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        padding: scale(6),
        backgroundColor: '#F5F5F5',
        borderRadius: scale(8),
    },
    icon: {
        width: scale(18),
        height: scale(18),
        tintColor: '#333',
    },
    mainProgressContainer: {
        marginBottom: verticalScale(8),
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(6),
    },
    progressLabel: {
        fontSize: moderateScale(14),
        color: '#555',
        fontWeight: '500',
    },
    progressValue: {
        fontSize: moderateScale(14),
        fontWeight: '600',
    },
    highlightValue: {
        color: '#FF8A3C',
        fontWeight: '700',
    },
    totalValue: {
        color: '#999',
        fontSize: moderateScale(12),
    },
    progressBarBackground: {
        width: '100%',
        backgroundColor: '#F0F0F0',
        borderRadius: scale(4),
        overflow: 'hidden',
    },
    progressBarFill: {
        borderRadius: scale(4),
    },
    separator: {
        height: verticalScale(1),
        backgroundColor: '#F0F0F0',
        marginVertical: verticalScale(12),
    },
    facilitiesContainer: {
        gap: verticalScale(10),
    },
    facilitiesHeader: {
        fontSize: moderateScale(13),
        fontWeight: '700',
        color: '#444',
        marginBottom: verticalScale(4),
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    facilityRow: {
        marginBottom: verticalScale(4),
    },
    facilityInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: verticalScale(4),
    },
    facilityName: {
        fontSize: moderateScale(13),
        color: '#555',
        flex: 1,
    },
    facilityCount: {
        fontSize: moderateScale(12),
        color: '#777',
        fontWeight: '500',
    },
    emptyContainer: {
        padding: scale(40),
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: moderateScale(16),
    }
});

