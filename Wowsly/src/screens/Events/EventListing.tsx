import {
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import EventCard from "../../components/EventCard";
import { useNavigation } from "@react-navigation/native";
import { getEvents } from "../../api/event";

const EventListing = () => {
  const navigation = useNavigation();

  // 🔥 Live events from API
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const EVENTS_PER_PAGE = 8;

  // 🔥 Fetch Events from Backend
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const res = await getEvents();
    setEvents(res?.data || []);
    setLoading(false);
  };

  // Pagination
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);

  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * EVENTS_PER_PAGE;
    return events.slice(startIndex, startIndex + EVENTS_PER_PAGE);
  }, [events, page]);

  const renderCard = ({ item }) => {
    const isSelected = item.id === selectedEventId;

    // Fallback image if API doesn't provide one
    const imageUri =
      item.event_main_photo && item.event_main_photo !== ""
        ? item.event_main_photo
        : "https://images.unsplash.com/photo-1515169067865-5387ec356754?auto=format&fit=crop&w=800&q=60";

    return (
      <EventCard
        title={item.title}
        date={item.start_date_display || "No Date"}
        location={item.address || item.city || "—"}
        image={imageUri}
        selected={isSelected}
        onPress={() => {
          navigation.navigate("EventDashboard", { eventData: item });
        }}
      />
    );
  };

  // 🔄 Loading UI
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          Loading events...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Header */}
      <View style={styles.heading}>
        <Text style={styles.headingtxt}>Wowsly Events</Text>
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
          />
        </View>
        <View style={styles.filterIcon}>
          <View style={styles.filterBar} />
          <View style={[styles.filterBar, styles.filterBarShort]} />
          <View style={[styles.filterBar, styles.filterBarShortest]} />
        </View>
      </View>

      {/* Events List */}
      <FlatList
        data={paginatedEvents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Pagination */}
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
          onPress={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
        >
          <Text
            style={[
              styles.pageButtonText,
              page === 1 && styles.pageButtonTextDisabled,
            ]}
          >
            {"<"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>
          {page} / {totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.pageButton,
            page === totalPages && styles.pageButtonDisabled,
          ]}
          onPress={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={page === totalPages}
        >
          <Text
            style={[
              styles.pageButtonText,
              page === totalPages && styles.pageButtonTextDisabled,
            ]}
          >
            {">"}
          </Text>
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
    height: '9%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 6,
  },
  headingtxt: {
    alignSelf: 'center',
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    top: '5%',
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
})


export default EventListing

