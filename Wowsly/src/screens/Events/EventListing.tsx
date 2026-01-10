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
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from 'react-native-fast-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontSize } from '../../constants/fontSizes';
import { useScale } from '../../utils/useScale';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import React, { useEffect, useMemo, useState, useCallback } from "react";
import EventCard from "../../components/EventCard";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  getEventsPage,
  getEventWebLink
} from "../../api/event";
import Pagination from '../../components/Pagination';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import { EventDashboardContent } from './EventDashboard'; // Import refactored content

const EventListing = () => {
  const navigation = useNavigation<any>();

  // Use Dynamic Scaling
  const { width } = useWindowDimensions();
  const { scale, verticalScale, moderateScale } = useScale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

  // Foldable Logic
  const isFoldable = width >= 600;
  const isTablet = width >= 720;

  // Responsive Grid Logic
  // List is always 1 column (vertical list), whether on Phone or in Left Panel of Foldable
  const numColumns = 1;
  const listKey = `event-list-${numColumns}`;

  // 🔥 Live events from API
  const [events, setEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]); // Store all fetched events
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false); // Track background fetching
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventRole, setSelectedEventRole] = useState<string | null>(null); // For Split View

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

      // Select first event by default on Foldable if not selected
      if (isFoldable && initialEvents.length > 0 && !selectedEventId) {
        // We might want to select the first one, but let's wait for user interaction or select first IF we want auto-select.
        // User guidelines often suggest "Empty state" until selected, but "Select an event" is implemented in DashboardContent.
      }

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
      const lowerQuery = query.toLowerCase();
      const matchesSearch = event.title?.toLowerCase().includes(lowerQuery) || event.id?.toString().includes(query);

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
      <View style={{ width: '100%' }}>
        <EventCard
          title={item.title}
          date={item.start_date_display || "No Date"}
          location={item.address || item.city || "—"}
          image={imageSource}
          isPlaceholder={!item.event_main_photo || item.event_main_photo === ""}
          selected={isSelected} // Highlight if selected in Split View
          style={isFoldable && isSelected ? { borderColor: '#FF8A3C', borderWidth: 2 } : undefined}
          onPress={async () => {

            let role = null;

            if (activeTab === 'joined') {
              try {
                const guestUuid = item.guest_uuid || item.uuid; // Defensive check
                if (guestUuid) {
                  const res = await getEventWebLink(guestUuid);
                  role = res?.data?.current_user_role?.toLowerCase();
                }
              } catch (e) {
                console.log('Error checking manager role:', e);
              }
            }

            if (isFoldable) {
              // Split View: update state
              setSelectedEventId(item.id);
              setSelectedEventRole(role);
            } else {
              // Phone View: navigate
              setSelectedEventId(item.id); // Valid for optimistic UI 
              navigation.navigate('EventDashboard' as never, { eventData: item, userRole: role } as never);
            }
          }}
        />
      </View>
    );
  }, [selectedEventId, navigation, activeTab, isFoldable]);

  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#FF8A3C" />
          <Text style={{ marginTop: 10, color: '#999' }}>Loading Events...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={require('../../assets/img/common/noguests.png')}
          style={styles.emptyImage}
          resizeMode="contain"
        />
      </View>
    );
  };

  // RENDER HELPERS
  const renderListPanel = () => (
    <View style={[styles.listPanel, isFoldable && styles.leftPanelFoldable]}>
      {/* Tab Selectors */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'joined' && styles.activeTabButton]}
          onPress={() => {
            setActiveTab('joined');
            setPage(1);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
            Joined Events
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'created' && styles.activeTabButton]}
          onPress={() => {
            setActiveTab('created');
            setPage(1);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>
            Created Events
          </Text>
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

      {/* EVENT LIST */}
      <FlatList
        key={listKey}
        numColumns={numColumns}
        data={paginatedEvents}
        renderItem={renderCard}
        contentContainerStyle={[styles.listContent, paginatedEvents.length === 0 && { flexGrow: 1 }]}
        ListEmptyComponent={renderEmptyComponent}
        style={{ marginTop: verticalScale(15), flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8A3C']} />
        }
        // Optimization Props
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => (
          { length: verticalScale(218), offset: verticalScale(218) * index, index }
        )}
        ListFooterComponent={
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        }
      />
    </View>
  );

  return (
    <ResponsiveContainer maxWidth={isTablet ? 900 : (isFoldable ? "100%" : 420)}>
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusBar hidden />

        {/* Header with Logout - Always visible at top */}
        <View style={[styles.heading, { paddingTop: insets.top }]}>
          <View style={styles.headingRow}>
            <Text style={styles.headingtxt}>Wowsly</Text>
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
                      console.log('Failed to clear async storage');
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

        {/* MAIN CONTENT AREA */}
        <View style={{ flex: 1, flexDirection: isFoldable ? 'row' : 'column' }}>

          {/* LEFT PANEL (List) */}
          {renderListPanel()}

          {/* RIGHT PANEL (Dashboard) - Only on Foldable */}
          {isFoldable && (
            <View style={styles.rightPanelFoldable}>
              <EventDashboardContent
                eventId={selectedEventId || undefined}
                eventData={events.find(e => e.id === selectedEventId)}
                userRole={selectedEventRole || undefined}
                isSplitView={true}
              />
            </View>
          )}

        </View>

      </SafeAreaView>
    </ResponsiveContainer>
  );
};
export default EventListing;

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, width: number) => StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
  },
  listPanel: {
    flex: 1,
    backgroundColor: 'white',
  },
  leftPanelFoldable: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  rightPanelFoldable: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  heading: {
    justifyContent: 'center',
    backgroundColor: '#FF8A3C',
    width: '100%',
    paddingVertical: width >= 600 ? 15 : moderateScale(20),

    // paddingTop: width >= 600 ? 15 : verticalScale(25), // Handled by insets now

    borderBottomLeftRadius: moderateScale(20), // Removed radius for seamless split view usually, or keep if designed
    borderBottomRightRadius: moderateScale(20),
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: verticalScale(6) },
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
    fontSize: moderateScale(FontSize.xl),
    fontWeight: '700',
  },
  logoutIcon: {
    width: width >= 600 ? 22 : scale(23),
    height: width >= 600 ? 22 : scale(23),
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: width >= 600 ? 20 : scale(20),
    marginTop: verticalScale(20),
    borderRadius: width >= 720 ? 8 : (width >= 600 ? 16 : scale(20)),
    paddingHorizontal: scale(20),
    height: verticalScale(55),
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
    fontSize: moderateScale(FontSize.md),
    color: '#333',
    paddingLeft: scale(8),
  },
  searchIcon: {
    width: width >= 600 ? 16 : scale(18),
    height: width >= 600 ? 16 : scale(18),
  },
  listContent: {
    paddingHorizontal: width >= 600 ? 20 : scale(20),
    paddingTop: verticalScale(18),
    paddingBottom: verticalScale(20),
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: width >= 600 ? 16 : scale(16),
    backgroundColor: 'transparent',
    height: width >= 600 ? 70 : verticalScale(60),
    marginBottom: verticalScale(10),
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
    width: width >= 600 ? 200 : scale(220),
    height: width >= 600 ? 200 : scale(220),
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
    borderRadius: width >= 600 ? 22 : moderateScale(20),
    padding: moderateScale(24),
    width: '100%',
    maxWidth: scale(340),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 8,
  },
  modalTitle: {
    fontSize: moderateScale(FontSize.xl),
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: verticalScale(12),
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: moderateScale(FontSize.md),
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
    borderRadius: width >= 600 ? 10 : moderateScale(12),
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
    fontSize: moderateScale(FontSize.md),
    fontWeight: '600',
    color: '#6F6F6F',
  },
  modalButtonTextConfirm: {
    fontSize: moderateScale(FontSize.md),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: verticalScale(20),
    marginHorizontal: width >= 600 ? 20 : scale(20),
    backgroundColor: '#FFFFFF',
    borderRadius: width >= 600 ? 10 : scale(12),
    padding: width >= 600 ? 4 : scale(4),
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
    paddingVertical: verticalScale(10),
    borderRadius: width >= 600 ? 10 : scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#FF8A3C',
  },
  tabText: {
    fontSize: moderateScale(FontSize.sm),
    fontWeight: '600',
    color: '#FF8A3C',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
});
