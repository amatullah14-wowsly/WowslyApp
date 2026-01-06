import React from "react";
import { View, useWindowDimensions } from "react-native";

export const TabletWidthLimiter = ({ children }: any) => {
    const { width } = useWindowDimensions();

    if (width < 720) return children;

    return (
        <View style={{ maxWidth: 1000, width: "100%", alignSelf: "center" }}>
            {children}
        </View>
    );
};
