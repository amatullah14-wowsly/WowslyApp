import {
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  RefreshControl,
  BackHandler,
} from "react-native";
import FastImage from 'react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import React, { useEffect, useMemo, useState, useCallback } from "react";
import EventCard from "../../components/EventCard";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  getEvents,
  getEventsPage,
  getEventWebLink
} from "../../api/event"; // Modified import

const EventListing = () => {
  const navigation = useNavigation<any>();

  // 🔥 Live events from API
  const [events, setEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]); // Store all fetched events
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false); // Track background fetching
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'joined' | 'created'>('joined');

  const EVENTS_PER_PAGE = 8;

  // 🔥 Fetch Events from Backend
  useEffect(() => {
    fetchEvents();
  }, [activeTab]);

  // 🔙 Handle Hardware Back Button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        setLogoutModalVisible(true);
        return true; // Stop default behavior (exit app)
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () =>
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  const fetchEvents = async (force = false) => {
    if (!force) setLoading(true);

    try {
      // ⚡⚡⚡ INCREMENTAL LOADING STRATEGY ⚡⚡⚡
      // 1. Fetch Page 1 immediately
      const type = activeTab === 'joined' ? 'join' : 'created';
      const res = await getEventsPage(1, type);
      const initialEvents = res?.data || [];
      console.log(`Fetched Page 1 ${type} events:`, initialEvents.length);

      setAllEvents(initialEvents);
      // Ensure we run filter immediately
      filterEvents(initialEvents, searchQuery);
      setLoading(false); // UI is now interactive!
      setRefreshing(false);

      // 2. Background Loop for remaining pages
      let currentPage = 1;
      let hasMore = !!(res.next_page_url || (res.meta && res.meta.current_page < res.meta.last_page));
      let accumulatedEvents = [...initialEvents];
      // Optimization: Track IDs to avoid O(N^2) search
      const seenIds = new Set(initialEvents.map((e: any) => e.id));

      if (hasMore) {
        setFetchingMore(true);
        while (hasMore) {
          currentPage++;
          const nextRes = await getEventsPage(currentPage, type);
          // console.log("nextRes:", nextRes) 
          const nextEvents = nextRes?.data || [];

          // Check for next page info immediately
          hasMore = !!(nextRes.next_page_url || (nextRes.meta && nextRes.meta.current_page < nextRes.meta.last_page));
          if (currentPage > 50) hasMore = false;

          if (nextEvents.length > 0) {
            // Deduplicate efficiently (O(N))
            const newUnique = [];
            for (const event of nextEvents) {
              if (!seenIds.has(event.id)) {
                seenIds.add(event.id);
                newUnique.push(event);
              }
            }

            accumulatedEvents = [...accumulatedEvents, ...newUnique];

            // ⚡⚡⚡ BATCH UPDATE UI ⚡⚡⚡
            // Update every 5 pages or if finished
            if (currentPage % 5 === 0 || !hasMore) {
              setAllEvents([...accumulatedEvents]);
            }
          }
        }

        // Final update upon completion
        setAllEvents([...accumulatedEvents]);
        setFetchingMore(false);
      }

    } catch (e) {
      console.log("Error in incremental fetch:", e);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-run filter when allEvents changes (to capture background updates)
  useEffect(() => {
    filterEvents(allEvents, searchQuery);
  }, [allEvents, searchQuery]);

  const filterEvents = (sourceEvents: any[], query: string) => {
    // Filter: Show "Current" and "Upcoming" events
    // Logic: Event has not ended yet (endDate >= today)
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const filtered = sourceEvents.filter((event: any) => {
      // Search Filter
      const matchesSearch = event.title?.toLowerCase().includes(query.toLowerCase());

      // Date Filter: >= Today
      // If no end_date, assume it is valid (Current)
      if (!event.end_date) return matchesSearch;

      const endDate = event.end_date.split('T')[0];
      return matchesSearch && endDate >= today;
    });

    setEvents(filtered);
    setPage(1); // Reset to first page on filter
  };



  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents(true);
  };

  // Pagination
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);

  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * EVENTS_PER_PAGE;
    return events.slice(startIndex, startIndex + EVENTS_PER_PAGE);
  }, [events, page]);

  const renderCard = useCallback(({ item }: { item: any }) => {
    const isSelected = item.id === selectedEventId;

    // Fallback image if API doesn't provide one
    // Note: FastImage helps with caching
    const imageSource =
      item.event_main_photo &&
        item.event_main_photo !== "" &&
        item.event_main_photo !== null
        ? { uri: item.event_main_photo }
        : require('../../assets/img/common/noimage.png');

    return (
      <EventCard
        title={item.title}
        date={item.start_date_display || "No Date"}
        location={item.address || item.city || "—"}
        image={imageSource}
        isPlaceholder={!item.event_main_photo || item.event_main_photo === ""}
        selected={isSelected}
        onPress={async () => {
          setSelectedEventId(item.id);

          if (activeTab === 'joined') {
            try {
              const guestUuid = item.guest_uuid || item.uuid; // Defensive check
              if (guestUuid) {
                // Show simple loading feedback if desired later, for now proceeding.
                console.log(`Checking role for guest UUID: ${guestUuid}`);
                const res = await getEventWebLink(guestUuid);
                console.log("Role check response:", res);

                // ⚡⚡⚡ MANAGER REDIRECT LOGIC ⚡⚡⚡
                const role = res?.data?.current_user_role?.toLowerCase();
                if (role === 'manager') {
                  navigation.navigate('ModeSelection' as never, {
                    eventTitle: res.data.title || item.title,
                    eventId: res.data.id || item.id
                  } as never);
                  return;
                }
              } else {
                // console.warn("No guest UUID found for joined event:", item);
              }
            } catch (e) {
              console.log('Error checking manager role:', e);
            }
          }

          navigation.navigate('EventDashboard' as never, { eventData: item } as never);
        }}
      />
    );
  }, [selectedEventId, navigation]);

  // 🔄 Loading UI
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: moderateScale(18), fontWeight: "600" }}>
          Loading events...
        </Text>
      </View>
    );
  }

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/img/common/noguests.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Header with Logout */}
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text style={styles.headingtxt}>Events</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setLogoutModalVisible(true)}
          >
            <Image
              source={require('../../assets/img/common/logout.png')}
              style={styles.logoutIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Confirmation Modal */}
      <Modal
        transparent
        visible={logoutModalVisible}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={async () => {
                  try {
                    await AsyncStorage.clear();
                    console.log('AsyncStorage cleared');
                  } catch (e) {
                    console.error('Error clearing storage:', e);
                  }

                  setLogoutModalVisible(false);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Number' as never }],
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonTextConfirm}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tab Selectors */}
      {/* Tab Selectors (Orange Pill Style) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'joined' && styles.activeTabButton]}
          onPress={() => setActiveTab('joined')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>Joined Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'created' && styles.activeTabButton]}
          onPress={() => setActiveTab('created')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>Created Events</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchField}>
          <Image
            source={{
              uri: "https://img.icons8.com/ios-glyphs/30/9E9E9E/search--v1.png",
            }}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search Event Name"
            placeholderTextColor="#9E9E9E"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Events List */}
      <FlatList
        data={paginatedEvents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={[styles.listContent, paginatedEvents.length === 0 && { flexGrow: 1 }]}
        ListEmptyComponent={renderEmptyComponent}
        style={{ marginTop: verticalScale(15) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8A3C']} />
        }
        // Optimization Props
        // Optimization Props
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => (
          // Fixed height 200 + margin 18 = 218 approx.
          // Adjust to match actual EventCard height + margin
          { length: 218, offset: 218 * index, index }
        )}
      />

      {/* Pagination */}
      <View style={styles.pagination}>
        <TouchableOpacity
          onPress={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
        >
          <Image
            source={require('../../assets/img/common/previous.png')}
            style={[styles.pageIcon, page === 1 && styles.disabledIcon]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>
          {page} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={page === totalPages}
        >
          <Image
            source={require('../../assets/img/common/next.png')}
            style={[styles.pageIcon, page === totalPages && styles.disabledIcon]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
  },
  heading: {
    justifyContent: 'center',
    backgroundColor: '#FF8A3C',
    width: '100%',
    paddingVertical: 20, // Dynamic height based on content + padding
    paddingTop: verticalScale(25), // Keep status bar padding
    borderBottomLeftRadius: scale(15),
    borderBottomRightRadius: scale(15),
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 }, // Fixed shadow
    elevation: 6,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
  },
  headingtxt: {
    color: 'white',
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  logoutIcon: {
    width: scale(23),
    height: scale(23),
    // Removed top: verticalScale(5) to rely on flex alignment
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: scale(20),
    marginTop: 20, // Fixed margin
    borderRadius: scale(20),
    paddingHorizontal: scale(20),
    height: 55, // Fixed height OK for input
    shadowColor: '#999',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowRadius: scale(6),
    elevation: 3,
    gap: scale(12),
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    color: '#333',
    paddingLeft: scale(8),
  },
  searchIcon: {
    width: scale(18),
    height: scale(18),
  },
  listContent: {
    paddingHorizontal: scale(20),
    paddingTop: 18,
    paddingBottom: 90,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(16),
    gap: scale(16),
    paddingBottom: 10,
    backgroundColor: 'white',
    height: 60, // Fixed height container for touch targets
  },
  pageIcon: {
    width: scale(28),
    height: scale(28),
    tintColor: '#FF8A3C',
  },
  disabledIcon: {
    tintColor: '#E0E0E0',
  },
  pageIndicator: {
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyImage: {
    width: scale(220),
    height: scale(220),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(24),
    width: '100%',
    maxWidth: scale(340),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 8,
  },
  modalTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: verticalScale(12),
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: moderateScale(15),
    color: '#6F6F6F',
    textAlign: 'center',
    marginBottom: verticalScale(24),
    lineHeight: moderateScale(22),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: scale(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF8A3C',
  },
  modalButtonTextCancel: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#6F6F6F',
  },
  modalButtonTextConfirm: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: verticalScale(15),
    marginHorizontal: scale(20),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(4),
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowRadius: scale(4),
  },
  tabButton: {
    flex: 1,
    paddingVertical: verticalScale(10), // Increased padding for pill shape
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#FF8A3C',
  },
  tabText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#FF8A3C', // Inactive text is orange
  },
  activeTabText: {
    color: '#FFFFFF', // Active text is white
  },
})


export default EventListing

