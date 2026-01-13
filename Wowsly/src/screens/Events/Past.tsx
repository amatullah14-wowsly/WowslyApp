import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventCard from '../../components/EventCard';
import {
  getEventsPage,
  getEventWebLink
} from '../../api/event';
import Pagination from '../../components/Pagination';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import { useTabletScale, useTabletModerateScale } from '../../utils/tabletScaling';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

import { EventDashboardContent } from './EventDashboard';

const Past = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { scale, verticalScale, moderateScale } = useScale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

  // Foldable Logic
  const isFoldable = width >= 600;
  const isTablet = width >= 720;

  const [events, setEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]); // Store all fetched events
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false); // Track background fetching
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventRole, setSelectedEventRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'joined' | 'created'>('joined');

  const EVENTS_PER_PAGE = 8;

  useEffect(() => {
    fetchEvents();
  }, [activeTab]);

  const fetchEvents = async (force = false) => {
    if (!force) setLoading(true);

    try {
      // ⚡⚡⚡ INCREMENTAL LOADING (COPIED FROM EVENTLISTING) ⚡⚡⚡
      // 1. Fetch Page 1 immediately
      const type = activeTab === 'joined' ? 'join' : 'created';
      const res = await getEventsPage(1, type);
      const initialEvents = res?.data || [];

      setAllEvents(initialEvents);
      filterEvents(initialEvents, searchQuery);
      setLoading(false);
      setRefreshing(false);

      // Select first event by default on Foldable if not selected
      if (initialEvents.length > 0 && isFoldable && !selectedEventId && page === 1) {
        // We need to fetch role for the first selected event if it's 'joined'
        const firstEvent = initialEvents[0];
        setSelectedEventId(firstEvent.id);
        if (activeTab === 'joined' && firstEvent.guest_uuid) {
          getEventWebLink(firstEvent.guest_uuid).then(r => {
            if (r && r.data) setSelectedEventRole(r.data.current_user_role);
          }).catch(console.error);
        }
      }

      // 2. Background Loop
      let currentPage = 1;
      let hasMore = !!(res.next_page_url || (res.meta && res.meta.current_page < res.meta.last_page));
      let accumulatedEvents = [...initialEvents];

      if (hasMore) {
        setFetchingMore(true);
        while (hasMore) {
          currentPage++;
          const nextRes = await getEventsPage(currentPage, type);
          const nextEvents = nextRes?.data || [];

          if (nextEvents.length > 0) {
            const newUnique = nextEvents.filter((n: any) => !accumulatedEvents.some((e: any) => e.id === n.id));
            accumulatedEvents = [...accumulatedEvents, ...newUnique];

            setAllEvents([...accumulatedEvents]);
            // Logic to update filtered list will be handled by useEffect dependency on allEvents
          }

          hasMore = !!(nextRes.next_page_url || (nextRes.meta && nextRes.meta.current_page < nextRes.meta.last_page));
          if (currentPage > 50) hasMore = false;
        }
        setFetchingMore(false);
      }
    } catch (e) {
      console.log('Error fetching past events:', e);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterEvents = (sourceEvents: any[], query: string) => {
    // Filter: Show only Past events (End Date < Today)
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const filtered = sourceEvents.filter((event: any) => {
      // NOTE: Some events might not have end_date, handle accordingly if needed. Assuming past events must have end_date or start_date passed.
      // For stricter checking: if (!event.end_date) return new Date(event.start_date) < date;
      if (!event.end_date) return false;
      const endDate = event.end_date.split('T')[0];

      // Search Filter
      const lowerQuery = query.toLowerCase();
      const matchesSearch = event.title?.toLowerCase().includes(lowerQuery) || event.id?.toString().includes(query);

      return endDate < today && matchesSearch;
    });

    setEvents(filtered);
    setPage(1); // Reset to first page on filter
  };

  // Re-run filter when searchQuery or allEvents changes
  useEffect(() => {
    filterEvents(allEvents, searchQuery);
  }, [searchQuery, allEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents(true);
  };

  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);
  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * EVENTS_PER_PAGE;
    return events.slice(startIndex, startIndex + EVENTS_PER_PAGE);
  }, [events, page]);

  const handleEventPress = async (item: any) => {
    if (isFoldable) {
      setSelectedEventId(item.id);
      setSelectedEventRole(null); // Reset role while fetching
      if (activeTab === 'joined' && item.guest_uuid) {
        try {
          const res = await getEventWebLink(item.guest_uuid);
          if (res && res.data) {
            setSelectedEventRole(res.data.current_user_role);
          }
        } catch (e) { console.error(e); }
      }
    } else {
      // Navigation Logic for Phones
      let role = null;
      if (activeTab === 'joined' && item.guest_uuid) {
        try {
          const res = await getEventWebLink(item.guest_uuid);
          if (res && res.data) {
            role = res.data.current_user_role;
          }
        } catch (e) { console.log(e) }
      }
      navigation.navigate('EventDashboard' as never, { eventData: item, userRole: role } as never);
    }
  };

  const renderCard = ({ item }: { item: any }) => {
    const isSelected = item.id === selectedEventId;

    // Fallback image
    const imageSource =
      item.event_main_photo && item.event_main_photo !== ""
        ? { uri: item.event_main_photo }
        : require('../../assets/img/common/noimage.png');

    return (
      <EventCard
        title={item.title}
        date={item.start_date_display || "No Date"}
        location={item.address || item.city || "—"}
        image={imageSource}
        isPlaceholder={!item.event_main_photo || item.event_main_photo === ""}
        selected={isFoldable ? isSelected : false} // Only show selection border on foldable
        onPress={() => handleEventPress(item)}
      />
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/img/common/noguests.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={{ fontSize: moderateScale(16), color: '#888', marginTop: verticalScale(10) }}>No past events found</Text>
    </View>
  );

  const renderListPanel = () => (
    <SafeAreaView style={[styles.container, isFoldable && styles.leftPanelFoldable]} edges={['left', 'right', 'bottom']}>
      <StatusBar hidden />
      <View style={[styles.heading, { paddingTop: insets.top }]}>
        <View style={styles.headingRow}>
          <Text style={styles.headingtxt}>Wowsly</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={async () => {
              try {
                await AsyncStorage.clear();
                console.log('AsyncStorage cleared');
              } catch (e) {
                console.error('Error clearing storage:', e);
              }
              navigation.reset({
                index: 0,
                routes: [{ name: 'Number' as never }],
              });
            }}
          >
            <Image
              source={require('../../assets/img/common/logout.png')}
              style={styles.logoutIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selectors */}
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

      <View style={styles.searchWrapper}>
        <View style={styles.searchField}>
          <Image
            source={{ uri: 'https://img.icons8.com/ios-glyphs/30/9E9E9E/search--v1.png' }}
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

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: moderateScale(18), fontWeight: "600" }}>
            Loading past events...
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={paginatedEvents}
            keyExtractor={(item: any) => item.id.toString()}
            renderItem={renderCard}
            extraData={selectedEventId}
            contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
            ListEmptyComponent={renderEmptyComponent}
            style={{ marginTop: verticalScale(15) }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8A3C']} tintColor="#FF8A3C" />
            }
            ListFooterComponent={
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            }
            ListFooterComponentStyle={{ flex: 1, justifyContent: 'flex-end' }}
          />
        </>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveContainer maxWidth={isTablet ? 900 : (width >= 600 ? "100%" : 420)}>
      <View style={{ flex: 1, flexDirection: isFoldable ? 'row' : 'column' }}>
        {renderListPanel()}

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
    </ResponsiveContainer>
  );
};

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, width: number) => StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
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
    borderBottomLeftRadius: width >= 600 ? 0 : moderateScale(15), // Removed radius for foldables, moderateScale for phone
    borderBottomRightRadius: width >= 600 ? 0 : moderateScale(15),
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: verticalScale(6) },
    elevation: 6,
  },
  headingtxt: {
    color: 'white',
    fontSize: moderateScale(FontSize.xl),
    fontWeight: '700',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
  },
  logoutIcon: {
    width: width >= 600 ? 22 : moderateScale(23),
    height: width >= 600 ? 22 : moderateScale(23),
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
    shadowRadius: moderateScale(6),
    elevation: 3,
    gap: moderateScale(12),
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(FontSize.md), // 15 -> md (16)
    color: '#333',
    paddingLeft: moderateScale(8),
  },
  searchIcon: {
    width: width >= 600 ? 16 : moderateScale(18),
    height: width >= 600 ? 16 : moderateScale(18),
  },
  listContent: {
    paddingHorizontal: width >= 600 ? 20 : moderateScale(20),
    paddingTop: verticalScale(18),
    paddingBottom: verticalScale(20),
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: width >= 600 ? 16 : moderateScale(16),
    backgroundColor: 'transparent',
    height: width >= 600 ? 70 : verticalScale(60),
    marginBottom: verticalScale(10),
  },
  pageIcon: {
    width: moderateScale(28),
    height: moderateScale(28),
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
    width: width >= 600 ? 200 : moderateScale(220),
    height: width >= 600 ? 200 : moderateScale(220),
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: verticalScale(15),
    marginHorizontal: width >= 600 ? 20 : moderateScale(20),
    backgroundColor: '#FFFFFF',
    borderRadius: width >= 600 ? 10 : moderateScale(12),
    padding: width >= 600 ? 4 : moderateScale(4),
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowRadius: moderateScale(4),
  },
  tabButton: {
    flex: 1,
    paddingVertical: verticalScale(10), // Increased padding for pill shape
    borderRadius: width >= 600 ? 10 : moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#FF8A3C',
  },
  tabText: {
    fontSize: moderateScale(FontSize.sm),
    fontWeight: '600',
    color: '#FF8A3C', // Inactive text is orange
  },
  activeTabText: {
    color: '#FFFFFF', // Active text is white
  },
});

export default Past;