import React, { useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from "react-native";
import { FontSize } from "../constants/fontSizes";
import { useScale } from "../utils/useScale";

type GridProps = {
  icon: ImageSourcePropType;
  title: string;
  value: string;
  onPress?: () => void;
  showArrow?: boolean;
  disabled?: boolean;
};

const Grid = ({ icon, title, value, onPress, showArrow = true, disabled = false }: GridProps) => {
  const { scale, verticalScale, moderateScale } = useScale();
  const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale), [scale, verticalScale, moderateScale]);

  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.disabledCard]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <Image source={icon} style={[styles.icon, disabled && styles.disabledImage]} resizeMode="contain" />
        <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
      </View>
      <Text style={[styles.value, disabled && styles.disabledText]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>

      {onPress && showArrow && !disabled && (
        <Image
          source={require("../assets/img/common/forwardarrow.png")}
          style={styles.arrow}
          resizeMode="contain"
        />
      )}
    </TouchableOpacity>
  );
};

export default Grid;

const makeStyles = (scale: (size: number) => number, verticalScale: (size: number) => number, moderateScale: (size: number, factor?: number) => number) => StyleSheet.create({
  card: {
    minHeight: verticalScale(90),
    backgroundColor: "white",
    width: '100%', // Flexible width
    borderRadius: moderateScale(12),
    borderColor: "#EDEDED",
    borderWidth: 1,
    padding: moderateScale(12),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: verticalScale(2),
    },
    shadowOpacity: 0.1,
    shadowRadius: scale(3),
    elevation: 3,
    justifyContent: 'space-between'
  },
  disabledCard: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    elevation: 0,
    shadowOpacity: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: 'center',
    marginBottom: verticalScale(4)
  },
  icon: {
    height: scale(20),
    width: scale(20),
    marginRight: scale(8),
  },
  title: {
    fontSize: moderateScale(FontSize.sm),
    fontWeight: "500",
    color: '#333'
  },
  value: {
    fontSize: moderateScale(FontSize.xl), // Slightly smaller to prevent overflow
    fontWeight: "700",
    color: "black",
    marginTop: verticalScale(4)
  },
  disabledText: {
    opacity: 0.5,
    color: "#888",
  },
  disabledImage: {
    opacity: 0.5,
    tintColor: "#888",
  },
  arrow: {
    height: scale(24),
    width: scale(24),
    position: 'absolute',
    right: scale(8),
    bottom: verticalScale(8),
  },
});
