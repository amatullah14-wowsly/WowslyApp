import { Text, View } from 'react-native'
import React, { Component, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native';
import StackNavigation from './src/navigation/StackNavigation';
import SystemNavigationBar from 'react-native-system-navigation-bar';


const App = () => {
  useEffect(() => {
    SystemNavigationBar.stickyImmersive();
  }, []);

  return (
    <NavigationContainer>
      <StackNavigation />
    </NavigationContainer>
  )
}
export default App;