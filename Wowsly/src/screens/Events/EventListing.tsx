import { FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React, { useMemo, useState } from 'react'

const EventListing = () => {
  const events = useMemo(() => [
    {
      id: '1',
      title: 'Annual Tech Summit 2024',
      date: 'Oct 26, 2024 • 9:00 AM',
      location: 'Grand Convention Center',
      image: 'https://images.unsplash.com/photo-1515169067865-5387ec356754?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '2',
      title: 'Summer Music Festival',
      date: 'Nov 02, 2024 • 12:00 PM',
      location: 'City Park Amphitheater',
      image: 'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '3',
      title: 'Art & Design Expo',
      date: 'Nov 15, 2024 • 10:00 AM',
      location: 'Metropolitan Art Gallery',
      image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '4',
      title: 'Business Networking Night',
      date: 'Nov 20, 2024 • 6:00 PM',
      location: 'Downtown Convention Hall',
      image: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '5',
      title: 'Startup Pitch Day',
      date: 'Nov 28, 2024 • 2:30 PM',
      location: 'Innovation Hub',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '6',
      title: 'Health & Wellness Forum',
      date: 'Dec 02, 2024 • 11:00 AM',
      location: 'Lakeside Resort',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '7',
      title: 'AI & Robotics Conference',
      date: 'Dec 10, 2024 • 9:30 AM',
      location: 'TechSphere Arena',
      image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '8',
      title: 'Creative Writing Retreat',
      date: 'Dec 18, 2024 • 8:00 AM',
      location: 'Harborview Lodge',
      image: 'https://images.unsplash.com/photo-1487700160041-babef9c3cb55?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '9',
      title: 'Culinary Masters Workshop',
      date: 'Jan 05, 2025 • 1:00 PM',
      location: 'Heritage Culinary School',
      image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=60',
    },
    {
      id: '10',
      title: 'Photography Walkabout',
      date: 'Jan 12, 2025 • 4:00 PM',
      location: 'Riverside Promenade',
      image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=60',
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
      <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedEventId(item.id)}>
        <View style={[styles.card, isSelected && styles.cardSelected]}>
          <Image source={{ uri: item.image }} style={styles.cardImage} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{item.date}</Text>
            <Text style={styles.cardLocation}>{item.location}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
        <StatusBar hidden />
        <View style={styles.heading}>
            <Text style={styles.headingtxt}>Wowsly Events</Text>
        </View>
        <View style={styles.searchWrapper}>
          <View style={styles.searchField}>
            <Image
              source={{ uri: 'https://img.icons8.com/ios-glyphs/30/9E9E9E/search--v1.png' }}
              style={styles.searchIcon}
            />
            <TextInput placeholder="Search Event Name" placeholderTextColor="#9E9E9E" style={styles.searchInput} />
          </View>
          <View style={styles.filterIcon}>
            <View style={styles.filterBar} />
            <View style={[styles.filterBar, styles.filterBarShort]} />
            <View style={[styles.filterBar, styles.filterBarShortest]} />
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

const styles = StyleSheet.create({
container:{
    backgroundColor:'#F7F7F7',
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
filterIcon:{
    width:30,
    height:30,
    borderRadius:8,
    backgroundColor:'#FF8A3C',
    alignItems:'center',
    justifyContent:'center',
    gap:3,
},
filterBar:{
    width:14,
    height:2,
    backgroundColor:'white',
    borderRadius:2,
},
filterBarShort:{
    width:10,
},
filterBarShortest:{
    width:6,
},
listContent:{
    paddingHorizontal:20,
    paddingTop:18,
    paddingBottom:90,
},
card:{
    backgroundColor:'white',
    borderRadius:24,
    marginBottom:18,
    borderWidth:1,
    borderColor:'#FFE0CC',
},
cardSelected:{
    borderColor:'#FF8A3C',
},
cardImage:{
    width:'100%',
    height:100,
    borderTopLeftRadius:24,
    borderTopRightRadius:24,
},
cardContent:{
    padding:18,
    gap:8,
},
cardTitle:{
    fontSize:17,
    fontWeight:'700',
    color:'#1C1C1C',
},
cardMeta:{
    fontSize:14,
    color:'#6F6F6F',
},
cardLocation:{
    fontSize:12,
    color:'#383838',
},
pagination:{
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    gap:16,
    paddingBottom:20,
},
pageButton:{
    backgroundColor:'#FF8A3C',
    paddingHorizontal:20,
    paddingVertical:10,
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


export default EventListing

