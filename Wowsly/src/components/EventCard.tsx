import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ImageBackground } from 'react-native'
import { scale, verticalScale, moderateScale } from '../utils/scaling'

export type EventCardProps = {
  title: string
  date: string
  location: string
  image: any // Changed to any to support both { uri: string } and require('...')
  selected?: boolean
  onPress?: () => void
}

import FastImage from 'react-native-fast-image'

const EventCard = ({ title, date, location, image, selected, onPress }: EventCardProps) => {

  console.log("image:", image)
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.card, selected && styles.cardSelected]}>
        {/* FastImage acting as Background */}
        <FastImage
          source={image}
          style={StyleSheet.absoluteFill}
          resizeMode={FastImage.resizeMode.cover}
        />

        {/* Overlay Content */}
        <View style={styles.overlay}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardMeta}>{date}</Text>
            <Text style={styles.cardLocation}>{location}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: scale(24),
    marginBottom: verticalScale(18),
    borderWidth: 1,
    borderColor: '#FFE0CC',
    height: verticalScale(200), // Fixed height for the card
    overflow: 'hidden',
    position: 'relative' // Ensure relative positioning for absolute children
  },
  cardSelected: {
    borderColor: '#FF8A3C',
  },
  // imageBackground removed as FastImage uses absoluteFill
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    borderRadius: scale(24),
  },
  cardContent: {
    padding: scale(18),
  },
  cardTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardMeta: {
    fontSize: moderateScale(14),
    color: '#E0E0E0',
    marginTop: verticalScale(4),
  },
  cardLocation: {
    fontSize: moderateScale(12),
    color: '#D0D0D0',
    marginTop: verticalScale(2),
  },
})

export default React.memo(EventCard)
