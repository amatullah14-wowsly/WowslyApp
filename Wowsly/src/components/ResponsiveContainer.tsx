import React from 'react';
import { View, StyleSheet, useWindowDimensions, ViewStyle, DimensionValue } from 'react-native';

interface ResponsiveContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
    maxWidth?: DimensionValue;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ children, style, maxWidth }) => {
    const { width } = useWindowDimensions();

    // Device rules:
    // width < 600 -> Phone
    // 600 <= width < 720 -> Foldable (unfolded)
    // width >= 720 -> Tablet

    const isPhone = width < 600;

    if (isPhone) {
        // Phones: render children directly (no wrapper, no constraints)
        return <>{children}</>;
    }

    return (
        <View style={[styles.outerContainer, style]}>
            <View style={[styles.innerContainer, { maxWidth: maxWidth || 420 }]}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212', // Dark background for the unused screen area
    },
    innerContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 420, // Tablet/Foldable constraint: treat as phone UI
        overflow: 'hidden',
        backgroundColor: '#fff', // Fallback background
        alignSelf: 'center',
    },
});
