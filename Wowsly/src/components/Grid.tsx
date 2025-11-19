import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from "react-native";

type GridProps = {
  icon: ImageSourcePropType;
  title: string;
  value: string;
  onPress?: () => void;
};

const Grid = ({ icon, title, value, onPress }: GridProps) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <Image source={icon} style={styles.icon} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>

      <Image
        source={require("../assets/img/common/forwardarrow.png")}
        style={styles.arrow}
      />
    </TouchableOpacity>
  );
};

export default Grid;

const styles = StyleSheet.create({
  card: {
    height: 80,
    backgroundColor: "white",
    width: 145,
    borderRadius: 8,
    borderColor: "#EDEDED",
    borderWidth: 1,
    padding: 8,
  },
  row: {
    flexDirection: "row",
    gap: 5,
  },
  icon: {
    height: 20,
    width: 20,
  },
  title: {
    fontSize: 12,
    fontWeight: "500",
  },
  value: {
    fontSize: 25,
    fontWeight: "700",
    marginLeft: 5,
    color: "black",
  },
  arrow: {
    height: 30,
    width: 30,
    alignSelf: "flex-end",
    bottom: 14,
  },
});
