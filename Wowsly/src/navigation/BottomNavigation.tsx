import React from "react";
import { Image } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import EventListing from "../screens/Events/EventListing";
import Past from "../screens/Events/Past";

const Tab = createBottomTabNavigator();

const BottomNavigation = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    let iconSource;
                    if (route.name === "Events") {
                        iconSource = require('../assets/img/bottombar/current.png');
                    } else if (route.name === "Past") {
                        iconSource = require('../assets/img/bottombar/past.png');
                    }
                    return (
                        <Image
                            source={iconSource}
                            style={{
                                width: 20,
                                height: 20,
                                tintColor: color,
                                resizeMode: 'contain'
                            }}
                        />
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
            <Tab.Screen name="Events" component={EventListing} />
            <Tab.Screen name="Past" component={Past} />
        </Tab.Navigator>
    );
};

export default BottomNavigation;