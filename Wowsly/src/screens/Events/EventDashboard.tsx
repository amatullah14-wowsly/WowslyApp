import { StyleSheet, Text, View, Image, TouchableOpacity, ImageBackground, ScrollView } from 'react-native'
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Grid from '../../components/Grid';
import { getEventUsers, getEventDetails, getTicketList, getCheckinDistribution } from '../../api/event';
import { getUnsyncedCheckins, getLocalCheckedInGuests } from '../../db';
import BackButton from '../../components/BackButton';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import * as d3 from 'd3-shape';



const COLORS = ['#FFF5C4', '#FFD180', '#FFAB40', '#FF6D00', '#D50000', '#8E0000', '#5D0000'];

type EventData = {
    id: string
    title: string
    date: string
    location: string
    image: string
}

type EventDashboardProps = {
    route: {
        params?: {
            eventData?: EventData
        }
    }
}

const EventDashboard = ({ route }: EventDashboardProps) => {
    const navigation = useNavigation<any>();
    const { eventData } = route.params || {};
    const [details, setDetails] = useState<any>(null);
    const [guestCounts, setGuestCounts] = useState({ total: 0, checkedIn: 0 });
    const [ticketList, setTicketList] = useState<any[]>([]);
    const [checkinData, setCheckinData] = useState<any[]>([]);





    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (eventData?.id) {
                fetchDetails(eventData.id);
                fetchGuestCounts(eventData.id);
                fetchTicketList(eventData.id);
                fetchCheckinData(eventData.id);
            }
        }, [eventData])
    );

    const fetchDetails = async (id: string) => {
        const res = await getEventDetails(id);
        if (res?.data) {
            setDetails(res.data);
        }
    };

    const fetchGuestCounts = async (id: string) => {
        try {
            // Fetch all guests to get accurate counts
            // Assuming getEventUsers returns a list of guests in res.data
            const res = await getEventUsers(id);
            if (res?.data) {
                let allGuests = res.data;

                // ⚡⚡⚡ MERGE ALL LOCAL CHECK-INS (SYNCED OR NOT) ⚡⚡⚡
                try {
                    const localCheckins = await getLocalCheckedInGuests(Number(id));
                    allGuests = allGuests.map((g: any) => {
                        const local = localCheckins.find((u: any) =>
                            (u.guest_id && u.guest_id.toString() === g.id?.toString()) ||
                            (u.qr_code && u.qr_code === g.qr_code)
                        );
                        if (local) {
                            const localUsed = local.used_entries || 0;
                            const apiUsed = g.used_entries || 0;
                            if (localUsed > apiUsed || local.status === 'checked_in') {
                                return { ...g, status: 'checked_in', used_entries: Math.max(apiUsed, localUsed) };
                            }
                        }
                        return g;
                    });
                } catch (e) {
                    console.warn("Failed to merge local counts", e);
                }

                const total = allGuests.length;
                // Check for checked_in status or used_entries > 0
                const checkedIn = allGuests.filter((g: any) =>
                    g.status === 'checked_in' || (g.used_entries && g.used_entries > 0)
                ).length;

                setGuestCounts({ total, checkedIn });
            }
        } catch (error) {
            console.log("Error fetching guest counts:", error);
        }
    };

    const fetchTicketList = async (id: string) => {
        try {
            console.log("Fetching ticket list for dashboard:", id);
            const res = await getTicketList(id);
            console.log("Ticket list dashboard response:", res);
            if (res?.data) {
                setTicketList(res.data);
            } else if (Array.isArray(res)) {
                // Handle case where API returns array directly
                setTicketList(res);
            }
        } catch (e) {
            console.error("Error fetching ticket list in dashboard:", e);
        }
    };

    const fetchCheckinData = async (id: string) => {
        try {
            const res = await getCheckinDistribution(id);
            console.log("Checkin distribution response:", res);
            if (res?.data) {
                setCheckinData(res.data);
            } else if (Array.isArray(res)) {
                setCheckinData(res);
            }
        } catch (e) {
            console.error("Error fetching checkin data:", e);
        }
    };

    const handleOpenCheckInModal = () => {
        if (!eventData?.id) return;
        navigation.navigate('CheckInRecords', { eventId: eventData.id });
    };

    // Merge params data with fetched details
    const displayData = {
        ...eventData,
        ...details,
        title: details?.title || eventData?.title,
        date: details?.start_date_display || eventData?.date,
        location: details?.address || details?.city || eventData?.location,
        image: details?.event_main_photo || eventData?.image,
    };

    if (!displayData) {
        return null;
    }

    const totalSold = ticketList.reduce(
        (acc, t) => acc + (Number(t.sold_out) || 0),
        0
    );

    // only positive values for the chart, but keep all for legend
    const chartData = ticketList
        .map((t, i) => ({
            value: Number(t.sold_out) || 0,
            color: COLORS[i % COLORS.length],
            title: t.title,
        }));

    const validPieData = chartData.filter(d => d.value > 0);

    const checkinTotal = checkinData.reduce((acc, t) => acc + (Number(t.total_check_in) || 0), 0);
    const checkinChartData = checkinData.map((t, i) => ({
        value: Number(t.total_check_in) || 0,
        color: COLORS[i % COLORS.length],
        title: t.ticket_name || t.title,
    }));
    const validCheckinPieData = checkinChartData.filter(d => d.value > 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title} numberOfLines={1}>
                    {displayData.title}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <View style={styles.eventCard}>
                    <ImageBackground
                        source={
                            displayData.image
                                ? { uri: displayData.image }
                                : require('../../assets/img/common/noimage.png')
                        }
                        style={styles.imageBackground}
                        resizeMode="cover"
                    >
                        <View style={styles.overlay}>
                            <View style={styles.eventCardContent}>
                                <Text style={styles.eventCardTitle}>{displayData.title}</Text>
                                <Text style={styles.eventCardMeta}>
                                    {displayData.date}  •  {displayData.location}
                                </Text>
                            </View>
                        </View>
                    </ImageBackground>
                </View>

                {/* Event Details Card */}
                <View style={styles.detailsCard}>
                    <View style={styles.detailRow}>
                        <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.detailIconImage} resizeMode="contain" />
                        <Text style={styles.detailText}>{details?.start_date_display || ""}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Image source={require('../../assets/img/eventdashboard/clock.png')} style={styles.detailIconImage} resizeMode="contain" />
                        <Text style={styles.detailText}>
                            {details?.start_time ? new Date(`1970-01-01T${details.start_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "7:00 PM"}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Image source={require('../../assets/img/eventdashboard/location.png')} style={styles.detailIconImage} resizeMode="contain" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.detailText}>{(details?.address || details?.city) || "-"}</Text>
                            <Text style={styles.subDetailText}>{details?.state || ""}</Text>
                        </View>
                    </View>
                    <View style={styles.detailRow}>
                        <Image source={require('../../assets/img/common/info.png')} style={styles.detailIconImage} resizeMode="contain" />
                        <Text style={styles.detailText}>{details?.category || "Event"}</Text>
                    </View>
                </View>
                <View style={styles.grid}>
                    <Grid
                        icon={require('../../assets/img/eventdashboard/guests.png')}
                        title="Guests"
                        value={guestCounts.total || displayData.total_guests || displayData.total_pax || "0"}
                        onPress={() => navigation.navigate("GuestList", { eventId: displayData.id })}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/checkin.png')}
                        title="Check-In"
                        value={displayData.totalCheckIns || guestCounts.checkedIn || displayData.checked_in_count || displayData.used_entries || "0"}
                        onPress={handleOpenCheckInModal}
                        showArrow={true}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/ticket.png')}
                        title="Tickets"
                        value={ticketList.length > 0 ? ticketList.reduce((acc, t) => acc + (t.sold_out || 0), 0).toString() : (displayData.tickets_sold || "0")}
                        onPress={() => navigation.navigate("TicketsSoldRecords", { eventId: displayData.id, tickets: ticketList })}
                        showArrow={true}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/revenue.png')}
                        title="Revenue"
                        value={displayData.ticketRevenue || (displayData.revenue ? `₹${displayData.revenue}` : "₹0")}
                    //   onPress={() => navigation.navigate("RevenueScreen")}
                    />

                    {(displayData.has_registration === 1 || displayData.has_registration === '1') && (
                        <Grid
                            icon={require('../../assets/img/eventdashboard/registration.png')}
                            title="Registration"
                            value={displayData.eventuserCount || "0"}
                            onPress={() => navigation.navigate("RegistrationDashboard", { eventId: displayData.id })}
                            showArrow={true}
                        />
                    )}
                </View>
                <TouchableOpacity style={styles.button}

                    onPress={() => navigation.navigate("ModeSelection", { eventTitle: displayData.title, eventId: displayData.id })}>

                    <Image source={require('./../../assets/img/eventdashboard/scanner.png')}
                        style={styles.scanicon} />
                    <Text style={styles.start}>Start Check-In</Text>
                </TouchableOpacity>

                <View style={styles.ticketSection}>
                    <Text style={styles.sectionTitle}>Ticket Distribution</Text>

                    <View style={styles.chartContainer}>
                        {/* Pie Chart */}
                        <View style={styles.donutWrapper}>
                            <Svg height="140" width="140" viewBox="0 0 160 160">
                                <G x="80" y="80">
                                    {validPieData.length > 0 ? (
                                        (() => {
                                            const pieData = d3
                                                .pie()
                                                .value((d: any) => d.value)
                                                .sort(null)(validPieData);

                                            const arcGenerator = d3
                                                .arc()
                                                .outerRadius(70)
                                                .innerRadius(0) // Pie chart
                                                .padAngle(0.02)
                                                .cornerRadius(4);

                                            return pieData.map((slice: any, index: number) => (
                                                <Path
                                                    key={index}
                                                    d={arcGenerator(slice as any) || undefined}
                                                    fill={slice.data.color}
                                                />
                                            ));
                                        })()
                                    ) : (
                                        // Placeholder Pie for 0 sales (Solid Gray Circle)
                                        <Circle
                                            cx="0"
                                            cy="0"
                                            r="70"
                                            fill="#F0F0F0"
                                        />
                                    )}
                                </G>
                            </Svg>
                        </View>

                        {/* Legend */}
                        <View style={styles.legendContainer}>
                            {chartData.length > 0 ? (
                                chartData.map((ticket, index) => {
                                    const percentage =
                                        totalSold > 0
                                            ? Math.round((ticket.value / totalSold) * 100)
                                            : 0;

                                    return (
                                        <View key={index} style={styles.legendItem}>
                                            <View
                                                style={[
                                                    styles.legendDot,
                                                    { backgroundColor: ticket.color },
                                                ]}
                                            />
                                            <View>
                                                <Text style={styles.legendTitle}>
                                                    {ticket.title}{' '}
                                                    <Text style={styles.legendPercent}>({percentage}%)</Text>
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyChartText}>No tickets defined</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Check-in Distribution Section */}
                <View style={styles.ticketSection}>
                    <Text style={styles.sectionTitle}>Check-in Distribution</Text>

                    <View style={styles.chartContainer}>
                        {/* Pie Chart */}
                        <View style={styles.donutWrapper}>
                            <Svg height="140" width="140" viewBox="0 0 160 160">
                                <G x="80" y="80">
                                    {validCheckinPieData.length > 0 ? (
                                        (() => {
                                            const pieData = d3
                                                .pie()
                                                .value((d: any) => d.value)
                                                .sort(null)(validCheckinPieData);

                                            const arcGenerator = d3
                                                .arc()
                                                .outerRadius(70)
                                                .innerRadius(0) // Pie chart
                                                .padAngle(0.02)
                                                .cornerRadius(4);

                                            return pieData.map((slice: any, index: number) => (
                                                <Path
                                                    key={index}
                                                    d={arcGenerator(slice as any) || undefined}
                                                    fill={slice.data.color}
                                                />
                                            ));
                                        })()
                                    ) : (
                                        <Circle
                                            cx="0"
                                            cy="0"
                                            r="70"
                                            fill="#F0F0F0"
                                        />
                                    )}
                                </G>
                            </Svg>
                        </View>

                        {/* Legend */}
                        <View style={styles.legendContainer}>
                            {checkinChartData.length > 0 ? (
                                checkinChartData.map((ticket, index) => {
                                    const percentage =
                                        checkinTotal > 0
                                            ? Math.round((ticket.value / checkinTotal) * 100)
                                            : 0;

                                    return (
                                        <View key={index} style={styles.legendItem}>
                                            <View
                                                style={[
                                                    styles.legendDot,
                                                    { backgroundColor: ticket.color },
                                                ]}
                                            />
                                            <View>
                                                <Text style={styles.legendTitle}>
                                                    {ticket.title}{' '}
                                                    <Text style={styles.legendPercent}>({percentage}%)</Text>
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyChartText}>No check-in data</Text>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView >

            <View />
        </View>
    )

}

export default EventDashboard

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        // justifyContent: 'center',
        alignContent: 'center',
        padding: scale(5),
    },
    header: {
        width: '100%',
        height: '12%',
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        position: 'relative',
    },

    title: {
        fontSize: moderateScale(20),
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: scale(12),
        color: 'black',
    },
    menuIcon: {
        width: scale(20),
        height: scale(20),
    },
    dropdown: {
        position: 'absolute',
        top: '70%',
        right: scale(20),
        backgroundColor: 'white',
        borderRadius: scale(10),
        paddingVertical: verticalScale(8),
        paddingHorizontal: scale(12),
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: scale(6),
        elevation: 4,
    },
    dropdownItem: {
        paddingVertical: verticalScale(6),
    },
    dropdownText: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    modalCard: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(24),
        gap: verticalScale(20),
    },
    modalTitle: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#111',
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    modalButtonSecondary: {
        flex: 1,
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: '#CCC',
        paddingVertical: verticalScale(12),
        alignItems: 'center',
    },
    modalSecondaryText: {
        color: '#555',
        fontWeight: '600',
    },
    modalButtonPrimary: {
        flex: 1,
        borderRadius: scale(12),
        backgroundColor: '#FF8A3C',
        paddingVertical: verticalScale(12),
        alignItems: 'center',
    },
    modalPrimaryText: {
        color: '#FFF',
        fontWeight: '700',
    },

    eventCard: {
        width: '95%',
        height: verticalScale(200),
        alignSelf: 'center',
        marginTop: verticalScale(5),
        backgroundColor: '#fff',
        borderRadius: scale(20),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EDEDED',
    },

    imageBackground: {
        width: '100%',
        height: '100%',
        justifyContent: 'flex-end',
    },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
    },

    eventCardContent: {
        padding: scale(20),
    },

    eventCardTitle: {
        fontSize: moderateScale(22),
        fontWeight: '700',
        color: '#FFFFFF',
    },

    eventCardMeta: {
        fontSize: moderateScale(14),
        color: '#E0E0E0',
        marginTop: verticalScale(5),
        fontWeight: '500',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: 'white',
        width: '90%',
        alignSelf: 'center',
        justifyContent: 'space-between',
        // paddingLeft: 2, // Removing this as it offsets center
        gap: scale(12),
        marginTop: verticalScale(15),
        marginBottom: verticalScale(20)
    },
    // rowone removed
    button: {
        height: verticalScale(50), // Fixed height often better than %
        width: '90%',
        backgroundColor: '#FF8A3C',
        alignSelf: "center",
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: scale(10),
        flexDirection: 'row',
        gap: scale(10),
        marginBottom: verticalScale(20), // ensure space at bottom
    },
    scanicon: {
        height: scale(25),
        width: scale(25),
        // padding:10,
    },
    start: {
        color: 'white',
        fontWeight: '500',
        fontSize: moderateScale(15),
    },
    ticketSection: {
        width: '90%',
        alignSelf: 'center',
        marginTop: verticalScale(20),
        backgroundColor: 'white',
        borderRadius: scale(20),
        padding: scale(20),
        borderWidth: 1,
        borderColor: '#EDEDED',
    },
    sectionTitle: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#111',
        marginBottom: verticalScale(20),
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    donutWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    legendContainer: {
        flex: 1,
        marginLeft: scale(20),
        gap: verticalScale(12),
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: scale(12),
        height: scale(12),
        borderRadius: scale(6),
        marginRight: scale(10),
    },
    legendTitle: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '500',
    },
    legendPercent: {
        color: '#666',
        fontWeight: '400',
    },
    emptyChartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: verticalScale(100),
    },
    emptyChartText: {
        color: '#999',
        fontSize: moderateScale(14),
        fontStyle: 'italic',
    },
    detailsCard: {
        width: '95%',
        alignSelf: 'center',
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(20),
        marginTop: verticalScale(15),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(1) },
        shadowOpacity: 0.1,
        // shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        gap: verticalScale(12),
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(12),
    },
    detailIconImage: {
        width: scale(20),
        height: scale(20),
        marginTop: verticalScale(2),
    },
    detailText: {
        fontSize: moderateScale(15),
        color: '#333',
        fontWeight: '500',
        flex: 1,
        lineHeight: moderateScale(22),
    },
    subDetailText: {
        fontSize: moderateScale(13),
        color: '#888',
        marginTop: verticalScale(2),
    },
})