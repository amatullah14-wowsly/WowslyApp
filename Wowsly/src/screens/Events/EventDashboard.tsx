import { StyleSheet, Text, View, Image, TouchableOpacity, ImageBackground, ScrollView, Animated, Easing, Modal, BackHandler } from 'react-native'
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
            userRole?: string
        }
    }
}

const EventDashboard = ({ route }: EventDashboardProps) => {
    const navigation = useNavigation<any>();
    const { eventData, userRole } = route.params || {};
    const [details, setDetails] = useState<any>(null);
    const [guestCounts, setGuestCounts] = useState({ total: 0, checkedIn: 0 });
    const [ticketList, setTicketList] = useState<any[]>([]);
    const [checkinData, setCheckinData] = useState<any[]>([]);

    // Animation value for settings button
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    // Exit Modal State
    const [exitModalVisible, setExitModalVisible] = useState(false);

    const onSettingsPressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
        }).start();
    };

    const onSettingsPressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    // Handle Hardware Back Button
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                setExitModalVisible(true);
                return true; // Stop default behavior
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () =>
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            if (eventData?.id) {
                fetchDetails(eventData.id);
                fetchTicketList(eventData.id);
                fetchCheckinData(eventData.id);
            }
        }, [eventData])
    );

    const fetchDetails = async (id: string) => {
        try {
            console.log(`Fetching details for event ID: ${id}`);
            const res = await getEventDetails(id);
            console.log("Event details response:", res); // Check if event_top_array is present
            if (res?.data) {
                setDetails(res.data);
            }
        } catch (e) {
            console.error("Error fetching event details:", e);
        }
    };

    // ... (other fetch functions)



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

    const gridItems = [
        {
            icon: require('../../assets/img/eventdashboard/guests.png'),
            title: "Guests",
            value: details?.eventuserCount ?? "0",
            onPress: () => navigation.navigate("GuestList", { eventId: displayData.id })
        },
        {
            icon: require('../../assets/img/eventdashboard/checkin.png'),
            title: "Check-In",
            value: String(details?.totalCheckIns ?? 0),
            onPress: handleOpenCheckInModal,
            showArrow: true
        },
        {
            icon: require('../../assets/img/eventdashboard/ticket.png'),
            title: "Tickets",
            value: details?.totalBooked ?? "0",
            onPress: () => navigation.navigate("TicketsSoldRecords", { eventId: displayData.id, tickets: ticketList }),
            showArrow: true
        },
        {
            icon: require('../../assets/img/eventdashboard/revenue.png'),
            title: "Revenue",
            value: details?.ticketRevenue ?? (displayData.revenue ? `₹${displayData.revenue}` : "₹0")
        },
        {
            icon: require('../../assets/img/eventdashboard/revenue.png'), // Reusing revenue icon as placeholder
            title: "Settlement",
            value: "0",
            disabled: true
        }
    ];

    if (
        details?.has_registration === 1 ||
        details?.has_registration === '1' ||
        details?.has_registration === true
    ) {
        gridItems.push({
            icon: require('../../assets/img/eventdashboard/registration.png'),
            title: "Registration",
            value: details?.eventuserCount ?? "0",
            onPress: () => navigation.navigate("RegistrationDashboard", { eventId: displayData.id }),
            showArrow: true
        });
    }

    const isOddGrid = gridItems.length % 2 !== 0;

    return (
        <View style={styles.container}>

            <View style={styles.header}>
                <BackButton onPress={() => setExitModalVisible(true)} />
                <Text style={styles.title} numberOfLines={1}>
                    {displayData.title}
                </Text>

                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPressIn={onSettingsPressIn}
                        onPressOut={onSettingsPressOut}
                        onPress={() => {
                            setTimeout(() => navigation.navigate('Settings', { eventData: displayData }), 50);
                        }}
                        style={styles.settingsButton}
                    >
                        <Image
                            source={require('../../assets/img/eventdashboard/setting.png')}
                            style={styles.settingsIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Exit Confirmation Modal */}
            <Modal
                transparent
                visible={exitModalVisible}
                animationType="fade"
                onRequestClose={() => setExitModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Exit Event</Text>
                        <Text style={[styles.modalSecondaryText, { textAlign: 'center', marginBottom: verticalScale(20), fontSize: moderateScale(15) }]}>
                            Are you sure you want to exit this event?
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButtonSecondary}
                                onPress={() => setExitModalVisible(false)}
                            >
                                <Text style={styles.modalSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalButtonPrimary}
                                onPress={() => {
                                    setExitModalVisible(false);
                                    navigation.goBack();
                                }}
                            >
                                <Text style={styles.modalPrimaryText}>Exit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                    {(() => {
                        // Helper to find items in event_top_array
                        const topArray = details?.event_top_array || [];
                        const dateItem = topArray.find((i: any) => i.type === 'date');
                        const locationItem = topArray.find((i: any) => i.type === 'hotel');

                        // Prioritize Top Array -> Details -> DisplayData (Params)
                        // Note: displayData.date already falls back to eventData.date
                        const displayDate = dateItem?.title || displayData.date || "";

                        // Time: Top App Desc -> Formatted Start Time -> Empty
                        const formattedStartTime = details?.start_time
                            ? new Date(`1970-01-01T${details.start_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                            : "";
                        const displayTime = dateItem?.desc || formattedStartTime || "";

                        // Location: Top Arr Title -> Details Address -> DisplayData Location
                        const displayAddress = locationItem?.title || displayData.location || "";

                        // State: Top Arr Desc -> Details State -> EventData State
                        const displayState = locationItem?.desc || details?.state || (eventData as any)?.state || "";

                        return (
                            <>
                                <View style={styles.detailRow}>
                                    <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.detailIconImage} resizeMode="contain" />
                                    <Text style={styles.detailText}>{displayDate}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Image source={require('../../assets/img/eventdashboard/clock.png')} style={styles.detailIconImage} resizeMode="contain" />
                                    <Text style={styles.detailText}>{displayTime}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Image source={require('../../assets/img/eventdashboard/location.png')} style={styles.detailIconImage} resizeMode="contain" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailText}>{displayAddress}</Text>
                                        {!!displayState && <Text style={styles.subDetailText}>{displayState}</Text>}
                                    </View>
                                </View>
                                <View style={styles.detailRow}>
                                    <Image source={require('../../assets/img/common/info.png')} style={styles.detailIconImage} resizeMode="contain" />
                                    <Text style={styles.detailText}>{details?.category || (eventData as any)?.category || (displayData as any).category || ""}</Text>
                                </View>
                            </>
                        );
                    })()}
                </View>
                {(userRole !== 'manager') && (
                    <>
                        {isOddGrid ? (
                            <>
                                <View style={styles.grid}>
                                    {gridItems.slice(0, gridItems.length - 1).map((item, index) => (
                                        <Grid key={index} {...item} />
                                    ))}
                                </View>
                                {/* Render last item centered in a new row */}
                                <View style={[styles.grid, { marginTop: verticalScale(12), justifyContent: 'center', marginBottom: verticalScale(20) }]}>
                                    <Grid {...gridItems[gridItems.length - 1]} />
                                </View>
                            </>
                        ) : (
                            <View style={styles.grid}>
                                {gridItems.map((item, index) => (
                                    <Grid key={index} {...item} />
                                ))}
                            </View>
                        )}
                    </>
                )}
                <TouchableOpacity style={styles.button}

                    onPress={() => navigation.navigate("ModeSelection", { eventTitle: displayData.title, eventId: displayData.id })}>

                    <Image source={require('./../../assets/img/eventdashboard/scanner.png')}
                        style={styles.scanicon} />
                    <Text style={styles.start}>Start Check-In</Text>
                </TouchableOpacity>

                {(userRole !== 'manager') && (
                    <>
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
                    </>
                )}
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
        // height: '12%', // Removed percentage height
        paddingVertical: scale(15), // Added padding for dynamic height
        backgroundColor: 'white',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        // position: 'relative', // unnecessary
    },

    title: {
        fontSize: moderateScale(20),
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: scale(12),
        color: 'black',
    },
    settingsButton: {
        padding: scale(8),
    },
    settingsIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: '#000000',
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
        shadowOffset: { width: 0, height: 4 },
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
    // Modal Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(20),
        padding: scale(24),
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowRadius: scale(8),
    },
    modalTitle: {
        fontSize: moderateScale(20),
        fontWeight: '700',
        color: '#111111',
        marginBottom: verticalScale(12),
        textAlign: 'center',
    },
    modalSecondaryText: {
        fontSize: moderateScale(16),
        color: '#6F6F6F',
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        gap: scale(12),
        width: '100%',
    },
    modalButtonSecondary: {
        flex: 1,
        paddingVertical: verticalScale(14),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    modalButtonPrimary: {
        flex: 1,
        paddingVertical: verticalScale(14),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF8A3C',
    },
    modalPrimaryText: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#FFFFFF',
    },

    eventCard: {
        width: '95%',
        height: 200, // Fixed height instead of verticalScale(200)
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
        height: 50, // Fixed height instead of verticalScale(50)
        width: '90%',
        backgroundColor: '#FF8A3C',
        alignSelf: "center",
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: scale(10),
        flexDirection: 'row',
        gap: scale(10),
        marginTop: verticalScale(20), // ensure space at bottom
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
        height: 100,
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
        shadowOffset: { width: 0, height: 1 },
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