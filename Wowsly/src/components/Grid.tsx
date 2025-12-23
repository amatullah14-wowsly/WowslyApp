import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from "react-native";
import { scale, verticalScale, moderateScale } from "../utils/scaling";

type GridProps = {
  icon: ImageSourcePropType;
  title: string;
  value: string;
  onPress?: () => void;
  showArrow?: boolean;
  disabled?: boolean;
};

const Grid = ({ icon, title, value, onPress, showArrow = true, disabled = false }: GridProps) => {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.disabledCard]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.row}>
        <Image source={icon} style={[styles.icon, disabled && styles.disabledImage]} />
        <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
      </View>
      <Text style={[styles.value, disabled && styles.disabledText]}>{value}</Text>

      {onPress && showArrow && !disabled && (
        <Image
          source={require("../assets/img/common/forwardarrow.png")}
          style={styles.arrow}
        />
      )}
    </TouchableOpacity>
  );
};

export default Grid;

const styles = StyleSheet.create({
  card: {
    height: verticalScale(80),
    backgroundColor: "white",
    width: scale(145),
    borderRadius: scale(8),
    borderColor: "#EDEDED",
    borderWidth: 1,
    padding: scale(8),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: verticalScale(4),
    },
    shadowOpacity: 0.3,
    shadowRadius: scale(4.65),
    elevation: 3,
  },
  disabledCard: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    elevation: 0,
    shadowOpacity: 0,
  },
  row: {
    flexDirection: "row",
    gap: scale(5),
  },
  icon: {
    height: scale(20),
    width: scale(20),
  },
  title: {
    fontSize: moderateScale(12),
    fontWeight: "500",
  },
  value: {
    fontSize: moderateScale(25),
    fontWeight: "700",
    marginLeft: scale(5),
    color: "black",
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
    height: scale(30),
    width: scale(30),
    alignSelf: "flex-end",
    bottom: verticalScale(14),
  },
});
