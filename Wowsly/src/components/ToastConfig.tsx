import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { ToastConfig } from 'react-native-toast-message';
import { moderateScale } from '../utils/scaling'; // Keeping this for font scaling
import { FontSize } from '../constants/fontSizes'; // Usage if needed or raw values

/*
  Custom Minimal Toast Component
  Responsive: Adapts width for Phone (90%) vs Tablet/Foldable (Fixed max width)
  Minimal: Clean white card, shadow, small accent indicator
*/

const MinimalToast = ({
    type,
    text1,
    text2,
    accentColor
}: {
    type: string,
    text1?: string,
    text2?: string,
    accentColor: string
}) => {
    const { width } = useWindowDimensions();

    // Responsive Width Logic
    // Tablet/Desktop/Open Foldable: Limit width to prevent long stretching
    // Phone: Use 90% of screen width
    const isWide = width >= 600;
    const toastWidth = isWide ? 400 : width * 0.92;

    return (
        <View style={[styles.container, { width: toastWidth }]}>
            {/* Accent Bar */}
            <View style={[styles.accent, { backgroundColor: accentColor }]} />

            {/* Content */}
            <View style={styles.content}>
                {text1 ? (
                    <Text style={styles.title} numberOfLines={1}>
                        {text1}
                    </Text>
                ) : null}
                {text2 ? (
                    <Text style={styles.subtitle} numberOfLines={2}>
                        {text2}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 12,
        // Shadow / Elevation
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        minHeight: 60,
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 0,
        marginVertical: 10,
    },
    accent: {
        width: 6,
        height: '60%', // Minimal accent height
        borderRadius: 3,
        marginLeft: 16,
        marginRight: 16,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 16,
    },
    title: {
        fontSize: moderateScale(16),
        fontWeight: '700',
        color: '#1F1F1F',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: moderateScale(14),
        color: '#666666',
        fontWeight: '500',
    }
});

// Toast Config Mapping
export const toastConfig: ToastConfig = {
    success: ({ text1, text2 }) => (
        <MinimalToast
            type="success"
            text1={text1}
            text2={text2}
            accentColor="#FF8A3C" // Brand Orange
        />
    ),
    error: ({ text1, text2 }) => (
        <MinimalToast
            type="error"
            text1={text1}
            text2={text2}
            accentColor="#E74C3C" // Red
        />
    ),
    info: ({ text1, text2 }) => (
        <MinimalToast
            type="info"
            text1={text1}
            text2={text2}
            accentColor="#3498DB" // Blue
        />
    )
};
