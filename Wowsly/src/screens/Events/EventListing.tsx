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
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from "react";
import EventCard from "../../components/EventCard";
import { useNavigation } from "@react-navigation/native";
import { getEvents } from "../../api/event";

const EventListing = () => {
  const navigation = useNavigation<any>();

  // 🔥 Live events from API
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const EVENTS_PER_PAGE = 8;

  // 🔥 Fetch Events from Backend
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const res = await getEvents();
    const allEvents = res?.data || [];
    console.log('Fetched events count:', allEvents.length);
    if (allEvents.length > 0) {
      console.log('First event title:', allEvents[0].title);
      console.log('First event ID:', allEvents[0].id);
    }

    // Filter: Show only "current" events (events happening today)
    // Current = event has started AND not yet ended (inclusive of today)
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const filteredEvents = allEvents.filter((event: any) => {
      const startDate = event.start_date ? event.start_date.split('T')[0] : null;
      const endDate = event.end_date ? event.end_date.split('T')[0] : null;

      if (!startDate || !endDate) return false;

      return startDate <= today && endDate >= today;
    });

    setEvents(filteredEvents);
    setLoading(false);
  };

  // Pagination
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);

  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * EVENTS_PER_PAGE;
    return events.slice(startIndex, startIndex + EVENTS_PER_PAGE);
  }, [events, page]);

  const renderCard = ({ item }: { item: any }) => {
    const isSelected = item.id === selectedEventId;

    // Fallback image if API doesn't provide one
    const imageSource =
      item.event_main_photo &&
        item.event_main_photo !== "" &&
        item.event_main_photo !== "null"
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
          navigation.navigate('EventDashboard' as never, { eventData: item } as never);
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

  // 🌀 Empty state UI when there are no current events
  if (!loading && events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={require('../../assets/img/common/noguests.png')}
          style={styles.emptyImage}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Header with Logout */}
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text style={styles.headingtxt}>Current Events</Text>
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
    height: '10%',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#FF8A3C',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 6,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headingtxt: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6F6F6F',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#6F6F6F',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})


export default EventListing

