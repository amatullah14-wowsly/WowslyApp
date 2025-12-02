import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Grid from '../../components/Grid';
import { getEventDetails, getEventUsers, getTicketList } from '../../api/event';
import BackButton from '../../components/BackButton';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import * as d3 from 'd3-shape';

const COLORS = ['#FF8A3C', '#FFA06D', '#FFB58A', '#FFCAAB', '#FFE0CC'];

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

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (eventData?.id) {
                fetchDetails(eventData.id);
                fetchGuestCounts(eventData.id);
                fetchTicketList(eventData.id);
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
                const allGuests = res.data;
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

    // only positive values
    const chartData = ticketList
        .map((t, i) => ({
            value: Number(t.sold_out) || 0,
            color: COLORS[i % COLORS.length],
            title: t.title,
        }))
        .filter(d => d.value > 0);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title} numberOfLines={1}>
                    {displayData.title}
                </Text>
            </View>
            <View style={styles.eventCard}>
                <Image
                    source={
                        displayData.image
                            ? { uri: displayData.image }
                            : require('../../assets/img/common/noimage.png')
                    }
                    style={styles.eventImage}
                />

                <View style={styles.eventCardContent}>
                    <Text style={styles.eventCardTitle}>{displayData.title}</Text>
                    <Text style={styles.eventCardMeta}>
                        {displayData.date}  •  {displayData.location}
                    </Text>
                </View>
            </View>
            <View style={styles.grid}>
                <View style={styles.rowone}>
                    <Grid
                        icon={require('../../assets/img/eventdashboard/guests.png')}
                        title="Guests"
                        value={guestCounts.total || displayData.total_guests || displayData.total_pax || "0"}
                        onPress={() => navigation.navigate("GuestList", { eventId: displayData.id })}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/checkin.png')}
                        title="Check-In"
                        value={guestCounts.checkedIn || displayData.checked_in_count || displayData.used_entries || "0"}
                    />
                </View>

                <View style={styles.rowone}>
                    <Grid
                        icon={require('../../assets/img/eventdashboard/ticket.png')}
                        title="Tickets"
                        value={ticketList.length > 0 ? ticketList.reduce((acc, t) => acc + (t.sold_out || 0), 0).toString() : (displayData.tickets_sold || "0")}
                    //   onPress={() => navigation.navigate("TicketsScreen")}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/revenue.png')}
                        title="Revenue"
                        value={displayData.revenue ? `₹${displayData.revenue}` : "₹0"}
                    //   onPress={() => navigation.navigate("RevenueScreen")}
                    />
                </View>
            </View>
            <TouchableOpacity style={styles.button}

                onPress={() => navigation.navigate("ModeSelection", { eventTitle: displayData.title, eventId: displayData.id })}>

                <Image source={require('./../../assets/img/eventdashboard/scanner.png')}
                    style={styles.scanicon} />
                <Text style={styles.start}>Start Check-In</Text>
            </TouchableOpacity>

            {chartData.length > 0 && totalSold > 0 && (
                <View style={styles.ticketSection}>
                    <Text style={styles.sectionTitle}>Ticket Distribution</Text>

                    <View style={styles.chartContainer}>
                        {/* Donut Chart */}
                        <View style={styles.donutWrapper}>
                            <Svg height="140" width="140" viewBox="0 0 160 160">
                                {/* background ring */}
                                <G x="80" y="80">
                                    {(() => {
                                        console.log("Chart Data:", JSON.stringify(chartData));

                                        const pieData = d3
                                            .pie()
                                            .value((d: any) => d.value)
                                            .sort(null)(chartData);

                                        console.log("Pie Data:", JSON.stringify(pieData));

                                        const arcGenerator = d3
                                            .arc()
                                            .outerRadius(70)
                                            .innerRadius(0)
                                            .padAngle(0.02)
                                            .cornerRadius(4);

                                        return pieData.map((slice: any, index: number) => (
                                            <Path
                                                key={index}
                                                d={arcGenerator(slice as any) || undefined}
                                                fill={slice.data.color}
                                            />
                                        ));
                                    })()}
                                </G>
                            </Svg>
                        </View>

                        {/* Legend */}
                        <View style={styles.legendContainer}>
                            {chartData.map((ticket, index) => {
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
                            })}
                        </View>
                    </View>
                </View>
            )}
            <View style={{ height: 20 }} />
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
        padding: 5,
    },
    header: {
        width: '100%',
        height: '12%',
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        position: 'relative',
    },

    title: {
        fontSize: 20,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: 12,
    },
    menuIcon: {
        width: 20,
        height: 20,
    },
    dropdown: {
        position: 'absolute',
        top: '70%',
        right: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 4,
    },
    dropdownItem: {
        paddingVertical: 6,
    },
    dropdownText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        gap: 20,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButtonSecondary: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CCC',
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalSecondaryText: {
        color: '#555',
        fontWeight: '600',
    },
    modalButtonPrimary: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#FF8A3C',
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalPrimaryText: {
        color: '#FFF',
        fontWeight: '700',
    },

    eventCard: {
        width: '95%',
        alignSelf: 'center',
        marginTop: 5,
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        // shadowColor: '#000',
        // shadowOpacity: 0.1,
        // shadowOffset: { width: 0, height: 4 },
        // shadowRadius: 8,
        // elevation: 5,
        borderWidth: 1,
        borderColor: '#EDEDED',
    },

    eventImage: {
        width: '100%',
        height: 120,
    },

    eventCardContent: {
        padding: 15,
    },

    eventCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
    },

    eventCardMeta: {
        fontSize: 14,
        color: '#6F6F6F',
        marginTop: 5,
    },
    grid: {
        // flex:1,
        flexDirection: 'column',
        backgroundColor: 'white',
        height: '20%',
        width: '90%',
        alignSelf: 'center',
        // justifyContent:'center',
        // alignItems:'center',
        paddingLeft: 2,
        gap: 12,
        marginTop: 15,
    },
    rowone: {
        flexDirection: 'row',
        gap: 20,
    },
    button: {
        height: '7%',
        width: '90%',
        backgroundColor: '#FF8A3C',
        alignSelf: "center",
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        marginTop: 30,
        flexDirection: 'row',
        gap: 10,
    },
    scanicon: {
        height: 25,
        width: 25,
        // padding:10,
    },
    start: {
        color: 'white',
        fontWeight: '500',
        fontSize: 15,
    },
    ticketSection: {
        width: '90%',
        alignSelf: 'center',
        marginTop: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#EDEDED',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
        marginBottom: 20,
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
        marginLeft: 20,
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    legendTitle: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    legendPercent: {
        color: '#666',
        fontWeight: '400',
    },
})