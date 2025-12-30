import React, { useEffect, useState, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventCard from '../../components/EventCard';
import {
  getEvents,
  getEventsPage,
  getEventWebLink
} from '../../api/event';
import Pagination from '../../components/Pagination';
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';

const Past = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { scale, verticalScale, moderateScale } = useScale();
  const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

  const [events, setEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]); // Store all fetched events
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false); // Track background fetching
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
        selected={isSelected}
        onPress={async () => {
          setSelectedEventId(item.id);
          let role = null;

          if (activeTab === 'joined') {
            try {
              if (item.guest_uuid) {
                const res = await getEventWebLink(item.guest_uuid);
                if (res && res.data) {
                  role = res.data.current_user_role;
                }
              }
            } catch (e) {
              console.log('Error checking manager role in Past:', e);
            }
          }

          navigation.navigate('EventDashboard' as never, { eventData: item, userRole: role } as never);
        }}
      />
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: moderateScale(18), fontWeight: "600" }}>
          Loading past events...
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
      <Text style={{ fontSize: moderateScale(16), color: '#888', marginTop: verticalScale(10) }}>No past events found</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.heading}>
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

      <FlatList
        data={paginatedEvents}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={renderCard}
        extraData={selectedEventId}
        contentContainerStyle={[styles.listContent, paginatedEvents.length === 0 && { flexGrow: 1 }]}
        ListEmptyComponent={renderEmptyComponent}
        style={{ marginTop: verticalScale(15) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8A3C']} />
        }
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </View >
  );
};

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
  },
  heading: {
    justifyContent: 'center',
    backgroundColor: '#FF8A3C',
    width: '100%',
    paddingVertical: 20,
    paddingTop: verticalScale(25), // Add status bar padding
    borderBottomLeftRadius: scale(15),
    borderBottomRightRadius: scale(15),
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headingtxt: {
    color: 'white',
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
  },
  logoutIcon: {
    width: scale(23),
    height: scale(23),
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: scale(20),
    marginTop: 20,
    borderRadius: scale(20),
    paddingHorizontal: scale(20),
    height: 55,
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
    fontSize: moderateScale(FontSize.md), // 15 -> md (16)
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
    paddingBottom: verticalScale(4),
    backgroundColor: 'white',
    paddingBottom: 10,
    height: 60,
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
    fontSize: moderateScale(FontSize.sm),
    fontWeight: '600',
    color: '#FF8A3C', // Inactive text is orange
  },
  activeTabText: {
    color: '#FFFFFF', // Active text is white
  },
});

export default Past;