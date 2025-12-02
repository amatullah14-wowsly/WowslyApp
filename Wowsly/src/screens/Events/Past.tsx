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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventCard from '../../components/EventCard';
import { getEvents } from '../../api/event';

const Past = () => {
  const navigation = useNavigation<any>();
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]); // Store all fetched events
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const EVENTS_PER_PAGE = 8;

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async (force = false) => {
    if (!force) setLoading(true);
    const res = await getEvents(force);
    const fetchedEvents = res?.data || [];

    setAllEvents(fetchedEvents);
    filterEvents(fetchedEvents, searchQuery);

    setLoading(false);
    setRefreshing(false);
  };

  const filterEvents = (sourceEvents: any[], query: string) => {
    // Filter: Show only Past events (End Date < Today)
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const filtered = sourceEvents.filter((event: any) => {
      if (!event.end_date) return false;
      const endDate = event.end_date.split('T')[0];

      // Search Filter
      const matchesSearch = event.title?.toLowerCase().includes(query.toLowerCase());

      return endDate < today && matchesSearch;
    });

    setEvents(filtered);
    setPage(1); // Reset to first page on filter
  };

  // Re-run filter when searchQuery changes
  useEffect(() => {
    filterEvents(allEvents, searchQuery);
  }, [searchQuery]);

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
        onPress={() => {
          setSelectedEventId(item.id);
          navigation.navigate('EventDashboard' as never, { eventData: item } as never);
        }}
      />
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
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
      <Text style={{ fontSize: 16, color: '#888', marginTop: 10 }}>No past events found</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text style={styles.headingtxt}>Past Events</Text>
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
        <View style={styles.filterIcon}>
          <View style={styles.filterBar} />
          <View style={[styles.filterBar, styles.filterBarShort]} />
          <View style={[styles.filterBar, styles.filterBarShortest]} />
        </View>
      </View>

      <FlatList
        data={paginatedEvents}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={renderCard}
        extraData={selectedEventId}
        contentContainerStyle={[styles.listContent, paginatedEvents.length === 0 && { flexGrow: 1 }]}
        ListEmptyComponent={renderEmptyComponent}
        style={{ marginTop: 15 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8A3C']} />
        }
      />

      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
          onPress={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}>
          <Text style={[styles.pageButtonText, page === 1 && styles.pageButtonTextDisabled]}>
            {'<'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicator}>{page} / {totalPages}</Text>
        <TouchableOpacity
          style={[styles.pageButton, page === totalPages && styles.pageButtonDisabled]}
          onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={page === totalPages}>
          <Text style={[styles.pageButtonText, page === totalPages && styles.pageButtonTextDisabled]}>
            {'>'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Past;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
  },
  heading: {
    justifyContent: 'center',
    backgroundColor: '#FF8A3C',
    width: '100%',
    height: '10%',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 6,
  },
  headingtxt: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  logoutIcon: {
    width: 23,
    height: 23,
    top: 5,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 55,
    shadowColor: '#999',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
    gap: 12,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingLeft: 8,
  },
  searchIcon: {
    width: 18,
    height: 18,
  },
  filterIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FF8A3C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  filterBar: {
    width: 14,
    height: 2,
    backgroundColor: 'white',
    borderRadius: 2,
  },
  filterBarShort: {
    width: 10,
  },
  filterBarShortest: {
    width: 6,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 90,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 4,
    backgroundColor: 'white',
  },
  pageButton: {
    backgroundColor: '#FF8A3C',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pageButtonDisabled: {
    backgroundColor: '#FFD2B3',
  },
  pageButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  pageButtonTextDisabled: {
    color: '#7A7A7A',
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
    width: 220,
    height: 220,
  },
});