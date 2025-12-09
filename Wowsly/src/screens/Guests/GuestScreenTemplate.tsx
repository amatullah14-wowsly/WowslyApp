import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  InteractionManager,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { Guest, GuestGroup } from './guestData';
import { getEventUsers, makeGuestManager, makeGuestUser, getEventUsersPage } from '../../api/event';
import { getLocalCheckedInGuests } from '../../db';
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
const PREV_ICON = require('../../assets/img/common/previous.png');
const NEXT_ICON = require('../../assets/img/common/next.png');

// --- Optimization: Memoized Row Component ---
const GuestRow = React.memo(({ item, onPress }: { item: any; onPress: (guest: any) => void }) => {
  const name = item.name || item.first_name + ' ' + item.last_name || 'Guest';
  const avatar = item.avatar || item.profile_photo;
  let status = item.status || 'Registered';

  // Fix: Map "Active/Registered/Invited" to "Pending" for display
  if (['active', 'registered', 'invited'].includes(status.toLowerCase())) {
    status = 'Pending';
  }

  // Fix: Check explicit check_in_status or used count
  const isCheckedIn = item.check_in_status === 1 || item.status === 'Checked In' || item.status === 'checked_in';

  // Multi-entry Logic
  const ticketData = item.ticket_data || {};
  const totalEntries = Number(item.total_entries || item.tickets_bought || ticketData.tickets_bought || item.quantity || ticketData.quantity || 1);
  const usedEntries = Number(item.used_entries || item.checked_in_count || ticketData.used_entries || ticketData.checked_in_count || 0);

  let statusStyle = statusChipStyles[status] || statusChipStyles[status.toLowerCase()] || statusChipStyles['registered'];

  if (totalEntries > 1) {
    if (usedEntries >= totalEntries) {
      status = 'Checked In';
      statusStyle = statusChipStyles['Checked In'];
    } else {
      status = `${usedEntries}/${totalEntries}`;
      statusStyle = statusChipStyles['Pending'];
    }
  } else {
    // Single entry logic (or missing ticket data)
    if (isCheckedIn || usedEntries > 0) {
      status = 'Checked In';
      statusStyle = statusChipStyles['Checked In'];
    }
  }

  // Final override: if we determined it's Pending based on text but logic says otherwise, the above blocks fix it.
  // But if status is still 'Registered'/'Active' and not caught above, map to Pending.
  if (['active', 'registered', 'invited'].includes(status.toLowerCase())) {
    status = 'Pending';
  }

  const renderRightActions = () => (
    <View style={localStyles.rowActions}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[localStyles.actionButton, localStyles.editButton]}
      >
        <Text style={localStyles.actionText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  // Memoize dynamic style for status chip text
  const statusTextStyle = useMemo(() => ([
    localStyles.statusChipText,
    { color: statusStyle.color },
  ]), [statusStyle.color]);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={localStyles.guestRow}>
          {avatar ? (
            <FastImage
              source={{ uri: avatar, priority: FastImage.priority.normal }}
              style={localStyles.avatar}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[localStyles.avatar, localStyles.avatarPlaceholder]}>
              <Text style={localStyles.avatarPlaceholderText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={localStyles.guestInfo}>
            <Text style={localStyles.guestName}>{name}</Text>
          </View>
          <View style={[localStyles.statusChip, statusStyle]}>
            <Text style={statusTextStyle}>
              {status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance if needed, or rely on default shallow compare
  // Checking key props that might change
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.used_entries === nextProps.item.used_entries &&
    prevProps.item.tickets_bought === nextProps.item.tickets_bought &&
    prevProps.item.checked_in_count === nextProps.item.checked_in_count
  );
});


const GuestScreenTemplate: React.FC<GuestScreenTemplateProps> = ({
  initialFilter = 'All',
  eventId,
}) => {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<GuestFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [guests, setGuests] = useState<any[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<any[]>([]); // Optimization: Async filtered state
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

  // Debounced search API call
  useEffect(() => {
    const timer = setTimeout(() => {
      if (eventId) fetchGuests(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Optimization: Background/Timeout filtering
  useEffect(() => {
    let active = true;

    const filterLogic = () => {
      const result = guests.map(g => {
        // MERGE LOCAL SCANS FROM GLOBAL STORE
        return getMergedGuest(g);
      }).filter((guest) => {
        // CATEGORY FILTERING (Restored Logic)
        if (activeFilter !== 'All') {
          if (activeFilter === 'Manager') {
            if (!(guest.type === 'manager' || guest.is_manager || guest.group === 'Manager' || guest.role === 'manager')) return false;
          } else if (activeFilter === 'Invited') {
            const isInvited = guest.generated_by_owner == 1;
            if (!isInvited) return false;
          } else if (activeFilter === 'Registered') {
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

      if (active) {
        setFilteredGuests(result);
      }
    };

    // Use InteractionManager or setTimeout to unblock JS thread
    const task = InteractionManager.runAfterInteractions(() => {
      // Also verify this runs smoothly; fallback to setTimeout if needed
      setTimeout(filterLogic, 0);
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, [guests, lastUpdate, activeFilter, searchQuery]);


  // Refresh guest list when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (eventId) {
        console.log('GuestScreenTemplate focused - refreshing guest data');
        fetchGuests(currentPage);
        setLastUpdate(Date.now());
      }
    }, [eventId, activeFilter, currentPage])
  );

  // REAL-TIME UPDATE LISTENERS
  useEffect(() => {
    const subscription = (DeviceEventEmitter as any).addListener('BROADCAST_SCAN_TO_CLIENTS', (data: any) => {
      console.log("GuestScreenTemplate received broadcast:", data);
      setLastUpdate(Date.now());
    });

    const manualCheckInSub = (DeviceEventEmitter as any).addListener('GUEST_CHECKED_IN_MANUALLY', ({ guestId, count, fullGuestData }: { guestId: number, count: number, fullGuestData?: any }) => {
      console.log('GuestScreenTemplate received GUEST_CHECKED_IN_MANUALLY:', { guestId, count });
      setGuests(prevGuests => prevGuests.map(g => {
        if ((g.id || '').toString() === guestId.toString() || (g.guest_id || '').toString() === guestId.toString()) {
          if (fullGuestData) {
            return {
              ...g,
              ...fullGuestData,
              used_entries: fullGuestData.used_entries || ((g.used_entries || 0) + count),
              ticket_data: { ...(g.ticket_data || {}), ...(fullGuestData.ticket_data || {}) }
            };
          }

          const currentUsed = g.used_entries || g.checked_in_count || g.ticket_data?.used_entries || 0;
          const newUsed = currentUsed + (count || 1);
          return {
            ...g,
            check_in_status: 1,
            status: 'Checked In',
            used_entries: newUsed,
            checked_in_count: newUsed,
            ticket_data: g.ticket_data ? { ...g.ticket_data, used_entries: newUsed, checked_in_count: newUsed } : g.ticket_data
          };
        }
        return g;
      }));
      // fetchGuests(currentPage);
    });

    return () => {
      subscription.remove();
      manualCheckInSub.remove();
    };
  }, [currentPage]);

  const fetchGuests = async (page = 1) => {
    setLoading(true);

    try {
      let type = 'all';
      if (activeFilter === 'Manager') type = 'manager';
      if (activeFilter === 'Invited') type = 'invited';
      if (activeFilter === 'Registered') type = 'registered';

      const res = await getEventUsersPage(eventId, page, type, searchQuery);

      let fetchedGuests = res?.guests_list || res?.data || [];
      const meta = res?.meta || res?.pagination;

      if (res && res.guests_list) {
        fetchedGuests = res.guests_list;
      } else if (res && res.data && Array.isArray(res.data)) {
        fetchedGuests = res.data;
      } else if (Array.isArray(res)) {
        fetchedGuests = res;
      }

      if (meta) {
        setLastPage(meta.last_page || 1);
        setTotalGuests(meta.total || 0);
        setCurrentPage(meta.current_page || page);
      } else {
        setLastPage(1);
        setCurrentPage(page);
      }

      const normalizedGuests = fetchedGuests.map((g: any) => ({
        ...g,
        id: g.id || g.guest_id || g.event_user_id,
      }));

      // Merge local DB check-ins for persistence
      try {
        const localCheckins = await getLocalCheckedInGuests(Number(eventId));
        const mergedGuests = normalizedGuests.map((apiGuest: any) => {
          const match = localCheckins.find(u =>
            (u.qr_code && apiGuest.qr_code && u.qr_code === apiGuest.qr_code) ||
            (u.guest_id && apiGuest.id && String(u.guest_id) === String(apiGuest.id))
          );

          if (!match) return apiGuest;

          const localUsed = match.used_entries || 0;
          const apiUsed = apiGuest.used_entries || 0;

          // Only merge if local has data (preserving check-in status)
          if (localUsed > 0 || match.status === 'Checked In' || match.status === 'checked_in') {
            return {
              ...apiGuest,
              used_entries: Math.max(apiUsed, localUsed),
              // If local says checked in or has usage, mark as Checked In for UI logic
              status: (apiGuest.status === 'Checked In' || match.status === 'checked_in' || match.status === 'Checked In') ? 'Checked In' : apiGuest.status,
              // Ensure we don't accidentally revert a 'Checked In' status if API is fresh but DB is slightly behind?
              // Actually DB is source of truth for offline/manual checkins.
              // If DB has used_entries, verify against total.
              // For now, trust DB helps fill gaps.
            };
          }
          return apiGuest;
        });
        setGuests(mergedGuests);
      } catch (err) {
        console.warn("GuestScreenTemplate DB merge failed:", err);
        setGuests(normalizedGuests);
      }

    } catch (error) {
      console.error('Error fetching guests:', error);
      setGuests([]);
    }

    setLoading(false);
  };

  const handleGuestPress = useCallback((guest: any) => {
    setSelectedGuestId((guest.id || '').toString());
    setModalVisible(true);
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => {
    return (
      <GuestRow item={item} onPress={handleGuestPress} />
    );
  }, [handleGuestPress]);

  // Styles memoization
  const headerSpacerStyle = useMemo(() => ({ width: 36 }), []);

  // Optimization: getItemLayout
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 86, // Approx height (GuestRow + Separator)
    offset: 86 * index,
    index,
  }), []);

  return (
    <SafeAreaView style={localStyles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={localStyles.header}>
        <BackButton onPress={() => navigation.canGoBack() && navigation.goBack()} />
        <Text style={localStyles.headerTitle}>Guest List</Text>
        <View style={headerSpacerStyle} />
      </View>

      <View style={localStyles.tabRow}>
        {tabs.map((tab) => {
          const isActive = tab === activeFilter;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              style={localStyles.tabButton}
              onPress={() => setActiveFilter(tab)}
            >
              <Text
                style={[
                  localStyles.tabLabel,
                  isActive && localStyles.tabLabelActive,
                ]}
              >
                {tab}
              </Text>
              {isActive ? <View style={localStyles.tabIndicator} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={localStyles.searchContainer}>
        <Image source={SEARCH_ICON} style={localStyles.searchIcon} />
        <TextInput
          style={localStyles.searchInput}
          placeholder="Search by name"
          placeholderTextColor="#A1A1A1"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <GestureHandlerRootView style={localStyles.listWrapper}>
        {loading ? (
          <View style={localStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8A3C" />
          </View>
        ) : (
          <FlatList
            data={filteredGuests}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={localStyles.listContent}
            ItemSeparatorComponent={() => <View style={localStyles.separator} />}
            renderItem={renderItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            getItemLayout={getItemLayout}
            ListEmptyComponent={
              <View style={localStyles.emptyState}>
                <Image source={NOGUESTS_ICON} style={localStyles.emptyIcon} />
                <Text style={localStyles.emptyTitle}>No guests found</Text>
                <Text style={localStyles.emptySubtitle}>
                  Try a different name or category.
                </Text>
              </View>
            }
            ListFooterComponent={
              filteredGuests.length > 0 && lastPage > 1 ? (
                <View style={localStyles.paginationContainer}>
                  <TouchableOpacity
                    disabled={currentPage === 1 || loading}
                    onPress={() => fetchGuests(currentPage - 1)}
                  >
                    <Image
                      source={PREV_ICON}
                      style={[localStyles.pageIcon, currentPage === 1 && localStyles.disabledIcon]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>

                  <Text style={localStyles.pageInfo}>{currentPage} / {lastPage || 1}</Text>

                  <TouchableOpacity
                    disabled={currentPage >= lastPage || loading}
                    onPress={() => fetchGuests(currentPage + 1)}
                  >
                    <Image
                      source={NEXT_ICON}
                      style={[localStyles.pageIcon, currentPage >= lastPage && localStyles.disabledIcon]}
                      resizeMode="contain"
                    />
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

        onMakeManager={async (guestId) => {
          // ... (Existing logic same as before, ensuring state updates correctly)
          console.log('Make manager for guest:', guestId);
          try {
            const res = await makeGuestManager(eventId, guestId);
            if (res && (res.status === true || res.success === true || res.data)) {
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

const localStyles = StyleSheet.create({
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 12,
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
    height: 50, // Matches some standard
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
  },
  pageIcon: {
    width: 28,
    height: 28,
    tintColor: '#FF8A3C',
  },
  disabledIcon: {
    tintColor: '#E0E0E0',
  },
  pageInfo: {
    fontWeight: '600',
    color: '#333',
  },
});
