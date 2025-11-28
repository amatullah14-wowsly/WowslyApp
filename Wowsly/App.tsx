import { Text, View } from 'react-native'
import React, { Component, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native';
import StackNavigation from './src/navigation/StackNavigation';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/ToastConfig';
import { initDB } from './src/db';

const App = () => {
  useEffect(() => {
    SystemNavigationBar.stickyImmersive();

    // Initialize SQLite database
    initDB()
      .then(() => console.log('Database initialized successfully'))
      .catch((error) => console.error('Database initialization error:', error));
  }, []);

  return (
    <NavigationContainer>
      <StackNavigation />
      <Toast config={toastConfig} />
    </NavigationContainer>
  )
}
export default App;