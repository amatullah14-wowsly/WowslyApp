import { StyleSheet, TextStyle } from 'react-native';
import { FontSize } from './fontSizes';

type ScaleFunc = (size: number, factor?: number) => number;

export const createTextStyles = (moderateScale: ScaleFunc) => StyleSheet.create({
    h1: {
        fontSize: moderateScale(FontSize.xxxl),
        fontWeight: '700',
        color: '#000000',
    },
    h2: {
        fontSize: moderateScale(FontSize.xxl),
        fontWeight: '700',
        color: '#000000',
    },
    h3: {
        fontSize: moderateScale(FontSize.xl),
        fontWeight: '600',
        color: '#000000',
    },
    bodyLarge: {
        fontSize: moderateScale(FontSize.lg),
        color: '#333333',
    },
    bodyMedium: {
        fontSize: moderateScale(FontSize.md),
        color: '#333333',
    },
    bodySmall: {
        fontSize: moderateScale(FontSize.sm),
        color: '#666666',
    },
    caption: {
        fontSize: moderateScale(FontSize.xs),
        color: '#888888',
    },
});
