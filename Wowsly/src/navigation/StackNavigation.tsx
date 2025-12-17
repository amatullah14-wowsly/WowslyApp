import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import Splash from '../screens/Splash/Splash';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Number from '../screens/Authorization/Number';
import Otp from '../screens/Authorization/Otp';
import EventListing from '../screens/Events/EventListing';
import BottomNavigation from './BottomNavigation';
import EventDashboard from '../screens/Events/EventDashboard';
import GuestList from '../screens/Guests/GuestList';
import ManagerGuests from '../screens/Guests/ManagerGuests';
import InvitedGuests from '../screens/Guests/InvitedGuests';
import RegisteredGuests from '../screens/Guests/RegisteredGuests';
import ModeSelection from '../screens/Mode/ModeSelection';
import HostDashboard from '../screens/DashBoards/HostDashboard';
import OfflineDashboard from '../screens/DashBoards/OfflineDashboard';
import QrCode from '../screens/Scanner/QrCode';
import OnlineGuestList from '../screens/GuestList/OnlineGuestList';
import OfflineGuestList from '../screens/GuestList/OfflineGuestList';
import ClientConnection from '../screens/Mode/ClientConnection';
import CheckInRecords from '../screens/Events/CheckInRecords';
import TicketCheckInDetails from '../screens/Events/TicketCheckInDetails';
import TicketsSoldRecords from '../screens/Events/TicketsSoldRecords';
const Stack = createNativeStackNavigator();
const StackNavigation = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={Splash} />
      <Stack.Screen name="Number" component={Number} />
      <Stack.Screen name='Otp' component={Otp} />
      <Stack.Screen name='EventListing' component={EventListing} />
      <Stack.Screen name="BottomNav" component={BottomNavigation} />
      <Stack.Screen name='EventDashboard' component={EventDashboard} />
      <Stack.Screen name='GuestList' component={GuestList} />
      <Stack.Screen name='ManagerGuests' component={ManagerGuests} />
      <Stack.Screen name='InvitedGuests' component={InvitedGuests} />
      <Stack.Screen name='RegisteredGuests' component={RegisteredGuests} />
      <Stack.Screen name='ModeSelection' component={ModeSelection} />
      <Stack.Screen name='HostDashboard' component={HostDashboard} />
      <Stack.Screen name='OfflineDashboard' component={OfflineDashboard} />
      <Stack.Screen name='QrCode' component={QrCode} />
      <Stack.Screen name='OnlineGuestList' component={OnlineGuestList} />
      <Stack.Screen name='OfflineGuestList' component={OfflineGuestList} />
      <Stack.Screen name='ClientConnection' component={ClientConnection} />
      <Stack.Screen name='CheckInRecords' component={CheckInRecords} />
      <Stack.Screen name='TicketCheckInDetails' component={TicketCheckInDetails} />
      <Stack.Screen name='TicketsSoldRecords' component={TicketsSoldRecords} />
      <Stack.Screen name='RegistrationDashboard' component={require('../screens/Events/RegistrationDashboard').default} />


    </Stack.Navigator>
  )
}

export default StackNavigation
