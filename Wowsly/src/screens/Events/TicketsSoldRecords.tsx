import React, { useState, useEffect } from 'react';
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
    Modal,
    ScrollView,
    Dimensions
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

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SoldUser | null>(null);

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

    const formatTime = (timeString: string) => {
        if (!timeString) return '';

        let dateToParse = timeString;
        if (dateToParse.indexOf('T') === -1) {
            dateToParse = dateToParse.replace(' ', 'T');
        }

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

    const handleViewDetails = (user: SoldUser) => {
        setSelectedUser(user);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedUser(null);
    };

    const UserCard = ({ item }: { item: SoldUser }) => (
        <View style={styles.gridCard}>
            <View style={styles.cardHeaderCenter}>
                <Text style={styles.gridGuestName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.ticketBadge}>
                    <Text style={styles.gridTicketCount}>
                        {item.tickets_bought} × Ticket{item.tickets_bought !== 1 ? 's' : ''}
                    </Text>
                </View>
                <Text style={styles.gridCheckInTime}>
                    {formatTime(item.created_at)}
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
                            <View style={styles.usersGridContainer}>
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
                            <Text style={styles.modalTitle}>Sold Ticket Details</Text>
                            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedUser && (
                            <ScrollView contentContainerStyle={styles.modalBody}>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Name:</Text>
                                    <Text style={styles.modalValueMain}>{selectedUser.name}</Text>
                                </View>
                                <View style={styles.separator} />

                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Mobile:</Text>
                                    <Text style={styles.modalValue}>+{selectedUser.dialing_code || 91} {selectedUser.mobile}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Registered By:</Text>
                                    <Text style={styles.modalValue}>{selectedUser.registered_by || 'Self'}</Text>
                                </View>
                                {selectedUser.invited_by && (
                                    <View style={styles.modalRow}>
                                        <Text style={styles.modalLabel}>Invited By:</Text>
                                        <Text style={styles.modalValue}>{selectedUser.invited_by}</Text>
                                    </View>
                                )}
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Purchased:</Text>
                                    <Text style={styles.modalValue}>{selectedUser.tickets_bought} × Ticket(s)</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Time:</Text>
                                    <Text style={styles.modalValue}>
                                        {formatTime(selectedUser.created_at)}
                                    </Text>
                                </View>
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
        </SafeAreaView>
    );
};

export default TicketsSoldRecords;

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
        backgroundColor: '#FFF0E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    ticketIcon: {
        width: 22,
        height: 22,
        tintColor: '#FF8A3C',
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
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    usersGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    noDataText: {
        color: '#999',
        fontStyle: 'italic',
        fontSize: 14,
    },

    // REDESIGNED Compact Card Styles
    gridCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        width: '48%', // 2 columns with gap
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 130,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        marginBottom: 4
    },
    cardHeaderCenter: {
        alignItems: 'center',
        width: '100%',
        flex: 1,
        justifyContent: 'center',
    },
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
        color: '#E65100',
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
