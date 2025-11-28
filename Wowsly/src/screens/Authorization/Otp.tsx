import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import Toast from 'react-native-toast-message';
import React, { useState, useEffect } from 'react'
import { OtpInput } from 'react-native-otp-entry'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { verifyOTP, sendOTP } from '../../api/api'

import AsyncStorage from '@react-native-async-storage/async-storage';

type OtpRouteParams = {
    dialing_code: string;
    mobile: string;
};

const Otp = () => {
    const [otp, setOtp] = useState('')
    const [resendTimer, setResendTimer] = useState(30)
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<{ params: OtpRouteParams }, 'params'>>();

    const { dialing_code = "91", mobile = "" } = route.params || {};

    // ------------------------------
    // RESEND TIMER
    // ------------------------------
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setInterval(() => {
                setResendTimer((prev) => prev - 1)
            }, 1000)
            return () => clearInterval(timer)
        }
    }, [resendTimer])

    // ------------------------------
    // RESEND OTP API
    // ------------------------------
    const handleResend = async () => {
        if (resendTimer > 0) return;

        setResendTimer(30);
        await sendOTP(dialing_code, mobile);

        Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'OTP resent successfully'
        });
    }

    // ------------------------------
    // VERIFY OTP API
    // ------------------------------
    const handleVerify = async () => {
        if (otp.length < 4) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Enter valid OTP'
            });
            return;
        }

        const res = await verifyOTP(dialing_code, mobile, otp);
        console.log("Verify OTP Response:", res);

        if (res?.status == 200 || res?.status === true || res?.status_code === 200) {

            // -----------------------------------------
            // ✅ SAVE TOKEN IN ASYNC STORAGE
            // -----------------------------------------
            try {
                await AsyncStorage.removeItem("auth_token");
                await AsyncStorage.setItem("auth_token", res?.data?.token);
                console.log("Token saved:", res?.data?.token);
            } catch (e) {
                console.log("Token save error:", e);
            }

            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'OTP Verified!'
            });
            navigation.navigate("BottomNav");
        } else {
            console.log("OTP Verification Failed:", res);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: res?.message || "Invalid OTP"
            });
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.wowsly}>
                <Image
                    source={require('../../assets/img/common/logo.png')}
                    style={styles.logo}
                />
                <Text style={styles.heading}>Wowsly Organizer</Text>
            </View>

            <View style={styles.box}>
                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.instructionText}>We sent a 6-digit code to +{dialing_code}</Text>
                <Text style={styles.phoneNumber}>{mobile}</Text>

                <View style={styles.otpContainer}>
                    <OtpInput
                        numberOfDigits={4}
                        onTextChange={setOtp}
                        focusColor={'#FF8A3C'}
                        theme={{
                            containerStyle: styles.otpInputContainer,
                            pinCodeContainerStyle: styles.otpBox,
                            pinCodeTextStyle: styles.otpText,
                        }}
                    />
                </View>

                <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Didn't receive code? </Text>
                    <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
                        <Text style={[styles.resendLink, resendTimer > 0 && styles.resendLinkDisabled]}>
                            Resend OTP
                        </Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.timerText}>Resend in {resendTimer}s</Text>

                <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
                    <Text style={styles.verifyButtonText}>Verify OTP</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF3E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    wowsly: {
        flexDirection: 'column',
        gap: 6,
        marginBottom: '6%',
    },
    logo: {
        width: 50,
        height: 38,
        alignSelf: 'center',
    },
    heading: {
        fontSize: 25,
        fontWeight: '600'
    },
    box: {
        backgroundColor: 'white',
        height: '40%',
        width: '85%',
        borderRadius: 25,
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
        marginTop: 6,
        textAlign: 'center',
    },
    instructionText: {
        fontSize: 14,
        color: '#7E7E7E',
        marginTop: 10,
        textAlign: 'center',
    },
    phoneNumber: {
        fontSize: 14,
        color: '#7E7E7E',
        marginTop: 4,
        textAlign: 'center',
    },
    otpContainer: {
        width: '100%',
        marginTop: 25,
        alignItems: 'center',
    },
    otpInputContainer: {
        gap: 6,
        alignSelf: 'center',
    },
    otpBox: {
        width: 35,
        height: 40,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
    },
    otpText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    resendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
    },
    resendText: {
        fontSize: 12,
        color: '#7E7E7E',
    },
    resendLink: {
        fontSize: 12,
        color: '#FF8A3C',
        fontWeight: '600',
    },
    resendLinkDisabled: {
        opacity: 0.5,
        color: '#FFF3E0',
    },
    timerText: {
        fontSize: 12,
        color: '#7E7E7E',
        marginTop: 4,
    },
    verifyButton: {
        width: '100%',
        height: 45,
        backgroundColor: '#FF8A3C',
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 25,
    },
    verifyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
})

export default Otp
