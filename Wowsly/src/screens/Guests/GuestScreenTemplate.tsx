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
  InteractionManager,
  Modal,
  Platform,
  Alert,
  DeviceEventEmitter,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { Guest, GuestGroup } from './guestData';
import { getEventUsers, makeGuestManager, makeGuestUser, getEventUsersPage, updateGuestStatus, getEventDetails } from '../../api/event';
import { getLocalCheckedInGuests } from '../../db';
import { scanStore, getMergedGuest } from '../../context/ScanStore';
import GuestDetailsModal from '../../components/GuestDetailsModal';
import BackButton from '../../components/BackButton';
import Pagination from '../../components/Pagination';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';

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
const GuestRow = React.memo(({ item, onPress, showActions, onActionPress, styles }: { item: any; onPress: (guest: any) => void; showActions: boolean; onActionPress: (guest: any) => void, styles: any }) => {
  const name = item.name || item.first_name + ' ' + item.last_name || 'Guest';
  const avatar = item.avatar || item.profile_photo;
  let displayStatus = item.status || 'Registered';

  // Fix: Map "Active/Registered/Invited" to "Pending" for display
  if (['active', 'registered', 'invited'].includes(displayStatus.toLowerCase())) {
    displayStatus = 'Pending';
  }

  // Fix: Check explicit check_in_status or used count
  const isCheckedIn = item.check_in_status === 1 || item.status === 'Checked In' || item.status === 'checked_in';

  // Multi-entry Logic
  const ticketData = item.ticket_data || {};
  const totalEntries = Number(item.total_entries || item.tickets_bought || ticketData.tickets_bought || item.quantity || ticketData.quantity || 1);
  const usedEntries = Number(item.used_entries || item.checked_in_count || ticketData.used_entries || ticketData.checked_in_count || 0);

  let statusStyle = statusChipStyles[displayStatus] || statusChipStyles[displayStatus.toLowerCase()] || statusChipStyles['registered'];

  if (totalEntries > 1) {
    if (usedEntries >= totalEntries) {
      displayStatus = 'Checked In';
      statusStyle = statusChipStyles['Checked In'];
    } else {
      displayStatus = `${usedEntries}/${totalEntries}`;
      statusStyle = statusChipStyles['Pending'];
    }
  } else {
    // Single entry logic (or missing ticket data)
    if (isCheckedIn || usedEntries > 0) {
      displayStatus = 'Checked In';
      statusStyle = statusChipStyles['Checked In'];
    }
  }

  // Final override: if we determined it's Pending based on text but logic says otherwise, the above blocks fix it.
  // But if status is still 'Registered'/'Active' and not caught above, map to Pending.
  if (['active', 'registered', 'invited'].includes(displayStatus.toLowerCase())) {
    displayStatus = 'Pending';
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

  // Memoize dynamic style for status chip text
  const statusTextStyle = useMemo(() => ([
    styles.statusChipText,
    { color: statusStyle.color },
  ]), [statusStyle.color, styles.statusChipText]);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={styles.guestRow}>
          {avatar ? (
            <FastImage
              source={{ uri: avatar, priority: FastImage.priority.normal }}
              style={styles.avatar}
              resizeMode={FastImage.resizeMode.cover}
            />
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

          {/* Info Icon */}
          <TouchableOpacity onPress={handlePress} style={styles.arrowContainer}>
            <Image source={require('../../assets/img/common/info.png')} style={[styles.arrowIcon, { tintColor: '#757575' }]} resizeMode="contain" />
          </TouchableOpacity>

          {/* Action Arrow for Approval Basis */}
          {showActions && (
            <TouchableOpacity onPress={() => onActionPress(item)} style={styles.arrowContainer}>
              <Image source={require('../../assets/img/common/forwardarrow.png')} style={styles.arrowIcon} resizeMode="contain" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.used_entries === nextProps.item.used_entries &&
    prevProps.item.tickets_bought === nextProps.item.tickets_bought &&
    prevProps.item.checked_in_count === nextProps.item.checked_in_count &&
    prevProps.showActions === nextProps.showActions
  );
});

const GuestScreenTemplate: React.FC<GuestScreenTemplateProps> = ({
  initialFilter = 'All',
  eventId,
}) => {
  const navigation = useNavigation();

  const { width } = useWindowDimensions();
  const { scale, verticalScale, moderateScale } = useScale();
  const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

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

  // Approval Basis State
  const [isApprovalBasis, setIsApprovalBasis] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionGuest, setActionGuest] = useState<any>(null);

  useEffect(() => {
    if (eventId) {
      getEventDetails(eventId).then(res => {
        if (res && res.data && res.data.registration_on_approval_basis === 1) {
          setIsApprovalBasis(true);
        }
      });
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
        // console.log('GuestScreenTemplate focused - refreshing guest data');
        fetchGuests(currentPage);
        setLastUpdate(Date.now());
      }
    }, [eventId, activeFilter, currentPage])
  );

  // REAL-TIME UPDATE LISTENERS
  useEffect(() => {
    const subscription = (DeviceEventEmitter as any).addListener('BROADCAST_SCAN_TO_CLIENTS', (data: any) => {
      // console.log("GuestScreenTemplate received broadcast:", data);
      setLastUpdate(Date.now());
    });

    const manualCheckInSub = (DeviceEventEmitter as any).addListener('GUEST_CHECKED_IN_MANUALLY', ({ guestId, count, fullGuestData }: { guestId: number, count: number, fullGuestData?: any }) => {
      // console.log('GuestScreenTemplate received GUEST_CHECKED_IN_MANUALLY:', { guestId, count });
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

      // ⚡⚡⚡ Safety: If fetched count is small, assume end of list to prevent ghost pagination ⚡⚡⚡
      if (fetchedGuests.length < 50) {
        setLastPage(page);
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

  // Action Handler
  const handleActionPress = useCallback((guest: any) => {
    setActionGuest(guest);
    setActionModalVisible(true);
  }, []);

  const performAction = async (status: 'accepted' | 'rejected' | 'blocked') => {
    if (!actionGuest || !eventId) return;

    const guestId = actionGuest.id || actionGuest.guest_id;
    // Close modal immediately for better UX
    setActionModalVisible(false);

    try {
      const res = await updateGuestStatus(eventId, guestId, status);
      if (res && res.success) {
        Alert.alert("Success", `Guest status updated to ${status}.`, [
          {
            text: "OK", onPress: () => {
              setLastUpdate(Date.now());
              fetchGuests(currentPage);
            }
          }
        ]);
      } else {
        Alert.alert("Error", res.message || "Update failed");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong.");
    }
    setActionGuest(null);
  };

  const renderItem = useCallback(({ item }: { item: any }) => {
    return (
      <GuestRow
        item={item}
        onPress={handleGuestPress}
        showActions={isApprovalBasis}
        onActionPress={handleActionPress}
        styles={styles}
      />
    );
  }, [handleGuestPress, isApprovalBasis, handleActionPress, styles]);

  // Styles memoization
  const headerSpacerStyle = useMemo(() => ({ width: scale(36) }), [scale]);

  // Optimization: getItemLayout
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: verticalScale(86), // Approx height (GuestRow + Separator)
    offset: verticalScale(86) * index,
    index,
  }), [verticalScale]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.canGoBack() && navigation.goBack()} />
        <Text style={styles.headerTitle}>Guest List</Text>
        <View style={headerSpacerStyle} />
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
            data={filteredGuests}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            getItemLayout={getItemLayout}
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
              filteredGuests.length > 0 && lastPage > 1 ? (
                <Pagination
                  currentPage={currentPage}
                  totalPages={lastPage}
                  onPageChange={fetchGuests}
                />
              ) : null
            }
          />
        )}
      </GestureHandlerRootView>

      {/* Action Modal - Reusing RegistrationDashboard Pattern (Centered) */}
      <Modal
        visible={actionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionTitle}>Action for Guest</Text>
            {actionGuest && (
              <Text style={styles.quickActionsubtitle}>
                {actionGuest.name || actionGuest.first_name + ' ' + actionGuest.last_name || "Guest"}
              </Text>
            )}
            <TouchableOpacity style={styles.quickActionButton} onPress={() => performAction('accepted')}>
              <Text style={styles.quickActionText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={() => performAction('rejected')}>
              <Text style={styles.quickActionText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickActionButton]} onPress={() => performAction('blocked')}>
              <Text style={[styles.quickActionText, { color: '#D32F2F' }]}>Reject & Block</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelActionButton} onPress={() => setActionModalVisible(false)}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
          const res = await makeGuestManager(eventId || '', guestId);
          if (res.success) {
            fetchGuests(currentPage);
          }
        }}
        onMakeGuest={async (guestId) => {
          const res = await makeGuestUser(eventId || '', guestId);
          if (res.success) {
            fetchGuests(currentPage);
          }
        }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#000',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tabButton: {
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#9E9E9E',
  },
  tabLabelActive: {
    color: '#FF8A3C',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    height: verticalScale(3),
    backgroundColor: '#FF8A3C',
    borderRadius: scale(2),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: scale(16),
    marginVertical: verticalScale(12),
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    height: verticalScale(40),
  },
  searchIcon: {
    width: scale(16),
    height: scale(16),
    tintColor: '#9E9E9E',
    marginRight: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: '#000',
    paddingVertical: 0,
  },
  listWrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: verticalScale(20),
  },
  // Guest Row
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    backgroundColor: '#fff',
  },
  avatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(24),
    marginRight: scale(16),
    backgroundColor: '#e0e0e0',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF8A3C',
  },
  avatarPlaceholderText: {
    fontSize: moderateScale(FontSize.lg), // 18 -> lg
    fontWeight: '600',
    color: '#FFFFFF',
  },
  guestInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  guestName: {
    fontSize: moderateScale(FontSize.md), // 16 -> md
    color: '#333',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginLeft: scale(68), // Offset to align with text
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(70),
    height: '100%',
  },
  editButton: {
    backgroundColor: '#E0E0E0',
  },
  actionText: {
    color: '#000',
    fontSize: moderateScale(FontSize.xs), // 12 -> xs
    fontWeight: '600',
  },
  statusChipText: {
    fontSize: moderateScale(FontSize.xs), // 12 -> xs
    fontWeight: '600',
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: verticalScale(60),
    paddingHorizontal: scale(32),
  },
  emptyIcon: {
    width: scale(120),
    height: scale(120),
    marginBottom: verticalScale(16),
    resizeMode: 'contain',
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: moderateScale(FontSize.lg), // 18 -> lg
    fontWeight: '700',
    color: '#424242',
    marginBottom: verticalScale(8),
  },
  emptySubtitle: {
    fontSize: moderateScale(FontSize.sm), // 14 -> sm
    color: '#9E9E9E',
    textAlign: 'center',
  },
  // Actions
  arrowContainer: {
    padding: scale(8),
  },
  arrowIcon: {
    width: scale(20),
    height: scale(20),
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', // Changed for centered modal
    alignItems: 'center',
  },
  // Quick Action Card (Centered)
  quickActionCard: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: scale(16),
    padding: scale(20),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  quickActionTitle: {
    fontSize: moderateScale(FontSize.lg), // 18 -> lg
    fontWeight: 'bold',
    marginBottom: verticalScale(4),
    color: '#000',
  },
  quickActionsubtitle: {
    fontSize: moderateScale(FontSize.sm), // 14 -> sm
    color: '#666',
    marginBottom: verticalScale(20),
    textAlign: 'center',
  },
  quickActionButton: {
    width: '100%',
    paddingVertical: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: moderateScale(FontSize.md), // 16 -> md
    color: '#007AFF', // Standard Blue
    fontWeight: '500',
  },
  cancelActionButton: {
    marginTop: verticalScale(10),
    paddingVertical: verticalScale(10),
    width: '100%',
    alignItems: 'center',
  },
  cancelActionText: {
    fontSize: moderateScale(FontSize.md), // 16 -> md
    color: '#999',
    fontWeight: '500',
  },
});

export default GuestScreenTemplate;
