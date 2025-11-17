import React, { useEffect, useRef } from 'react';
import { View, Image, ImageBackground, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Splash = () => {

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 3500,   // slow fade
      useNativeDriver: true,
    }).start(() => {
      // 🔥 Runs AFTER fade is complete
        navigation.replace('Number');  
    });
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
    width: 200,
    height: 200,
  },
});

export default Splash;
