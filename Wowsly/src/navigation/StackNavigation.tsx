import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Splash from '../screens/Splash/Splash';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Number from '../screens/Authorization/Number';
import Otp from '../screens/Authorization/Otp';
const Stack = createNativeStackNavigator();
const StackNavigation = () => {
  return (
<Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash" component={Splash} />
    <Stack.Screen name="Number" component={Number} />
    <Stack.Screen name='Otp' component={Otp}/>
</Stack.Navigator>
  )
}

export default StackNavigation

