import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    Image,
    LayoutAnimation,
    Platform,
    UIManager,
    SafeAreaView,
    Animated
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import { getTicketSoldUsers } from '../../api/event';

if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SoldUser = {
    name: string;
    mobile: string;
    tickets_bought: number;
    invited_by: string | null;
    registered_by: string | null;
    created_at: string;
    dialing_code?: string | number;
};

type TicketType = {
    id: string | number;
    title: string;
    type?: string;
    sold_out: number | string;
};

const TicketsSoldRecords = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, tickets } = route.params || {};

    const [expandedTicketId, setExpandedTicketId] = useState<string | number | null>(null);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [soldDataCache, setSoldDataCache] = useState<Record<string, SoldUser[]>>({});

    const toggleExpand = async (ticket: TicketType) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        if (expandedTicketId === ticket.id) {
            setExpandedTicketId(null);
            return;
        }

        setExpandedTicketId(ticket.id);

        if (!soldDataCache[ticket.id]) {
            fetchSoldUsers(ticket);
        }
    };

    const fetchSoldUsers = async (ticket: TicketType) => {
        setLoadingUsers(true);
        try {
            const eventType = (ticket.type || 'paid').toLowerCase();
            const res = await getTicketSoldUsers(eventId, ticket.id, eventType);

            let users: SoldUser[] = [];
            if (res?.data && Array.isArray(res.data)) {
                users = res.data;
            } else if (Array.isArray(res)) {
                users = res;
            }

            setSoldDataCache(prev => ({ ...prev, [ticket.id]: users }));
        } catch (error) {
            console.error("Failed to fetch sold users", error);
        } finally {
            setLoadingUsers(false);
        }
    }

    const UserCard = ({ item }: { item: SoldUser }) => (
        <View style={styles.userCard}>
            <View style={styles.userCardHeader}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.ticketCountPill}>{item.tickets_bought} Ticket{item.tickets_bought !== 1 ? 's' : ''}</Text>
            </View>

            <View style={styles.userCardDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mobile:</Text>
                    <Text style={styles.detailValue}>+{item.dialing_code || 91} {item.mobile}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Registered By:</Text>
                    <Text style={styles.detailValue}>{item.registered_by || 'Self'}</Text>
                </View>
                {item.invited_by && (
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Invited By:</Text>
                        <Text style={styles.detailValue}>{item.invited_by}</Text>
                    </View>
                )}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time:</Text>
                    <Text style={styles.detailValue}>
                        {new Date(item.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                </View>
            </View>
        </View>
    );

    const renderTicketItem = ({ item }: { item: TicketType }) => {
        const expanded = expandedTicketId === item.id;
        const soldCount = Number(item.sold_out || 0);
        const users = soldDataCache[item.id] || [];

        return (
            <View style={styles.ticketCard}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleExpand(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconContainer}>
                        <Image source={require('../../assets/img/eventdashboard/ticket.png')} style={styles.ticketIcon} resizeMode="contain" />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.ticketTitle}>{item.title}</Text>
                        <Text style={styles.soldText}>{soldCount} Sold</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                        <Image
                            source={require('../../assets/img/common/next.png')}
                            style={[
                                styles.arrowIcon,
                                { transform: [{ rotate: expanded ? '90deg' : '0deg' }] }
                            ]}
                            resizeMode="contain"
                        />
                    </View>
                </TouchableOpacity>

                {expanded && (
                    <View style={styles.expandedContent}>
                        {loadingUsers && !soldDataCache[item.id] ? (
                            <ActivityIndicator size="small" color="#FF8A3C" style={{ padding: 20 }} />
                        ) : (
                            <View style={styles.usersListContainer}>
                                {users.length > 0 ? (
                                    users.map((user, index) => (
                                        <UserCard key={index} item={user} />
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.noDataText}>No sold tickets found.</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>Tickets Sold Records</Text>
                <View style={{ width: 32 }} />
            </View>

            <FlatList
                data={tickets}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderTicketItem}
                contentContainerStyle={styles.listContent}
            />
        </SafeAreaView>
    );
};

export default TicketsSoldRecords;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        width: '100%',
        height: 90,
        paddingTop: 20, // Push content down
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
    listContent: {
        padding: 16,
    },
    ticketCard: {
        borderRadius: 12,
        backgroundColor: 'white',
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF0E0', // Light orange bg
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    ticketIcon: {
        width: 22,
        height: 22,
        tintColor: '#FF8A3C', // Orange icon
    },
    headerInfo: {
        flex: 1,
    },
    ticketTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },
    soldText: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    arrowContainer: {
        padding: 4,
    },
    arrowIcon: {
        width: 16,
        height: 16,
        tintColor: '#999',
    },
    expandedContent: {
        backgroundColor: '#FAFAFA',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    usersListContainer: {
        gap: 12,
    },

    // User Card Styles
    userCard: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    userCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        paddingBottom: 8,
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
        flex: 1,
        marginRight: 8,
    },
    ticketCountPill: {
        backgroundColor: '#E8F5E9',
        color: '#2E7D32',
        fontSize: 11,
        fontWeight: '600',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    userCardDetails: {
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailLabel: {
        width: 90,
        fontSize: 12,
        color: '#888',
        fontWeight: '500',
    },
    detailValue: {
        flex: 1,
        fontSize: 12,
        color: '#444',
        fontWeight: '500',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderRadius: 8,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    noDataText: {
        color: '#999',
        fontStyle: 'italic',
        fontSize: 14,
    }
});
