import React, { useState, useEffect, useMemo } from 'react';
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
    Dimensions,
    useWindowDimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../../components/BackButton';
import { getTicketSoldUsers } from '../../api/event';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';

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

import SystemNavigationBar from 'react-native-system-navigation-bar';

const TicketsSoldRecords = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { eventId, tickets } = route.params || {};

    const { width } = useWindowDimensions();
    const { scale, verticalScale, moderateScale } = useScale();
    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

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
        SystemNavigationBar.stickyImmersive(); // Enforce immersive
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedUser(null);
        SystemNavigationBar.stickyImmersive(); // Re-enforce on close
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
                            <ActivityIndicator size="small" color="#FF8A3C" style={{ padding: scale(20) }} />
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
                <View style={{ width: scale(32) }} />
            </View>

            <FlatList
                data={tickets}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderTicketItem}
                contentContainerStyle={styles.listContent}
            />

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

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        width: '100%',
        height: verticalScale(90),
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: moderateScale(20),
        backgroundColor: 'white',
        elevation: 2,
    },
    title: {
        fontSize: moderateScale(18),
        fontWeight: '600',
        color: 'black',
    },
    listContent: {
        padding: moderateScale(16),
    },
    ticketCard: {
        borderRadius: moderateScale(12),
        backgroundColor: 'white',
        marginBottom: verticalScale(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
        shadowOffset: { width: 0, height: verticalScale(2) },
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: moderateScale(16),
        backgroundColor: 'white',
    },
    iconContainer: {
        width: moderateScale(44),
        height: moderateScale(44),
        borderRadius: moderateScale(22),
        backgroundColor: '#FFF0E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: moderateScale(14),
    },
    ticketIcon: {
        width: moderateScale(22),
        height: moderateScale(22),
        tintColor: '#FF8A3C',
    },
    headerInfo: {
        flex: 1,
    },
    ticketTitle: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#111',
    },
    soldText: {
        fontSize: moderateScale(14),
        color: '#666',
        marginTop: verticalScale(2),
    },
    arrowContainer: {
        padding: moderateScale(4),
    },
    arrowIcon: {
        width: moderateScale(16),
        height: moderateScale(16),
        tintColor: '#999',
    },
    expandedContent: {
        backgroundColor: '#FAFAFA',
        padding: moderateScale(12),
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    usersGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: moderateScale(12),
    },
    emptyState: {
        padding: moderateScale(20),
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    noDataText: {
        color: '#999',
        fontStyle: 'italic',
        fontSize: moderateScale(14),
    },

    // REDESIGNED Compact Card Styles
    gridCard: {
        backgroundColor: 'white',
        borderRadius: moderateScale(12),
        padding: moderateScale(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(1) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(3),
        width: '48%', // 2 columns with gap
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: verticalScale(140), // Slightly taller to accommodate name
        borderWidth: 1,
        borderColor: '#EAEAEA',
        marginBottom: verticalScale(4)
    },
    cardHeaderCenter: {
        alignItems: 'center',
        width: '100%',
        flex: 1,
        justifyContent: 'center',
    },
    gridGuestName: {
        fontSize: moderateScale(FontSize.sm),
        fontWeight: '700',
        color: '#222',
        textAlign: 'center',
        marginBottom: verticalScale(8),
        lineHeight: moderateScale(22), // Increased line height to prevent cutting
    },
    ticketBadge: {
        backgroundColor: '#FFF0E0',
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        borderRadius: moderateScale(8),
        marginBottom: verticalScale(6),
        borderWidth: 1,
        borderColor: '#FFD2B3',
    },
    gridTicketCount: {
        fontSize: moderateScale(FontSize.xs),
        color: '#E65100',
        fontWeight: '700',
    },
    gridCheckInTime: {
        fontSize: moderateScale(FontSize.xs),
        color: '#999',
        marginTop: verticalScale(2),
    },
    viewDetailsButton: {
        marginTop: verticalScale(10),
        width: '100%',
        paddingVertical: verticalScale(6),
        backgroundColor: '#fff',
        borderRadius: moderateScale(6),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    viewDetailsText: {
        fontSize: moderateScale(FontSize.xs), // 11 -> xs(12)
        fontWeight: '600',
        color: '#555',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)', // Darker background to hide underlying content
        justifyContent: 'flex-end',
    },
    modalContainer: {
        width: '100%',
        maxHeight: '50%',
        backgroundColor: 'white',
        borderTopLeftRadius: moderateScale(20),
        borderTopRightRadius: moderateScale(20),
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(-2) },
        shadowOpacity: 0.2,
        shadowRadius: moderateScale(10),
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: moderateScale(20),
        paddingVertical: verticalScale(10),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: moderateScale(FontSize.md), // 16 -> md (16)
        fontWeight: '700',
        color: '#222',
    },
    closeButton: {
        padding: moderateScale(5),
    },
    closeButtonText: {
        fontSize: moderateScale(FontSize.lg), // 18 -> lg (18)
        color: '#999',
    },
    modalBody: {
        padding: moderateScale(20),
        paddingBottom: verticalScale(30),
    },
    modalRow: {
        marginBottom: verticalScale(8), // Reduced margin
    },
    modalLabel: {
        fontSize: moderateScale(FontSize.xs), // 11 -> xs(12)
        color: '#888',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: verticalScale(2),
    },
    modalValueMain: {
        fontSize: moderateScale(FontSize.md), // 16 -> md
        fontWeight: '700',
        color: '#111',
    },
    modalValue: {
        fontSize: moderateScale(FontSize.sm), // 14 -> sm (14)
        color: '#333',
        fontWeight: '500',
    },
    separator: {
        height: verticalScale(1),
        backgroundColor: '#F0F0F0',
        marginVertical: verticalScale(8), // Reduced margin
    },
    // Footer restored
    modalFooter: {
        padding: moderateScale(16),
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    modalCloseBtn: {
        backgroundColor: '#FF8A3C',
        borderRadius: moderateScale(12),
        paddingVertical: verticalScale(12), // Slightly reduced padding
        alignItems: 'center',
    },
    modalCloseBtnText: {
        color: 'white',
        fontSize: moderateScale(FontSize.md), // 16 -> md
        fontWeight: '700',
    }
});

export default TicketsSoldRecords;
