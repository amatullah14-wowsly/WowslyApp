import { Text, View } from 'react-native'
import React, { Component } from 'react'
import { NavigationContainer } from '@react-navigation/native';
import StackNavigation from './src/navigation/StackNavigation';

const App = () => {
  return (
<NavigationContainer>
  <StackNavigation />
</NavigationContainer>
  )
}
export default App;