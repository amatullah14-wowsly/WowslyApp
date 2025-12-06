import React, { useMemo, useState, useEffect } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Guest, GuestGroup } from './guestData';
import { getEventUsers, makeGuestManager, makeGuestUser, getEventUsersPage } from '../../api/event';
import { scanStore, getMergedGuest } from '../../context/ScanStore';
import GuestDetailsModal from '../../components/GuestDetailsModal';
import BackButton from '../../components/BackButton';

export type GuestFilter = 'All' | GuestGroup;

type GuestScreenTemplateProps = {
  initialFilter?: GuestFilter;
  eventId?: string;
};

const tabs: GuestFilter[] = ['All', 'Manager', 'Invited', 'Registered'];

const statusChipStyles: Record<
  string,
  { backgroundColor: string; color: string }
> = {
  'Checked In': { backgroundColor: '#E3F2FD', color: '#1565C0' }, // Blue
  'checked in': { backgroundColor: '#E3F2FD', color: '#1565C0' },
  'checked_in': { backgroundColor: '#E3F2FD', color: '#1565C0' },

  Pending: { backgroundColor: '#E8F5E9', color: '#2E7D32' }, // Green
  'pending': { backgroundColor: '#E8F5E9', color: '#2E7D32' },

  // Map Active to Pending (Green)
  'Active': { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  'active': { backgroundColor: '#E8F5E9', color: '#2E7D32' },

  Blocked: { backgroundColor: '#FFEBEE', color: '#C62828' }, // Red
  'blocked': { backgroundColor: '#FFEBEE', color: '#C62828' },

  // Map others to Pending (Green) as defaults
  'registered': { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  'invited': { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  'No-Show': { backgroundColor: '#FFE2E2', color: '#BE2F2F' },
};

const SEARCH_ICON = {
  uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};

const NOGUESTS_ICON = require('../../assets/img/common/noguests.png');

const GuestScreenTemplate: React.FC<GuestScreenTemplateProps> = ({
  initialFilter = 'All',
  eventId,
}) => {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<GuestFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalGuests, setTotalGuests] = useState(0);

  useEffect(() => {
    if (eventId) {
      fetchGuests(1); // Reset to page 1 on mount/filter change
    }
  }, [eventId, activeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (eventId) fetchGuests(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Refresh guest list when screen comes into focus (after QR scanning)
  useFocusEffect(
    React.useCallback(() => {
      if (eventId) {
        console.log('GuestScreenTemplate focused - refreshing guest data');
        fetchGuests(currentPage);
        setLastUpdate(Date.now());
      }
    }, [eventId, activeFilter, currentPage])
  );

  // ⚡⚡⚡ REAL-TIME UPDATE LISTENER ⚡⚡⚡
  useEffect(() => {
    const subscription = (DeviceEventEmitter as any).addListener('BROADCAST_SCAN_TO_CLIENTS', (data: any) => {
      console.log("GuestScreenTemplate received broadcast:", data);
      setLastUpdate(Date.now());
      // Optionally refresh current page here if needed
      // fetchGuests(currentPage); 
    });

    return () => {
      subscription.remove();
    };
  }, [currentPage]);

  const fetchGuests = async (page = 1) => {
    setLoading(true);

    try {
      // Map filter to API type
      let type = 'all';
      if (activeFilter === 'Manager') type = 'manager';
      if (activeFilter === 'Invited') type = 'invited';
      if (activeFilter === 'Registered') type = 'registered';

      console.log(`Fetching guests: page=${page}, type=${type}, query=${searchQuery}`);

      const res = await getEventUsersPage(eventId, page, type, searchQuery);

      let fetchedGuests = res?.guests_list || res?.data || [];
      const meta = res?.meta || res?.pagination;

      // Handle valid data structure
      if (res && res.guests_list) {
        fetchedGuests = res.guests_list;
      } else if (res && res.data && Array.isArray(res.data)) {
        fetchedGuests = res.data;
      } else if (Array.isArray(res)) {
        fetchedGuests = res;
      }

      // Update Pagination Info
      if (meta) {
        setLastPage(meta.last_page || 1);
        setTotalGuests(meta.total || 0);
        setCurrentPage(meta.current_page || page);
      } else {
        setLastPage(1);
        setCurrentPage(page);
      }

      // Normalize IDs
      const normalizedGuests = fetchedGuests.map((g: any) => ({
        ...g,
        id: g.id || g.guest_id || g.event_user_id,
      }));

      setGuests(normalizedGuests);

    } catch (error) {
      console.error('Error fetching guests:', error);
      setGuests([]);
    }

    setLoading(false);
  };

  const displayedGuests = useMemo(() => {
    return guests.map(g => {
      // ⚡⚡⚡ MERGE LOCAL SCANS FROM GLOBAL STORE ⚡⚡⚡
      return getMergedGuest(g);
    }).filter((guest) => {
      // ⚡⚡⚡ CATEGORY FILTERING (Restored Logic) ⚡⚡⚡
      if (activeFilter !== 'All') {
        if (activeFilter === 'Manager') {
          if (!(guest.type === 'manager' || guest.is_manager || guest.group === 'Manager' || guest.role === 'manager')) return false;
        } else if (activeFilter === 'Invited') {
          // Rule: generated_by_owner : 1 -> invited
          const isInvited = guest.generated_by_owner == 1;
          if (!isInvited) return false;
        } else if (activeFilter === 'Registered') {
          // Rule: generated_by_owner : 0 -> registered
          const isRegistered = guest.generated_by_owner == 0;
          if (!isRegistered) return false;
        }
      }

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const name = (guest.name || guest.first_name + ' ' + guest.last_name || 'Guest').toLowerCase();
      const phone = (guest.mobile || guest.phone || guest.phone_number || '').toString().toLowerCase();
      const id = (guest.id || guest.ticket_id || '').toString().toLowerCase();

      return name.includes(query) || phone.includes(query) || id.includes(query);
    });
  }, [guests, lastUpdate, activeFilter, searchQuery]);

  const renderGuest = ({ item }: { item: any }) => {
    const name = item.name || item.first_name + ' ' + item.last_name || 'Guest';
    const avatar = item.avatar || item.profile_photo;
    let status = item.status || 'Registered';

    // ⚡⚡⚡ FIX: Map "Active" to "Pending" for display ⚡⚡⚡
    if (status.toLowerCase() === 'active') {
      status = 'Pending';
    }

    // ⚡⚡⚡ MULTI-ENTRY LOGIC ⚡⚡⚡
    const ticketData = item.ticket_data || {};
    const totalEntries = item.total_entries || item.tickets_bought || ticketData.tickets_bought || item.quantity || ticketData.quantity || 1;
    const usedEntries = item.used_entries || item.checked_in_count || ticketData.used_entries || ticketData.checked_in_count || 0;

    // Default style
    let statusStyle = statusChipStyles[status] || statusChipStyles[status.toLowerCase()] || statusChipStyles['registered'];

    if (totalEntries > 1) {
      status = `${usedEntries}/${totalEntries}`;
      // Determine color: Blue if fully checked in, Green if pending/partial
      if (usedEntries >= totalEntries) {
        statusStyle = statusChipStyles['Checked In'];
      } else {
        statusStyle = statusChipStyles['Pending'];
      }
    }

    const renderRightActions = () => (
      <View style={styles.rowActions}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionButton, styles.editButton]}
        >
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            setSelectedGuestId(item.id?.toString());
            setModalVisible(true);
          }}
        >
          <View style={styles.guestRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.guestInfo}>
              <Text style={styles.guestName}>{name}</Text>
            </View>
            <View style={[styles.statusChip, statusStyle]}>
              <Text
                style={[
                  styles.statusChipText,
                  { color: statusStyle.color },
                ]}
              >
                {status}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.canGoBack() && navigation.goBack()} />
        <Text style={styles.headerTitle}>Guest List</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = tab === activeFilter;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              style={styles.tabButton}
              onPress={() => setActiveFilter(tab)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab}
              </Text>
              {isActive ? <View style={styles.tabIndicator} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchContainer}>
        <Image source={SEARCH_ICON} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name"
          placeholderTextColor="#A1A1A1"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <GestureHandlerRootView style={styles.listWrapper}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8A3C" />
          </View>
        ) : (
          <FlatList
            data={displayedGuests}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderGuest}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No guests found</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different name or category.
                </Text>
              </View>
            }
            ListFooterComponent={
              displayedGuests.length > 0 && lastPage > 1 ? (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage === 1 && styles.disabledPageButton]}
                    disabled={currentPage === 1 || loading}
                    onPress={() => fetchGuests(currentPage - 1)}
                  >
                    <Text style={[styles.pageButtonText, currentPage === 1 && styles.disabledPageText]}>{"<"}</Text>
                  </TouchableOpacity>

                  <Text style={styles.pageInfo}>{currentPage} / {lastPage || 1}</Text>

                  <TouchableOpacity
                    style={[styles.pageButton, currentPage >= lastPage && styles.disabledPageButton]}
                    disabled={currentPage >= lastPage || loading}
                    onPress={() => fetchGuests(currentPage + 1)}
                  >
                    <Text style={[styles.pageButtonText, currentPage >= lastPage && styles.disabledPageText]}>{">"}</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </GestureHandlerRootView>

      <GuestDetailsModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedGuestId(null);
        }}
        eventId={eventId}
        guestId={selectedGuestId || undefined}
        guest={guests.find(g => (g.id || '').toString() === selectedGuestId?.toString())}
        onManualCheckIn={(guestId) => {
          console.log('Manual check-in for guest:', guestId);
          // TODO: Implement manual check-in API call
        }}
        onMakeManager={async (guestId) => {
          console.log('Make manager for guest:', guestId);
          try {
            const res = await makeGuestManager(eventId, guestId);
            if (res && (res.status === true || res.success === true || res.data)) {
              // Update local state
              setGuests(prevGuests => {
                if (activeFilter === 'All') {
                  return prevGuests.map(g =>
                    (g.id || '').toString() === guestId.toString()
                      ? { ...g, type: 'manager', role: 'manager' }
                      : g
                  );
                } else if (activeFilter === 'Manager') {
                  return prevGuests;
                } else {
                  return prevGuests.filter(g => (g.id || '').toString() !== guestId.toString());
                }
              });
              setModalVisible(false);
              setSelectedGuestId(null);
            } else {
              console.error('Failed to make guest manager', res);
            }
          } catch (err) {
            console.error('Error making guest manager:', err);
          }
        }}
        onMakeGuest={async (guestId) => {
          console.log('Make guest for guest:', guestId);
          try {
            const guest = guests.find(g => (g.id || '').toString() === guestId.toString());
            let targetType = 'registered';
            if (guest && guest.status && guest.status.toLowerCase() === 'invited') {
              targetType = 'invited';
            }

            const res = await makeGuestUser(eventId, guestId, targetType);
            if (res && (res.status === true || res.success === true || res.data)) {
              setGuests(prevGuests => {
                if (activeFilter === 'All') {
                  return prevGuests.map(g =>
                    (g.id || '').toString() === guestId.toString()
                      ? { ...g, type: targetType, role: 'guest' }
                      : g
                  );
                } else if (activeFilter === 'Manager') {
                  return prevGuests.filter(g => (g.id || '').toString() !== guestId.toString());
                } else {
                  return prevGuests;
                }
              });
              setModalVisible(false);
              setSelectedGuestId(null);
            } else {
              console.error('Failed to make guest user', res);
            }
          } catch (err) {
            console.error('Error making guest user:', err);
          }
        }}
      />

    </SafeAreaView>
  );
};

export default GuestScreenTemplate;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  headerIcon: {
    width: 18,
    height: 18,
    tintColor: '#111111',
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 20,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    color: '#7A7A7A',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FF8A3C',
  },
  tabIndicator: {
    marginTop: 6,
    height: 3,
    width: 24,
    borderRadius: 3,
    backgroundColor: '#FF8A3C',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    tintColor: '#9B9B9B',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111111',
  },
  listWrapper: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#ffffff',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 24,
    marginRight: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#FF8A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',

  },
  actionButton: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  editButton: {
    backgroundColor: '#FF8A3C',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7A7A7A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Pagination Styles (Matched to EventListing)
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
  },
  pageButton: {
    backgroundColor: '#FF8A3C',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  disabledPageButton: {
    backgroundColor: '#FFD2B3',
  },
  pageButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  disabledPageText: {
    color: '#7A7A7A', // Actually EventListing just uses opacity/color change but keeps structure. Let's stick to the override.
  },
  pageInfo: {
    fontWeight: '600',
    color: '#333',
  },
});
