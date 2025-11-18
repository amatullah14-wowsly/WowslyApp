    import React from "react";
    import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
    import EventListing from "../screens/Events/EventListing";
    import Upcoming from "../screens/Events/Upcoming";
    import Past from "../screens/Events/Past";

    const Tab = createBottomTabNavigator();

    const BottomNavigation = () => {
        return (
            <Tab.Navigator screenOptions={{ headerShown: false }}>
                <Tab.Screen name="Current" component={EventListing} />
                <Tab.Screen name='Upcoming' component={Upcoming} />
                <Tab.Screen name='Past' component={Past} />
            </Tab.Navigator>
        )
    }

    export default BottomNavigation;