import { FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React, { useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import EventCard from '../../components/EventCard'

const Upcoming = () => {
  const navigation = useNavigation<any>()
  const events = useMemo(() => [
    {
      id: 'u1',
      title: 'Global Innovation Summit 2025',
      date: 'Feb 10, 2025 • 9:00 AM',
      location: 'World Trade Center',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'u2',
      title: 'Winter Music Carnival',
      date: 'Feb 22, 2025 • 6:00 PM',
      location: 'City Park Arena',
      image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'u3',
      title: 'Developers Conference 2025',
      date: 'Mar 05, 2025 • 10:00 AM',
      location: 'TechSphere Arena',
      image: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'u4',
      title: 'Spring Art & Culture Fest',
      date: 'Mar 20, 2025 • 3:00 PM',
      location: 'Metropolitan Art Gallery',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: 'u5',
      title: 'Luxury Food & Wine Expo',
      date: 'Apr 02, 2025 • 1:30 PM',
      location: 'Harborview Convention Center',
      image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=60',
    },
  ], [])

  const [page, setPage] = useState(1)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const EVENTS_PER_PAGE = 8
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE)
  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * EVENTS_PER_PAGE
    return events.slice(startIndex, startIndex + EVENTS_PER_PAGE)
  }, [events, page])

  const renderCard = ({ item }: { item: typeof events[number] }) => {
    const isSelected = item.id === selectedEventId
    return (
      <EventCard
        title={item.title}
        date={item.date}
        location={item.location}
        image={item.image}
        selected={isSelected}
        onPress={() => {
          setSelectedEventId(item.id)
          navigation.navigate('EventDashboard' as never, { eventData: item } as never)
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
        <StatusBar hidden />
        <View style={styles.heading}>
            <Text style={styles.headingtxt}>Upcoming Events</Text>
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
          keyExtractor={(item) => item.id}
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

export default Upcoming;

const styles = StyleSheet.create({
  container:{
      backgroundColor:'white',
      flex:1,
  },
  heading:{
      justifyContent:'center',
      backgroundColor:'#FF8A3C',
      width:'100%',
      height:'9%',
      borderBottomLeftRadius:20,
      borderBottomRightRadius:20,
      shadowColor:'#FF8A3C',
      shadowOpacity:0.2,
      shadowOffset:{width:0,height:6},
      shadowRadius:8,
      elevation:6,
  },
  headingtxt:{
      alignSelf:'center',
      color:'white',
      fontSize:22,
      fontWeight:'700',
      top:'5%',
  },
  searchWrapper:{
      flexDirection:'row',
      alignItems:'center',
      backgroundColor:'white',
      marginHorizontal:20,
      marginTop:20,
      borderRadius:20,
      paddingHorizontal:20,
      height:55,
      shadowColor:'#999',
      shadowOpacity:0.1,
      shadowOffset:{width:0,height:4},
      shadowRadius:6,
      elevation:3,
      gap:12,
  },
  searchField:{
      flexDirection:'row',
      alignItems:'center',
      flex:1,
  },
  searchInput:{
      flex:1,
      fontSize:15,
      color:'#333',
      paddingLeft:8,
  },
  searchIcon:{
      width:18,
      height:18,
  },
  listContent:{
      paddingHorizontal:20,
      paddingTop:18,
      paddingBottom:90,
  },
  pagination:{
      flexDirection:'row',
      justifyContent:'center',
      alignItems:'center',
      gap:16,
      paddingBottom:4,
      backgroundColor:'white',
  },
  pageButton:{
      backgroundColor:'#FF8A3C',
      paddingHorizontal:15,
      paddingVertical:8,
      borderRadius:12,
  },
  pageButtonDisabled:{
      backgroundColor:'#FFD2B3',
  },
  pageButtonText:{
      color:'white',
      fontWeight:'600',
  },
  pageButtonTextDisabled:{
      color:'#7A7A7A',
  },
  pageIndicator:{
      fontWeight:'600',
      color:'#333',
  },
})