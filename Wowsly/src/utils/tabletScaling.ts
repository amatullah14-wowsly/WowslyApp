import { useWindowDimensions } from "react-native";
import { scale, moderateScale } from "./scaling";

export function useTabletScale(size: number) {
    const { width } = useWindowDimensions();

    if (width >= 720) {
        return Math.min(scale(size), size * 1.25);
    }
    return scale(size);
}

export function useTabletModerateScale(size: number, factor = 0.5) {
    const { width } = useWindowDimensions();

    if (width >= 720) {
        return Math.min(moderateScale(size, factor), size * 1.2);
    }
    return moderateScale(size, factor);
}
