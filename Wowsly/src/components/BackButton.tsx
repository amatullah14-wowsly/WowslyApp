import React from 'react';
import { TouchableOpacity, Image, StyleSheet, TouchableOpacityProps, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { scale, verticalScale } from '../utils/scaling';

const BACK_ICON = require('../assets/img/common/back.png');

interface BackButtonProps extends TouchableOpacityProps {
    style?: StyleProp<ViewStyle>;
    iconStyle?: StyleProp<ImageStyle>;
}

const BackButton: React.FC<BackButtonProps> = ({ style, iconStyle, ...props }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.button, style]}
            {...props}
        >
            <Image source={BACK_ICON} style={[styles.icon, iconStyle]} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        width: scale(40),
        height: scale(40), // scale height same as width to keep circle
        borderRadius: scale(20),
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE8DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: scale(14),
        height: verticalScale(22),
        resizeMode: 'contain',
        tintColor: '#1F1F1F',
    },
});

export default BackButton;
