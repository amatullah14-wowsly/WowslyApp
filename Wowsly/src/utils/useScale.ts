import { useWindowDimensions } from 'react-native';

const guidelineBaseWidth = 360;
const guidelineBaseHeight = 825;

export function useScale() {
    const { width, height } = useWindowDimensions();

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const scale = (size: number) => (width / guidelineBaseWidth) * size;
    const verticalScale = (size: number) => (height / guidelineBaseHeight) * size;
    const moderateScale = (size: number, factor = 0.5) =>
        clamp(size + (scale(size) - size) * factor, size * 0.8, size * 1.3);

    return { scale, verticalScale, moderateScale };
}
