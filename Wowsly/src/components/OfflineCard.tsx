import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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

export default OfflineCard;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 180,
    padding: 16,
    shadowColor: '#D7C5BA',
    elevation: 4,
    marginBottom: 18,
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
    width: 25,
    height: 25,
    marginBottom: 12,
    alignSelf: 'center',
  },
  textBlock: {
    width: '100%',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  meta: {
    fontSize: 10,
    marginTop: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 18,
    borderRadius: 10,
    height: 30,
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7F1',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#FF8A3C',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
});