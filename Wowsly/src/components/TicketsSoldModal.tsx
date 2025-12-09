import React, { useState } from 'react';
import {
    Modal,
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
} from 'react-native';
import BackButton from './BackButton';
import { getTicketSoldUsers } from '../api/event';

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
    sold_out: number | string; // 'Sold Sold' count from ticket list API
};

type TicketsSoldModalProps = {
    visible: boolean;
    onClose: () => void;
    eventId: string;
    tickets: TicketType[];
};

const SOLD_ICON = require('../assets/img/eventdashboard/ticket.png');
const DOWN_ARROW = require('../assets/img/common/down_arrow.png'); // Need to ensure this exists or use text
const UP_ARROW = require('../assets/img/common/up_arrow.png'); // Need to ensure this exists or use text

// Fallback arrow if assets missing
const ArrowIcon = ({ expanded }: { expanded: boolean }) => (
    <Text style={{ fontSize: 18, color: '#666', fontWeight: 'bold' }}>
        {expanded ? '˄' : '˅'}
    </Text>
);

const UserRow = ({ item }: { item: SoldUser }) => (
    <View style={styles.userRow}>
        <View style={[styles.col, { flex: 2 }]}><Text style={styles.userText}>{item.name}</Text></View>
        <View style={[styles.col, { flex: 3 }]}><Text style={styles.userText}>+{item.dialing_code || 91} {item.mobile}</Text></View>
        <View style={[styles.col, { flex: 1, alignItems: 'center' }]}><Text style={styles.userText}>{item.tickets_bought}</Text></View>
        <View style={[styles.col, { flex: 2 }]}><Text style={styles.userText}>{item.invited_by || 'N/A'}</Text></View>
        <View style={[styles.col, { flex: 2 }]}><Text style={styles.userText}>{item.registered_by || 'Self'}</Text></View>
        <View style={[styles.col, { flex: 3, alignItems: 'flex-end' }]}><Text style={styles.userTextSmall}>{new Date(item.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></View>
    </View>
);

const TicketsSoldModal: React.FC<TicketsSoldModalProps> = ({
    visible,
    onClose,
    eventId,
    tickets,
}) => {
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
            } else if (Array.isArray(res)) { // potential direct array
                users = res;
            }

            setSoldDataCache(prev => ({ ...prev, [ticket.id]: users }));
        } catch (error) {
            console.error("Failed to fetch sold users", error);
        } finally {
            setLoadingUsers(false);
        }
    }

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
                        {/* Replace with actual confetti icon from screenshot if available, using generic ticket icon for now */}
                        <Image source={require('../assets/img/eventdashboard/ticket.png')} style={styles.ticketIcon} resizeMode="contain" />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.ticketTitle}>{item.title}</Text>
                        <Text style={styles.soldText}>{soldCount} Sold</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                        <ArrowIcon expanded={expanded} />
                    </View>
                </TouchableOpacity>

                {expanded && (
                    <View style={styles.expandedContent}>
                        {loadingUsers && !soldDataCache[item.id] ? (
                            <ActivityIndicator size="small" color="#FF8A3C" style={{ padding: 20 }} />
                        ) : (
                            <View style={styles.tableContainer}>
                                {/* Table Header */}
                                <View style={styles.tableHeader}>
                                    <View style={[styles.col, { flex: 2 }]}><Text style={styles.headerText}>Name</Text></View>
                                    <View style={[styles.col, { flex: 3 }]}><Text style={styles.headerText}>Contact</Text></View>
                                    <View style={[styles.col, { flex: 1, alignItems: 'center' }]}><Text style={styles.headerText}>Tickets</Text></View>
                                    <View style={[styles.col, { flex: 2 }]}><Text style={styles.headerText}>Invited By</Text></View>
                                    <View style={[styles.col, { flex: 2 }]}><Text style={styles.headerText}>Registered By</Text></View>
                                    <View style={[styles.col, { flex: 3, alignItems: 'flex-end' }]}><Text style={styles.headerText}>Time</Text></View>
                                </View>

                                {users.length > 0 ? (
                                    users.map((user, index) => (
                                        <View key={index}>
                                            <UserRow item={user} />
                                            {index < users.length - 1 && <View style={styles.separator} />}
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.noDataText}>No sold tickets found.</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.modalContent}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={styles.header}>
                        <BackButton onPress={onClose} style={styles.backButtonStyle} />
                        <Text style={styles.title}>Tickets</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={tickets}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderTicketItem}
                        contentContainerStyle={styles.listContent}
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

export default TicketsSoldModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 40,
    },
    modalContent: {
        backgroundColor: 'white',
        width: '100%',
        maxHeight: '90%',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 15,
    },
    backButtonStyle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 0,
        backgroundColor: '#F5F5F5',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
        flex: 1,
        textAlign: 'center',
    },
    closeButton: {
        padding: 5,
    },
    closeText: {
        fontSize: 18,
        color: '#666',
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 20,
    },
    ticketCard: {
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        marginBottom: 0,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: 'white',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#D1D1D1', // Placeholder gray circle
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    ticketIcon: {
        width: 20,
        height: 20,
        tintColor: 'white',
    },
    headerInfo: {
        flex: 1,
    },
    ticketTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
    },
    soldText: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    arrowContainer: {
        padding: 8,
    },
    expandedContent: {
        backgroundColor: '#FAFAFA',
        padding: 10,
    },
    tableContainer: {
        borderWidth: 1,
        borderColor: '#EEE',
        borderRadius: 8,
        backgroundColor: 'white',
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        backgroundColor: '#FFF',
    },
    headerText: {
        fontWeight: '700',
        fontSize: 12,
        color: '#111',
    },
    userRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    userText: {
        fontSize: 12,
        color: '#333',
    },
    userTextSmall: {
        fontSize: 11,
        color: '#666',
        textAlign: 'right',
    },
    col: {
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#F5F5F5',
    },
    noDataText: {
        padding: 20,
        textAlign: 'center',
        color: '#888',
        fontStyle: 'italic',
    }
});
