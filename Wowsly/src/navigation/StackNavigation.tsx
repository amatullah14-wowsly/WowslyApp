import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Splash from '../screens/Splash/Splash';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Number from '../screens/Authorization/Number';
import Otp from '../screens/Authorization/Otp';
import EventListing from '../screens/Events/EventListing';
import BottomNavigation from './BottomNavigation';
import EventDashboard from '../screens/Events/EventDashboard';
const Stack = createNativeStackNavigator();
const StackNavigation = () => {
  return (
<Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash" component={Splash} />
    <Stack.Screen name="Number" component={Number} />
    <Stack.Screen name='Otp' component={Otp}/>
    <Stack.Screen name='EventListing' component={EventListing}/>
    <Stack.Screen name="BottomNav" component={BottomNavigation} />
    <Stack.Screen name='EventDashboard' component={EventDashboard}/>

    
</Stack.Navigator>
  )
}

export default StackNavigation

