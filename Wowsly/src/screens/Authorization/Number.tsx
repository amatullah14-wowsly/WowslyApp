import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image } from 'react-native'
import React, { useState } from 'react'
import { useNavigation } from '@react-navigation/native';
import { CountryPicker } from 'react-native-country-codes-picker';

const Number = () => {
  const [selectedCode, setSelectedCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.mainbox}>
        <View>
          <Image
            source={require('../../assets/img/common/logo.png')}
            style={styles.logo}
          />
        </View>
        <View style={styles.heading}>
          <Text style={styles.headingText}>Welcome to Wowsly</Text>
          <Text style={styles.organizer}>Organizer</Text>
        </View>
        <View>
          <Text style={styles.manage}>Manage events & check-ins on the go</Text>
        </View>
        <View style={styles.number}>
          <Text style={styles.mobile}>Mobile Number</Text>
          <View style={styles.inputContainer}>
            {/* make code box clickable to open picker - UI stays visually same */}
            <TouchableOpacity
              style={styles.codeBox}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.codeText}>{selectedCode}</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Enter your 10-digit number"
              placeholderTextColor="#A0A0A0"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <Text style={styles.infoText}>You’ll receive a 6-digit code via SMS</Text>
        </View>
        <TouchableOpacity style={styles.button}
          onPress={() => navigation.navigate('Otp')}>
          <Text style={styles.buttonText}>Send OTP</Text>
        </TouchableOpacity>
      </View>

      {/* Keeper footer unchanged */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Need help?</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.footerText}>Privacy</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.footerText}>Terms</Text>
      </View>

      {/* Country picker modal - keep it at bottom of JSX */}
      <CountryPicker
        show={showPicker}
        pickerButtonOnPress={(item) => {
          // item.dial_code typically like "+91"
          if (item?.dial_code) setSelectedCode(item.dial_code);
          setShowPicker(false);
        }}
        onBackdropPress={() => setShowPicker(false)}
      />
    </View>
  )
}

// (your styles unchanged)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
  },
  mainbox: {
    width: '90%',
    height: '42%',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 38,
  },
  heading: {
    gap: 4,
    color: '#000',
    flexDirection: 'column',
    // justifyContent:'center',
    alignItems: 'center',
  },
  headingText: {
    fontWeight: '800',
    fontSize: 25,
    top: '14%',
  },
  organizer: {
    fontWeight: '800',
    fontSize: 25,
  },
  manage: {
    color: 'grey',
    fontSize: 12,
    top: '12%',
  },
  number: {
    alignSelf: 'flex-start',
    marginLeft: '8%',
    top: '6%',
  },
  mobile: {
    color: 'black',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 15,
    paddingHorizontal: 16,
    marginTop: 10,
    width: '90%',
    height: '30%',
    backgroundColor: '#fff'
  },
  codeBox: {
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0'
  },
  codeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  input: {
    flex: 1,
    paddingLeft: 16,
    fontSize: 15,
    color: '#000'
  },
  infoText: {
    color: '#7E7E7E',
    fontSize: 12,
    top: '5%',

  },
  button: {
    bottom: '1%',
    width: '85%',
    height: '14%',
    borderRadius: 15,
    backgroundColor: '#FF8A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    top: 90,

  },
  footerText: {
    color: '#7E7E7E',
    fontSize: 13
  },
  dot: {
    color: '#7E7E7E',
    fontSize: 13,
    marginHorizontal: 6
  }
});

export default Number
