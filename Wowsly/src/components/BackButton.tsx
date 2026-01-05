import React from 'react';
import { TouchableOpacity, Image, StyleSheet, TouchableOpacityProps, StyleProp, ViewStyle, ImageStyle, useWindowDimensions } from 'react-native';
import { scale, verticalScale, moderateScale } from '../utils/scaling';

const BACK_ICON = require('../assets/img/common/back.png');

interface BackButtonProps extends TouchableOpacityProps {
    style?: StyleProp<ViewStyle>;
    iconStyle?: StyleProp<ImageStyle>;
}

const BackButton: React.FC<BackButtonProps> = ({ style, iconStyle, ...props }) => {
    const { width } = useWindowDimensions();
    // Use moderateScale for consistent sizing across devices.
    // 40 is a standard touch target size. Use 0.25 factor to keep it compact on tablets.
    const buttonSize = moderateScale(40, 0.25);
    const borderRadius = moderateScale(20, 0.25);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            style={[
                styles.button,
                { width: buttonSize, height: buttonSize, borderRadius },
                style
            ]}
            {...props}
        >
            <Image source={BACK_ICON} style={[styles.icon, iconStyle]} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EFE8DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: moderateScale(14),
        height: moderateScale(14), // changed from verticalScale(22) for aspect ratio and size control
        resizeMode: 'contain',
        tintColor: '#1F1F1F',
    },
});

export default BackButton;
