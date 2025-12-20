import { StyleSheet, Text, View, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native'
import Toast from 'react-native-toast-message';
import React, { useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native';
import PhoneNumberInput from 'react-native-phone-number-input';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { sendOTP } from '../../api/api';  // ✅ API IMPORT

const Number = () => {
  const phoneInput = useRef<PhoneNumberInput>(null);
  const [value, setValue] = useState("");
  const [sendingVia, setSendingVia] = useState<'whatsapp' | 'sms' | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [countryCode, setCountryCode] = useState('91'); // Default to India

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainbox}>
          <View>
            <Image
              source={require('../../assets/img/common/WowslyLogo.png')}
              style={styles.logo}
            />
          </View>

          <View style={styles.heading}>
            <Text style={styles.headingText}>Welcome to Wowsly</Text>
            <Text style={styles.organizer}>Organizer App</Text>
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
              onChangeCountry={(country) => setCountryCode(country.callingCode[0])}
              containerStyle={styles.phoneContainer}
              textContainerStyle={styles.phoneTextContainer}
              textInputStyle={styles.phoneInput}
              codeTextStyle={styles.phoneCodeText}
              flagButtonStyle={styles.phoneFlagButton}
              countryPickerButtonStyle={styles.phoneCountryButton}
              disableArrowIcon={false}
              textInputProps={{
                returnKeyType: 'done',
                onSubmitEditing: handleSendOTP,
              }}
            />
            {countryCode === '91' && (
              <View style={styles.smsPrompt}>
                <Text style={styles.smsPromptLabel}>Not using WhatsApp?</Text>
                <TouchableOpacity onPress={handleSendSMS} disabled={isSending}>
                  <Text style={[styles.smsPromptAction, isSmsLoading && styles.smsPromptDisabled]}>
                    {isSmsLoading ? "Sending..." : "Send SMS"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* TERMS CHECKBOX */}

          <View style={styles.checkboxRow}>
            <TouchableOpacity
              onPress={() => setAcceptedTerms((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <View style={styles.checkboxIndicator} />}
              </View>
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>
              <Text onPress={() => setAcceptedTerms((prev) => !prev)}>I agree to the </Text>
              <Text
                style={{ color: '#FF8A3C' }}
                onPress={() => Linking.openURL('https://wowsly.com/terms-and-conditions/')}
              >
                Terms & Conditions
              </Text>
            </Text>
          </View>

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
          <TouchableOpacity onPress={() => Linking.openURL('https://wowsly.com/contact-us/')}>
            <Text style={styles.footerText}>Need help?</Text>
          </TouchableOpacity>
          <Text style={styles.dot}>•</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://wowsly.com/privacy-policy/')}>
            <Text style={styles.footerText}>Privacy</Text>
          </TouchableOpacity>
          <Text style={styles.dot}>•</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://wowsly.com/terms-and-conditions/')}>
            <Text style={styles.footerText}>Terms</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E0',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: verticalScale(20),
    paddingTop: verticalScale(50),
  },
  mainbox: {
    width: '90%',
    // height: '48%', // Removed fixed height to allow content to determine size
    paddingVertical: verticalScale(10),
    backgroundColor: '#fff',
    borderRadius: scale(25),
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    gap: verticalScale(5),
  },
  logo: {
    width: scale(80),
    height: scale(55),
  },
  heading: {
    gap: verticalScale(4),
    color: '#000',
    flexDirection: 'column',
    alignItems: 'center',
  },
  headingText: {
    fontWeight: '600',
    fontSize: moderateScale(25),
    top: '10%',
    color: '#000',
  },
  organizer: {
    fontWeight: '600',
    fontSize: moderateScale(25),
    color: '#000',
  },
  manage: {
    color: 'grey',
    fontSize: moderateScale(12),
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
    marginTop: verticalScale(10),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: scale(15),
    backgroundColor: '#fff',
    paddingHorizontal: scale(5),
    paddingVertical: 0,
    height: verticalScale(50),
    alignItems: 'center',
  },
  phoneTextContainer: {
    backgroundColor: '#fff',
    borderRadius: scale(15),
    paddingVertical: 0,
    height: '100%',
    justifyContent: 'center',
  },
  phoneInput: {
    fontSize: moderateScale(15),
    color: '#000',
    paddingVertical: 0,
  },
  phoneCodeText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#000',
  },
  phoneFlagButton: {
    marginLeft: scale(5),
  },
  phoneCountryButton: {
    paddingRight: scale(10),
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  smsPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: verticalScale(12),
  },
  smsPromptLabel: {
    color: '#7E7E7E',
    fontSize: moderateScale(12),
  },
  smsPromptAction: {
    color: '#FF8A3C',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  smsPromptDisabled: {
    opacity: 0.4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    alignSelf: 'flex-start',
    marginLeft: '7%',
    marginTop: verticalScale(15),
  },
  checkbox: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(6),
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
    width: scale(12),
    height: scale(12),
    borderRadius: scale(4),
    backgroundColor: '#FF8A3C',
  },
  checkboxLabel: {
    color: '#7E7E7E',
    fontSize: moderateScale(12),
    bottom: verticalScale(1),

  },
  button: {
    width: '85%',
    height: '14%',
    borderRadius: scale(15),
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
    fontSize: moderateScale(16),
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(40),
  },
  footerText: {
    color: '#FF8A3C',
    fontSize: moderateScale(13)
  },
  dot: {
    color: '#FF8A3C',
    fontSize: moderateScale(13),
    marginHorizontal: scale(6)
  }
});

export default Number;
