import { Image, StyleSheet, Text, View, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, useWindowDimensions } from 'react-native'
import Toast from 'react-native-toast-message';
import React, { useState, useEffect, useMemo } from 'react'
import { OtpInput } from 'react-native-otp-entry'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { verifyOTP, sendOTP } from '../../api/api'
import { useScale } from '../../utils/useScale';
import { FontSize } from '../../constants/fontSizes';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';

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
    const { scale, verticalScale, moderateScale } = useScale();
    const { width } = useWindowDimensions();

    const { dialing_code = "91", mobile = "" } = route.params || {};

    const styles = useMemo(() => makeStyles(scale, verticalScale, moderateScale, width), [scale, verticalScale, moderateScale, width]);

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
    const handleVerify = async (code?: string) => {
        const otpToVerify = code || otp;

        if (otpToVerify.length < 4) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Enter valid OTP'
            });
            return;
        }

        const res = await verifyOTP(dialing_code, mobile, otpToVerify);
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
        <ResponsiveContainer maxWidth={width >= 600 ? "100%" : 420}>
            <ImageBackground
                source={require('../../assets/img/splash/Splashbg.jpg')}
                style={styles.bgImage}
                resizeMode="cover"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            width >= 600 ? { justifyContent: 'center' } : undefined
                        ]}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.wowsly}>
                            <Image
                                source={require('../../assets/img/common/WowslyLogo.png')}
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
                                    onFilled={(code) => {
                                        setOtp(code);
                                        handleVerify(code);
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

                            <TouchableOpacity style={styles.verifyButton} onPress={() => handleVerify()}>
                                <Text style={styles.verifyButtonText}>Verify OTP</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </ImageBackground>
        </ResponsiveContainer>
    )
}

export default Otp

const makeStyles = (scale: any, verticalScale: any, moderateScale: any, width: any) => StyleSheet.create({
    bgImage: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: moderateScale(20),
        paddingTop: moderateScale(50),
    },
    wowsly: {
        flexDirection: 'column',
        gap: moderateScale(6),
        marginBottom: '6%',
        alignItems: 'center',
        marginTop: width >= 600 ? 50 : 0, // Move down on foldables
    },
    logo: {
        width: moderateScale(80),
        height: undefined,
        aspectRatio: 80 / 55,
        alignSelf: 'center',
        resizeMode: 'contain',
    },
    heading: {
        fontSize: moderateScale(FontSize.xxl),
        fontWeight: '600',
        color: '#000'
    },
    box: {
        backgroundColor: 'white',
        width: width >= 600 ? moderateScale(400) : '85%',
        borderRadius: moderateScale(25),
        padding: moderateScale(20),
        alignItems: 'center',
    },
    title: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '700',
        color: '#000',
        marginTop: verticalScale(6),
        textAlign: 'center',
    },
    instructionText: {
        fontSize: moderateScale(FontSize.sm),
        color: '#7E7E7E',
        marginTop: verticalScale(10),
        textAlign: 'center',
    },
    phoneNumber: {
        fontSize: moderateScale(FontSize.sm),
        color: '#7E7E7E',
        marginTop: verticalScale(4),
        textAlign: 'center',
    },
    otpContainer: {
        width: '100%',
        marginTop: verticalScale(25),
        alignItems: 'center',
    },
    otpInputContainer: {
        gap: moderateScale(6),
        alignSelf: 'center',
    },
    otpBox: {
        width: moderateScale(45), // Increased size slightly and made responsive
        height: moderateScale(50),
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: width >= 600 ? 14 : moderateScale(8), // Reduced radius for foldables
    },
    otpText: {
        fontSize: moderateScale(FontSize.lg),
        fontWeight: '600',
        color: '#000',
    },
    resendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: verticalScale(20),
    },
    resendText: {
        fontSize: moderateScale(FontSize.xs),
        color: '#7E7E7E',
    },
    resendLink: {
        fontSize: moderateScale(FontSize.xs),
        color: '#FF8A3C',
        fontWeight: '600',
    },
    resendLinkDisabled: {
        opacity: 0.5,
        color: '#FFF3E0', // Matching previous disabled color or keeping consistent
    },
    timerText: {
        fontSize: moderateScale(FontSize.xs),
        color: '#7E7E7E',
        marginTop: verticalScale(4),
    },
    verifyButton: {
        width: '100%',
        height: moderateScale(45),
        backgroundColor: '#FF8A3C',
        borderRadius: width >= 600 ? 16 : moderateScale(15),
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: verticalScale(25),
    },
    verifyButtonText: {
        color: '#fff',
        fontSize: moderateScale(FontSize.md),
        fontWeight: '700',
    },
});

