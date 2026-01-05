import { StyleSheet, Text, View, Image, TouchableOpacity, ImageBackground, ScrollView, Animated, Easing, Modal, BackHandler, useWindowDimensions, FlatList } from 'react-native'
import { FontSize } from '../../constants/fontSizes';
import { useScale } from '../../utils/useScale';
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Grid from '../../components/Grid';
import { getEventUsers, getEventDetails, getTicketList, getCheckinDistribution } from '../../api/event';
import { getUnsyncedCheckins, getLocalCheckedInGuests } from '../../db';
import BackButton from '../../components/BackButton';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import * as d3 from 'd3-shape';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
// import GuestRegistrationModal from './GuestRegistrationModal'; // Removed


const COLORS = ['#FFF5C4', '#FFD180', '#FFAB40', '#FF6D00', '#D50000', '#8E0000', '#5D0000'];

type EventData = {
    id: string
    title: string
    date: string
    location: string
    image: string
}

type EventDashboardContentProps = {
    eventData?: EventData
    userRole?: string
    eventId?: string
    isSplitView?: boolean
}

export const EventDashboardContent = ({ eventData, userRole, eventId, isSplitView = false }: EventDashboardContentProps) => {
    const navigation = useNavigation<any>();

    // Resolve ID
    const targetId = eventId || eventData?.id;

    const [details, setDetails] = useState<any>(null);
    const [guestCounts, setGuestCounts] = useState({ total: 0, checkedIn: 0 });
    const [ticketList, setTicketList] = useState<any[]>([]);
    const [checkinData, setCheckinData] = useState<any[]>([]);

    const { width, height: screenHeight } = useWindowDimensions();
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

    // Responsive Logic
    const isFoldable = width >= 600;

    // Grid Columns Logic:
    // Phone: 2
    // Split View (Foldable Right Panel): 2 (User requested 1 or 2 per row to fix messiness)
    // Full Foldable (Tablet Mode): 3
    const numColumns = isSplitView ? 2 : (isFoldable ? 3 : 2);

    const gridGap = scale(12);

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

    // Handle Hardware Back Button - ONLY if NOT in split view
    useFocusEffect(
        useCallback(() => {
            if (isSplitView) return; // Let parent handle back press in split view

            const onBackPress = () => {
                setExitModalVisible(true);
                return true; // Stop default behavior
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () =>
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        }, [isSplitView])
    );

    useEffect(() => {
        if (targetId) {
            fetchDetails(targetId);
            fetchTicketList(targetId);
            fetchCheckinData(targetId);
        }
    }, [targetId]);

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
        if (!targetId) return;
        navigation.navigate('CheckInRecords', { eventId: targetId });
    };

    // Merge params data with fetched details
    // If no targetId, we can't display much, but we handle nulls
    const displayData = {
        ...eventData,
        ...details,
        id: targetId,
        title: details?.title || eventData?.title,
        date: details?.start_date_display || eventData?.date,
        location: details?.address || details?.city || eventData?.location,
        image: details?.event_main_photo || eventData?.image,
    };

    if (!targetId) {
        // Placeholder state if no event selected (mostly for Split View)
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: moderateScale(FontSize.md), color: '#999' }}>Select an event to view details</Text>
            </View>
        );
    }

    // Safety check if we have ID but waiting for data
    if (!displayData.title && !details) {
        // Loading or minimalistic state could go here, but return null for now as per original
        // Actually original returned null if !displayData. But displayData is object created above.
        // Effectively check if we have minimal info.
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

    const gridItems: any[] = [
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

    gridItems.push({
        icon: require('../../assets/img/eventdashboard/revenue.png'), // Reusing revenue icon as placeholder
        title: "Settlement",
        value: "Coming Soon",
        disabled: true
    });

    const isOddGrid = gridItems.length % 2 !== 0;

    const renderHeader = () => (
        <>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {/* Hide Back Button in Split View */}
                    {!isSplitView && <BackButton onPress={() => setExitModalVisible(true)} />}
                </View>

                <Text style={styles.title} numberOfLines={1}>
                    {displayData.title}
                </Text>

                <View style={styles.headerRight}>
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
            </View>

            <View style={[
                styles.eventCard,
                // Only center/shrink on Full Foldable view, not split view (which is already narrow)
                isFoldable && !isSplitView && { width: '80%', alignSelf: 'center' }
            ]}>
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
                            <Text style={styles.eventCardTitle} numberOfLines={2}>{displayData.title}</Text>
                            <Text style={styles.eventCardMeta} numberOfLines={1}>
                                {displayData.date}  •  {displayData.location}
                            </Text>
                        </View>
                    </View>
                </ImageBackground>
            </View>

            <View style={[
                styles.detailsCard,
                isFoldable && !isSplitView && { width: '90%', alignSelf: 'center' },
                // Split View Optimization
                isSplitView && { padding: moderateScale(12), marginBottom: verticalScale(16) }
            ]}>
                {(() => {
                    const topArray = details?.event_top_array || [];
                    const dateItem = topArray.find((i: any) => i.type === 'date');
                    const locationItem = topArray.find((i: any) => i.type === 'hotel');

                    const displayDate = dateItem?.title || displayData.date || "";

                    const formattedStartTime = details?.start_time
                        ? new Date(`1970-01-01T${details.start_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                        : "";
                    const displayTime = dateItem?.desc || formattedStartTime || "";

                    const displayAddress = locationItem?.title || displayData.location || "";
                    const displayState = locationItem?.desc || details?.state || (eventData as any)?.state || "";

                    return (
                        <>
                            <View style={[styles.detailRow, isSplitView && { marginBottom: verticalScale(10) }]}>
                                <Image source={require('../../assets/img/eventdashboard/calendar.png')} style={styles.detailIconImage} resizeMode="contain" />
                                <Text style={styles.detailText}>{displayDate}</Text>
                            </View>
                            <View style={[styles.detailRow, isSplitView && { marginBottom: verticalScale(10) }]}>
                                <Image source={require('../../assets/img/eventdashboard/clock.png')} style={styles.detailIconImage} resizeMode="contain" />
                                <Text style={styles.detailText}>{displayTime}</Text>
                            </View>
                            <View style={[styles.detailRow, isSplitView && { marginBottom: verticalScale(10) }]}>
                                <Image source={require('../../assets/img/eventdashboard/location.png')} style={styles.detailIconImage} resizeMode="contain" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.detailText}>{displayAddress}</Text>
                                    {!!displayState && <Text style={styles.subDetailText}>{displayState}</Text>}
                                </View>
                            </View>
                            <View style={[styles.detailRow, isSplitView && { marginBottom: verticalScale(10) }]}>
                                <Image source={require('../../assets/img/common/info.png')} style={styles.detailIconImage} resizeMode="contain" />
                                <Text style={styles.detailText}>{details?.category || (eventData as any)?.category || (displayData as any).category || ""}</Text>
                            </View>
                        </>
                    );
                })()}
            </View>
        </>
    );

    const renderFooter = () => (
        <View style={[
            styles.footerContainer,
            isSplitView && { flexDirection: 'column', gap: 0 } // Stack buttons in split view
        ]}>
            <TouchableOpacity style={[
                styles.button,
                isFoldable && !isSplitView && { width: '48%' }, // Full Foldable width
                isSplitView && { width: '100%', borderRadius: moderateScale(12) } // Split view full width
            ]}
                onPress={() => navigation.navigate("ModeSelection", { eventTitle: displayData.title, eventId: displayData.id })}>
                <Image source={require('./../../assets/img/eventdashboard/scanner.png')}
                    style={styles.scanicon} />
                <Text style={styles.start}>Start Check-In</Text>
            </TouchableOpacity>

            {userRole === 'manager' && (
                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.secondaryButton,
                        isFoldable && !isSplitView && { width: '48%' },
                        isSplitView && { width: '100%', marginTop: verticalScale(12), borderRadius: moderateScale(12) }
                    ]}
                    onPress={() => navigation.navigate("GuestRegistration", { eventId: displayData.id })}
                >
                    <Image source={require('../../assets/img/eventdashboard/registration.png')}
                        style={[styles.scanicon, { tintColor: '#FF8A3C' }]} />
                    <Text style={[styles.start, { color: '#FF8A3C' }]}>Register a Guest</Text>
                </TouchableOpacity>
            )}

            {(userRole !== 'manager') && (
                <>
                    <View style={[
                        styles.ticketSection,
                        isFoldable && {
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            gap: scale(16)
                        },
                        isSplitView && { flexDirection: 'column', gap: verticalScale(16) } // Stack charts in split view
                    ]}>

                        <View style={isFoldable && !isSplitView ? { width: '48%' } : { width: '100%' }}>
                            <Text style={styles.sectionTitle}>Ticket Distribution</Text>

                            <View style={styles.chartContainer}>
                                <View style={styles.donutWrapper}>
                                    <Svg height={moderateScale(120)} width={moderateScale(120)} viewBox="0 0 160 160">
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
                                                })()
                                            ) : (
                                                <Circle cx="0" cy="0" r="70" fill="#F0F0F0" />
                                            )}
                                        </G>
                                    </Svg>
                                </View>
                                <View style={styles.legendContainer}>
                                    {chartData.length > 0 ? (
                                        chartData.map((ticket, index) => {
                                            const percentage = totalSold > 0 ? Math.round((ticket.value / totalSold) * 100) : 0;
                                            return (
                                                <View key={index} style={styles.legendItem}>
                                                    <View style={[styles.legendDot, { backgroundColor: ticket.color }]} />
                                                    <View>
                                                        <Text style={styles.legendTitle}>
                                                            {ticket.title} <Text style={styles.legendPercent}>({percentage}%)</Text>
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

                        <View style={[
                            isFoldable && !isSplitView ? { width: '48%' } : { width: '100%' },
                            !isFoldable && { marginTop: verticalScale(20) } // Phone margin
                        ]}>
                            <Text style={styles.sectionTitle}>Check-in Distribution</Text>

                            <View style={styles.chartContainer}>
                                <View style={styles.donutWrapper}>
                                    <Svg height={moderateScale(120)} width={moderateScale(120)} viewBox="0 0 160 160">
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
                                                })()
                                            ) : (
                                                <Circle cx="0" cy="0" r="70" fill="#F0F0F0" />
                                            )}
                                        </G>
                                    </Svg>
                                </View>
                                <View style={styles.legendContainer}>
                                    {checkinChartData.length > 0 ? (
                                        checkinChartData.map((ticket, index) => {
                                            const percentage = checkinTotal > 0 ? Math.round((ticket.value / checkinTotal) * 100) : 0;
                                            return (
                                                <View key={index} style={styles.legendItem}>
                                                    <View style={[styles.legendDot, { backgroundColor: ticket.color }]} />
                                                    <View>
                                                        <Text style={styles.legendTitle}>
                                                            {ticket.title} <Text style={styles.legendPercent}>({percentage}%)</Text>
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

                    </View>
                </>
            )}
        </View>
    );

    const renderGridItem = ({ item }: { item: any }) => (
        <View style={[styles.gridItemWrapper, { flex: 1, maxWidth: `${100 / numColumns}%` }]}>
            <Grid {...item} />
        </View>
    );

    return (
        <ResponsiveContainer maxWidth={isFoldable ? "100%" : 420}>
            <View style={styles.container}>
                {/* Modal must be outside FlatList for z-index/position correctness if absolute, or just inside View */}
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

                <FlatList
                    key={`dashboard-grid-${numColumns}`}
                    data={userRole !== 'manager' ? gridItems : []}
                    keyExtractor={(item) => item.title}
                    renderItem={renderGridItem}
                    numColumns={numColumns}
                    columnWrapperStyle={[styles.columnWrapper, { gap: gridGap }]}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </ResponsiveContainer>
    )

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
    const { eventData, userRole } = route.params || {};
    return <EventDashboardContent eventData={eventData} eventId={eventData?.id} userRole={userRole} />
}

export default EventDashboard

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, width: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(5),
        paddingVertical: verticalScale(12),
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        zIndex: 10,
    },
    headerLeft: {
        width: scale(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerRight: {
        width: scale(40),
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: scale(12),
        color: '#333',
    },
    settingsButton: {
        width: moderateScale(40),
        height: moderateScale(40),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: moderateScale(20),
    },
    settingsIcon: {
        width: moderateScale(24),
        height: moderateScale(24),
        resizeMode: 'contain',
        tintColor: '#333',
    },
    menuIcon: {
        width: scale(20),
        height: scale(20),
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
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: moderateScale(20),
        padding: moderateScale(24),
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: verticalScale(2) },
        shadowRadius: scale(8),
    },
    modalTitle: {
        fontSize: moderateScale(FontSize.xl),
        fontWeight: '700',
        color: '#111111',
        marginBottom: verticalScale(12),
        textAlign: 'center',
    },
    modalSecondaryText: {
        fontSize: moderateScale(FontSize.md),
        color: '#6F6F6F',
        fontWeight: '600',
    },
    modalPrimaryText: {
        fontSize: moderateScale(FontSize.md),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    modalSecondaryTextBtn: {
        fontSize: moderateScale(FontSize.md),
        color: '#6F6F6F',
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginTop: verticalScale(20),
    },
    modalButtonSecondary: {
        flex: 1,
        marginRight: scale(6),
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(12),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    modalButtonPrimary: {
        flex: 1,
        marginLeft: scale(6),
        paddingVertical: verticalScale(12),
        borderRadius: moderateScale(12),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF8A3C',
    },
    listContent: {
        paddingBottom: verticalScale(100),
        paddingTop: verticalScale(16),
        paddingHorizontal: moderateScale(20),
    },
    eventCard: {
        width: '100%',
        aspectRatio: 1.8,
        minHeight: verticalScale(180),
        backgroundColor: '#fff',
        borderRadius: moderateScale(20),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EDEDED',
        marginBottom: verticalScale(20),
        marginTop: verticalScale(20),
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
        padding: moderateScale(20),
    },
    eventCardTitle: {
        fontSize: moderateScale(FontSize.xxl),
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: verticalScale(6),
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    eventCardMeta: {
        fontSize: moderateScale(FontSize.sm),
        color: '#F0F0F0',
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    detailText: {
        fontSize: moderateScale(FontSize.md),
        color: '#333',
        flex: 1,
        lineHeight: moderateScale(22),
        fontWeight: '500',
    },
    subDetailText: {
        fontSize: moderateScale(FontSize.sm),
        color: '#777',
        marginTop: verticalScale(2),
    },
    detailsCard: {
        backgroundColor: '#FAFAFA',
        borderRadius: moderateScale(16),
        padding: moderateScale(16),
        marginBottom: verticalScale(24),
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(14),
    },
    detailIconImage: {
        width: moderateScale(22),
        height: moderateScale(22),
        tintColor: '#FF8A3C',
        marginRight: scale(12)
    },
    columnWrapper: {
        // justifyContent: 'space-between', // Handled by gap
        marginBottom: verticalScale(12),
    },
    gridItemWrapper: {
        // width: '48%', // Handled dynamically
        // marginBottom: verticalScale(10), // handled by gap/row wrapper
    },
    footerContainer: {
        marginTop: verticalScale(10),
        paddingBottom: verticalScale(20),
        flexDirection: width >= 600 ? 'row' : 'column',
        flexWrap: width >= 600 ? 'wrap' : 'nowrap',
        justifyContent: width >= 600 ? 'center' : 'flex-start',
        gap: width >= 600 ? scale(16) : 0,
    },
    button: {
        height: verticalScale(52),
        width: '100%',
        backgroundColor: '#FF8A3C',
        alignSelf: "center",
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: moderateScale(14),
        flexDirection: 'row',
        marginBottom: verticalScale(16),
        elevation: 2,
        shadowColor: '#FF8A3C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    secondaryButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FF8A3C',
        elevation: 0,
        shadowOpacity: 0,
    },
    scanicon: {
        height: moderateScale(20),
        width: moderateScale(20),
        resizeMode: 'contain',
        marginRight: scale(10),
    },
    start: {
        color: 'white',
        fontWeight: '700',
        fontSize: moderateScale(FontSize.md),
    },
    ticketSection: {
        width: '100%',
        marginTop: verticalScale(8),
        marginBottom: verticalScale(16),
        backgroundColor: 'white',
        borderRadius: moderateScale(16),
        padding: moderateScale(16),
        borderWidth: 1,
        borderColor: '#EDEDED',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    sectionTitle: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '700',
        color: '#222',
        marginBottom: verticalScale(16),
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    donutWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: moderateScale(12),
    },
    legendContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: verticalScale(8),
    },
    legendDot: {
        width: moderateScale(10),
        height: moderateScale(10),
        borderRadius: moderateScale(5),
        marginRight: scale(8),
    },
    legendTitle: {
        fontSize: moderateScale(FontSize.sm),
        color: '#444',
        fontWeight: '500',
    },
    legendPercent: {
        color: '#888',
        fontWeight: '400',
        fontSize: moderateScale(FontSize.xs),
    },
    emptyChartText: {
        fontSize: moderateScale(FontSize.sm),
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: verticalScale(10),
    }
});