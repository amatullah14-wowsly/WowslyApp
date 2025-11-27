import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export type EventCardProps = {
  title: string
  date: string
  location: string
  image: any // Changed to any to support both { uri: string } and require('...')
  selected?: boolean
  onPress?: () => void
}

const EventCard = ({ title, date, location, image, selected, onPress }: EventCardProps) => {

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.card, selected && styles.cardSelected]}>

        <Image source={image} style={styles.cardImage} />

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardMeta}>{date}</Text>
          <Text style={styles.cardLocation}>{location}</Text>
        </View>

      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FFE0CC',
  },
  cardSelected: {
    borderColor: '#FF8A3C',
  },
  cardImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  cardContent: {
    padding: 18,
    // gap: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1C',
  },
  cardMeta: {
    fontSize: 14,
    color: '#6F6F6F',
  },
  cardLocation: {
    fontSize: 12,
    color: '#383838',
  },
})

export default EventCard
