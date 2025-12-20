import React, { useEffect, useRef } from 'react';
import { View, Image, ImageBackground, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { initDB } from '../../db';
import { scale } from '../../utils/scaling';

import AsyncStorage from '@react-native-async-storage/async-storage';

const Splash = () => {

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<any>();

  useEffect(() => {
    const startApp = async () => {
      const animPromise = new Promise<void>(resolve => {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => resolve());
      });

      const dbPromise = initDB().catch(err => console.error('DB Init Failed:', err));
      const tokenPromise = AsyncStorage.getItem("auth_token");

      const [_, __, token] = await Promise.all([animPromise, dbPromise, tokenPromise]);

      if (token) {
        navigation.replace('BottomNav');
      } else {
        navigation.replace('Number');
      }
    };

    startApp();
  }, []);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/img/splash/Splashbg.jpg')}
        style={styles.image}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Image
            source={require('../../assets/img/common/wowsly.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: scale(200),
    height: scale(200),
  },
});

export default Splash;
