import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, ViewStyle } from 'react-native'
import { FontSize } from '../constants/fontSizes'
import { useScale } from '../utils/useScale'
import FastImage from 'react-native-fast-image'

export type EventCardProps = {
  title: string
  date: string
  location: string
  image: any
  selected?: boolean
  onPress?: () => void
  isPlaceholder?: boolean
  style?: ViewStyle
}

const EventCard = ({ title, date, location, image, selected, onPress, isPlaceholder = false, style }: EventCardProps) => {
  const { scale, verticalScale, moderateScale } = useScale();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.card, selected && styles.cardSelected, style]}>
        {/* FastImage acting as Background */}
        <FastImage
          source={image}
          style={[StyleSheet.absoluteFill, isPlaceholder && { backgroundColor: '#F0F0F0', padding: scale(50) }]}
          resizeMode={isPlaceholder ? FastImage.resizeMode.contain : FastImage.resizeMode.cover}
          tintColor={isPlaceholder ? '#FF8A3C' : undefined}
        />

        {/* Overlay Content */}
        <View style={styles.overlay}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{date}</Text>
            <Text style={styles.cardLocation} numberOfLines={1}>{location}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number, width: number) => StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: width >= 600 ? 16 : scale(24),
    marginBottom: verticalScale(18),
    borderWidth: 1,
    borderColor: '#FFE0CC',
    height: verticalScale(200), // Dynamic height
    overflow: 'hidden',
    position: 'relative'
  },
  cardSelected: {
    borderColor: '#FF8A3C',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    borderRadius: width >= 600 ? 16 : scale(24),
  },
  cardContent: {
    padding: width >= 600 ? 12 : scale(18),
  },
  cardTitle: {
    fontSize: width >= 600 ? 18 : moderateScale(FontSize.lg),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: verticalScale(4),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardMeta: {
    fontSize: width >= 600 ? 14 : moderateScale(FontSize.sm),
    color: '#E0E0E0',
    marginTop: verticalScale(2),
    fontWeight: '500',
  },
  cardLocation: {
    fontSize: width >= 600 ? 12 : moderateScale(FontSize.xs),
    color: '#D0D0D0',
    marginTop: verticalScale(2),
  },
})

export default React.memo(EventCard)
