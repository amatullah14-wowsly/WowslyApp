import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { scale, verticalScale, moderateScale } from '../utils/scaling';

type OfflineCardProps = {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  meta?: string;
  badge?: string;
  isActive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

const OfflineCard: React.FC<OfflineCardProps> = ({
  icon,
  title,
  subtitle,
  meta,
  badge,
  isActive = false,
  disabled = false,
  onPress,
}) => {
  const [isPressed, setIsPressed] = React.useState(false);
  const active = (isActive || isPressed) && !disabled;

  const cardStyles = [
    styles.card,
    disabled && styles.cardDisabled,
    active && styles.cardActive,
  ];
  const textColor = active ? '#FFFFFF' : '#2B1D16';
  const subtitleColor = active ? 'rgba(255,255,255,0.9)' : '#8E7465';
  const metaColor = active ? 'rgba(255,255,255,0.85)' : '#B79C8F';
  const iconTint = active ? '#FFFFFF' : '#FF8A3C';

  return (
    <TouchableOpacity
      style={cardStyles}
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={disabled}
    >
      <Image source={icon} style={[styles.icon, { tintColor: iconTint }]} />
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: subtitleColor }]}>
          {subtitle}
        </Text>
        {meta ? (
          <Text style={[styles.meta, { color: metaColor }]}>{meta}</Text>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badge, active && styles.badgeActive]}>
          <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
            {badge}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export default React.memo(OfflineCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: scale(20),
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: verticalScale(180),
    padding: scale(16),
    shadowColor: '#000',
    elevation: 5,
    marginBottom: verticalScale(0),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActive: {
    backgroundColor: '#FF8A3C',
    shadowColor: '#FF8A3C',
  },
  cardDisabled: {
    backgroundColor: '#F8F4F2',
    shadowOpacity: 0.08,
    elevation: 0,
  },
  icon: {
    width: scale(25),
    height: scale(25),
    marginBottom: verticalScale(12),
    alignSelf: 'center',
  },
  textBlock: {
    width: '100%',
    gap: verticalScale(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  subtitle: {
    fontSize: moderateScale(13),
    fontWeight: '400',
  },
  meta: {
    fontSize: moderateScale(10),
    marginTop: verticalScale(12),
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: verticalScale(18),
    borderRadius: scale(10),
    height: verticalScale(30),
    width: scale(120),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7F1',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  badgeText: {
    fontSize: moderateScale(10),
    fontWeight: '400',
    color: '#FF8A3C',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
});