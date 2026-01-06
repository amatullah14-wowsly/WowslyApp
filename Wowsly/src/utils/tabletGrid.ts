export function getTabletColumns(width: number) {
    if (width >= 1000) return 3;
    if (width >= 720) return 2;
    return 1;
}
