import { Text, View } from 'react-native'
import React, { Component, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native';
import StackNavigation from './src/navigation/StackNavigation';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/ToastConfig';

const App = () => {
  useEffect(() => {
    SystemNavigationBar.stickyImmersive();
  }, []);

  return (
    <NavigationContainer>
      <StackNavigation />
      <Toast config={toastConfig} />
    </NavigationContainer>
  )
}
export default App;