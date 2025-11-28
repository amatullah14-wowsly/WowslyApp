import React from 'react';
import { TouchableOpacity, Image, StyleSheet, TouchableOpacityProps, StyleProp, ViewStyle, ImageStyle } from 'react-native';

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
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE8DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: 14,
        height: 22,
        resizeMode: 'contain',
        tintColor: '#1F1F1F',
    },
});

export default BackButton;
