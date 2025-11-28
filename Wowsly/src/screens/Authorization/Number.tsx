import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native'
import Toast from 'react-native-toast-message';
import React, { useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native';
import PhoneNumberInput from 'react-native-phone-number-input';
import { sendOTP } from '../../api/api';  // ✅ API IMPORT

const Number = () => {
  const phoneInput = useRef<PhoneNumberInput>(null);
  const [value, setValue] = useState("");
  const [sendingVia, setSendingVia] = useState<'whatsapp' | 'sms' | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const navigation = useNavigation<any>();

  const triggerOtp = async (method: 'whatsapp' | 'sms') => {
    const checkValid = phoneInput.current?.isValidNumber(value);
    if (!value || !checkValid) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid phone number'
      });
      return;
    }

    if (!acceptedTerms) {
      Toast.show({
        type: 'error',
        text1: 'Terms Required',
        text2: 'Please accept the Terms & Conditions to proceed.'
      });
      return;
    }

    setSendingVia(method);

    const callingCode = phoneInput.current?.getCallingCode() || "91";
    const phoneNumber = value
      .replace(/\D/g, ""); // Remove all non-numeric characters

    console.log("Sending OTP with:", { callingCode, phoneNumber, originalValue: value, method });

    try {
      const res = await sendOTP(callingCode, phoneNumber, method);

      if (res?.status_code === 200) {
        console.log("OTP Sent Successfully, navigating to Otp screen with:", { callingCode, phoneNumber, method });
        const channelLabel = method === 'sms' ? 'SMS' : 'WhatsApp';

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `OTP sent via ${channelLabel}!`
        });

        navigation.navigate("Otp", {
          dialing_code: callingCode,
          mobile: phoneNumber,
        });

      } else {
        console.log("OTP Send Failed:", res);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: res?.message || "Failed to send OTP"
        });
      }
    } catch (error) {
      console.log("OTP Send Failed:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: "Failed to send OTP"
      });
    } finally {
      setSendingVia(null);
    }
  };

  // ✅ SEND OTP API INTEGRATION
  const handleSendOTP = () => triggerOtp('whatsapp');
  const handleSendSMS = () => triggerOtp('sms');

  const isWhatsAppLoading = sendingVia === 'whatsapp';
  const isSmsLoading = sendingVia === 'sms';
  const isSending = sendingVia !== null;
  const isSendOtpDisabled = isSending || !acceptedTerms;

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
            containerStyle={styles.phoneContainer}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={styles.phoneInput}
            codeTextStyle={styles.phoneCodeText}
            flagButtonStyle={styles.phoneFlagButton}
            countryPickerButtonStyle={styles.phoneCountryButton}
            disableArrowIcon={false}
          />
          <View style={styles.smsPrompt}>
            <Text style={styles.smsPromptLabel}>Not using WhatsApp?</Text>
            <TouchableOpacity onPress={handleSendSMS} disabled={isSending}>
              <Text style={[styles.smsPromptAction, isSmsLoading && styles.smsPromptDisabled]}>
                {isSmsLoading ? "Sending..." : "Send SMS"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TERMS CHECKBOX */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAcceptedTerms((prev) => !prev)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms && <View style={styles.checkboxIndicator} />}
          </View>
          <Text style={styles.checkboxLabel}>I agree to the Terms & Conditions</Text>
        </TouchableOpacity>

        {/* SEND OTP BUTTON */}
        <TouchableOpacity
          style={[styles.button, isSendOtpDisabled && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={isSendOtpDisabled}
        >
          <Text style={styles.buttonText}>
            {isWhatsAppLoading ? "Sending..." : "Send OTP"}
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
    height: '48%',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
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
    paddingHorizontal: 5,
    paddingVertical: 0,
    height: 50,
    alignItems: 'center',
  },
  phoneTextContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 0,
    height: '100%',
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
  smsPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  smsPromptLabel: {
    color: '#7E7E7E',
    fontSize: 12,
  },
  smsPromptAction: {
    color: '#FF8A3C',
    fontSize: 12,
    fontWeight: '700',
  },
  smsPromptDisabled: {
    opacity: 0.4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginLeft: '7%',
    marginTop: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    borderColor: '#FF8A3C',
  },
  checkboxIndicator: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#FF8A3C',
  },
  checkboxLabel: {
    color: '#7E7E7E',
    fontSize: 12,
    bottom: 1,

  },
  button: {
    width: '85%',
    height: '14%',
    borderRadius: 15,
    backgroundColor: '#FF8A3C',
    alignItems: 'center',
    justifyContent: 'center',
    top: '3%',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
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
