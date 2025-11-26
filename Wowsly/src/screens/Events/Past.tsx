import { FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import EventCard from '../../components/EventCard'
import { getEvents } from '../../api/event'

const Past = () => {
  const navigation = useNavigation<any>()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const EVENTS_PER_PAGE = 8

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    setLoading(true)
    const res = await getEvents()
    const allEvents = res?.data || []

    // Filter: Show only Past events (End Date < Today)
    const today = new Date().toISOString().split('T')[0]
    const filteredEvents = allEvents.filter((event: any) => {
      return event.end_date < today
    })

    setEvents(filteredEvents)
    setLoading(false)
  }

  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE)
  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * EVENTS_PER_PAGE
    return events.slice(startIndex, startIndex + EVENTS_PER_PAGE)
  }, [events, page])

  const renderCard = ({ item }: { item: any }) => {
    const isSelected = item.id === selectedEventId

    // Fallback image
    const imageUri =
      item.event_main_photo && item.event_main_photo !== ""
        ? item.event_main_photo
        : "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=800&q=60";

    return (
      <EventCard
        title={item.title}
        date={item.start_date_display || "No Date"}
        location={item.address || item.city || "—"}
        image={imageUri}
        selected={isSelected}
        onPress={() => {
          setSelectedEventId(item.id)
          navigation.navigate('EventDashboard' as never, { eventData: item } as never)
        }}
      />
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          Loading past events...
        </Text>
      </View>
    );
  }

  // 🌀 Empty state UI when there are no past events
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
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text style={styles.headingtxt}>Past Events</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Number' as never }],
              })
            }
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
          <TextInput placeholder="Search Event Name" placeholderTextColor="#9E9E9E" style={styles.searchInput} />
        </View>
      </View>
      <FlatList
        data={paginatedEvents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        extraData={selectedEventId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
  )
}

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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
    top:5,
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
})