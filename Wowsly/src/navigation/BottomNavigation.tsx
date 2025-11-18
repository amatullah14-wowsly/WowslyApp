import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import EventListing from "../screens/Events/EventListing";
import Upcoming from "../screens/Events/Upcoming";
import Past from "../screens/Events/Past";

const Tab = createBottomTabNavigator();

const BottomNavigation = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    let iconChar = "●";
                    if (route.name === "Current") {
                        iconChar = "📅";
                    } else if (route.name === "Upcoming") {
                        iconChar = "⏳";
                    } else if (route.name === "Past") {
                        iconChar = "🕓";
                    }
                    return (
                        <Text style={{ fontSize: 15, color }}>
                            {iconChar}
                        </Text>
                    );
                },
                tabBarActiveTintColor: "#FF8A3C",
                tabBarInactiveTintColor: "#B0B0B0",
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "600",
                },
                tabBarStyle: {
                    height: 60,
                    paddingBottom: 6,
                    paddingTop: 4,
                },
            })}
        >
            <Tab.Screen name="Current" component={EventListing} />
            <Tab.Screen name="Upcoming" component={Upcoming} />
            <Tab.Screen name="Past" component={Past} />
        </Tab.Navigator>
    );
};

export default BottomNavigation;