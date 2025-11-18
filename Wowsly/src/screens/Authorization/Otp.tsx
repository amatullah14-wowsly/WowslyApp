import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import React, { useState, useEffect } from 'react'
import { OtpInput } from 'react-native-otp-entry'
import { useNavigation } from '@react-navigation/native'

const Otp = () => {
    const [otp, setOtp] = useState('')
    const [resendTimer, setResendTimer] = useState(30)
    const navigation = useNavigation();

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setInterval(() => {
                setResendTimer((prev) => prev - 1)
            }, 1000)
            return () => clearInterval(timer)
        }
    }, [resendTimer])

    const handleResend = () => {
        if (resendTimer === 0) {
            setResendTimer(30)
            // Add resend OTP logic here
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.wowsly}>
                <Image source={require('../../assets/img/common/logo.png')}
                    style={styles.logo} />
                <Text style={styles.heading}>Wowsly Organizer</Text>
            </View>
            <View style={styles.box}>
                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.instructionText}>We sent a 6-digit code to +91</Text>
                <Text style={styles.phoneNumber}>98XXXXXXXX</Text>

                <View style={styles.otpContainer}>
                    <OtpInput
                        numberOfDigits={6}
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

                <TouchableOpacity style={styles.verifyButton}
                onPress={()=>navigation.navigate('EventListing')}>
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
        marginBottom:'6%',
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
        color: 'FFF3E0',
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

