import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native';
import Grid from '../../components/Grid';
import { getEventDetails } from '../../api/event';

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

    useEffect(() => {
        if (eventData?.id) {
            fetchDetails(eventData.id);
        }
    }, [eventData]);

    const fetchDetails = async (id: string) => {
        const res = await getEventDetails(id);
        if (res?.data) {
            setDetails(res.data);
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Image
                        source={require('../../assets/img/common/back.png')}
                        style={styles.back}
                    />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>
                    {displayData.title}
                </Text>
            </View>
            <View style={styles.eventCard}>
            <Image 
  source={
    displayData.image
      ? { uri: displayData.image }
      : require('../../assets/img/common/noimage.png')  // <-- add a placeholder
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
                        value="852"
                        onPress={() => navigation.navigate("GuestList")}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/checkin.png')}
                        title="Check-In"
                        value="671"
                    />
                </View>

                <View style={styles.rowone}>
                    <Grid
                        icon={require('../../assets/img/eventdashboard/ticket.png')}
                        title="Tickets"
                        value="1000"
                    //   onPress={() => navigation.navigate("TicketsScreen")}
                    />

                    <Grid
                        icon={require('../../assets/img/eventdashboard/revenue.png')}
                        title="Revenue"
                        value="$50k"
                    //   onPress={() => navigation.navigate("RevenueScreen")}
                    />
                </View>
            </View>
            <TouchableOpacity style={styles.button}

                onPress={() => navigation.navigate("ModeSelection", { eventTitle: displayData.title })}>
                <Image source={require('./../../assets/img/eventdashboard/scanner.png')}
                    style={styles.scanicon} />
                <Text style={styles.start}>Start Check-In</Text>
            </TouchableOpacity>
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
    back: {
        width: 20,
        height: 30,
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
        fontSize: 20,
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
})