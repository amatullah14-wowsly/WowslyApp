import { Text, View } from 'react-native'
import React, { Component, useEffect } from 'react'
import { enableScreens } from 'react-native-screens';
enableScreens();

import { NavigationContainer } from '@react-navigation/native';
import StackNavigation from './src/navigation/StackNavigation';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/ToastConfig';
import { initDB } from './src/db';
import { initScanStore } from './src/context/ScanStore';
import AsyncStorage from "@react-native-async-storage/async-storage";   // <-- ADD THIS

const App = () => {
  useEffect(() => {
    const setupImmersiveMode = async () => {
      await SystemNavigationBar.stickyImmersive();
    };
    setupImmersiveMode();
    initScanStore();

    // Initialize SQLite database
    initDB()
      .then(() => console.log('Database initialized successfully'))
      .catch((error) => console.error('Database initialization error:', error));

    // ⭐ PRINT AUTH TOKEN FOR DEBUGGING ⭐
    AsyncStorage.getItem("auth_token").then(token => {
      console.log("🔥🔥 AUTH TOKEN:", token);
    });

  }, []);

  return (
    <NavigationContainer>
      <StackNavigation />
      <Toast config={toastConfig} />
    </NavigationContainer>
  )
}
export default App;
