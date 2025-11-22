import { StyleSheet, Text, View, TouchableOpacity, Image, Alert } from 'react-native'
import React, { useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native';
import PhoneNumberInput from 'react-native-phone-number-input';
import { sendOTP } from '../../api/api';  // ✅ API IMPORT

const Number = () => {
  const phoneInput = useRef<PhoneNumberInput>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const navigation = useNavigation<any>();

  // ✅ SEND OTP API INTEGRATION
  const handleSendOTP = async () => {
    const checkValid = phoneInput.current?.isValidNumber(value);
    if (!value || !checkValid) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    setLoading(true);

    const callingCode = phoneInput.current?.getCallingCode() || "91";
    // value should contain just the phone number without country code
    // Remove any spaces or formatting
    const phoneNumber = value.replace(/\s/g, "").replace(/-/g, "").replace(/\(/g, "").replace(/\)/g, "");

    const res = await sendOTP(callingCode, phoneNumber);

    setLoading(false);

    if (res?.status === true) {
      Alert.alert("Success", "OTP sent successfully!");

      // navigate with params
      navigation.navigate("Otp", {
        dialing_code: callingCode,
        mobile: phoneNumber,
      });
    } else {
      Alert.alert("Error", res?.message || "Failed to send OTP");
    }
  };

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
          <PhoneNumberInput
            ref={phoneInput}
            defaultValue={value}
            defaultCode="IN"
            layout="first"
            onChangeText={setValue}
            onChangeFormattedText={(text) => {
              setValue(text);
            }}
            containerStyle={styles.phoneContainer}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={styles.phoneInput}
            codeTextStyle={styles.phoneCodeText}
            flagButtonStyle={styles.phoneFlagButton}
            countryPickerButtonStyle={styles.phoneCountryButton}
            disableArrowIcon={false}
          />
          <Text style={styles.infoText}>You'll receive a 6-digit code via SMS</Text>
        </View>

        {/* SEND OTP BUTTON */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleSendOTP}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Sending..." : "Send OTP"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Need help?</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.footerText}>Privacy</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.footerText}>Terms</Text>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
  },
  mainbox: {
    width: '90%',
    height: '45%',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    gap:5,
  },
  logo: {
    width: 50,
    height: 38,
  },
  heading: {
    gap: 4,
    color: '#000',
    flexDirection: 'column',
    alignItems: 'center',
  },
  headingText: {
    fontWeight: '800',
    fontSize: 25,
    top: '10%',
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
    top: '3%',
  },
  mobile: {
    color: 'black',
  },
  phoneContainer: {
    width: '90%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 50,           // keep ONLY this height
    alignItems: 'center',
  },
  
  phoneTextContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 0,
    height: '100%',       // 🔥 MATCH OUTER HEIGHT
    justifyContent: 'center',
  },
  
  phoneInput: {
    fontSize: 15,
    color: '#000',
    paddingVertical: 0,
  },
  
  phoneCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  phoneFlagButton: {
    marginLeft: 5,
  },
  phoneCountryButton: {
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  infoText: {
    color: '#7E7E7E',
    fontSize: 12,
    top: '5%',
  },
  button: {
  
    width: '85%',
    height: '14%',
    borderRadius: 15,
    backgroundColor: '#FF8A3C',
    alignItems: 'center',
    justifyContent: 'center',
    top: '6%',
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

export default Number;
