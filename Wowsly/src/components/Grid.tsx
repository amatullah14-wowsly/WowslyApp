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
};

const Grid = ({ icon, title, value, onPress, showArrow = true }: GridProps) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <Image source={icon} style={styles.icon} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>

      {onPress && showArrow && (
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
  arrow: {
    height: scale(30),
    width: scale(30),
    alignSelf: "flex-end",
    bottom: verticalScale(14),
  },
});
