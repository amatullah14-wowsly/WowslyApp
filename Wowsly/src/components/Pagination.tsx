import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { scale, moderateScale, verticalScale } from '../utils/scaling';
import { FontSize } from '../constants/fontSizes';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
    const { width } = useWindowDimensions();
    const styles = useMemo(() => makeStyles(width), [width]);

    const renderPageNumber = ({ item }: { item: number | string }) => {
        if (item === '...') {
            return (
                <View style={styles.ellipsisContainer}>
                    <Text style={styles.ellipsisText}>...</Text>
                </View>
            );
        }

        const pageNum = item as number;
        const isActive = pageNum === currentPage;

        return (
            <TouchableOpacity
                onPress={() => onPageChange(pageNum)}
                style={[styles.pageNumber, isActive && styles.activePageNumber]}
            >
                <Text style={[styles.pageText, isActive && styles.activePageText]}>
                    {pageNum}
                </Text>
            </TouchableOpacity>
        );
    };

    // Generate page numbers with ellipsis logic
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisiblePages = 5; // Adjust based on screen width/preference

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            // Always show first, last, current, and neighbors
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={() => onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                style={[styles.arrowButton, currentPage === 1 && styles.disabledArrow]}
            >
                <Image
                    source={require('../assets/img/common/previous.png')}
                    style={[styles.arrowIcon, currentPage === 1 && styles.disabledArrowIcon]}
                    resizeMode="contain"
                />
            </TouchableOpacity>

            <View style={styles.numbersContainer}>
                {getPageNumbers().map((item, index) => (
                    <View key={index} style={{ marginHorizontal: width >= 600 ? 6 : scale(4) }}>
                        {renderPageNumber({ item })}
                    </View>
                ))}
            </View>

            <TouchableOpacity
                onPress={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={[styles.arrowButton, currentPage === totalPages && styles.disabledArrow]}
            >
                <Image
                    source={require('../assets/img/common/next.png')}
                    style={[styles.arrowIcon, currentPage === totalPages && styles.disabledArrowIcon]}
                    resizeMode="contain"
                />
            </TouchableOpacity>
        </View>
    );
};

const makeStyles = (width: number) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: width >= 600 ? 10 : verticalScale(10),
        width: '100%',
    },
    numbersContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowButton: {
        width: width >= 600 ? 40 : Math.min(scale(36), 44),
        height: width >= 600 ? 40 : Math.min(scale(36), 44),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF8A3C',
        borderRadius: width >= 600 ? 20 : Math.min(scale(18), 22),
        marginHorizontal: width >= 600 ? 8 : Math.min(scale(5), 8),
    },
    disabledArrow: {
        borderColor: '#fbc8a6ff',
    },
    arrowIcon: {
        width: width >= 600 ? 14 : Math.min(scale(14), 18),
        height: width >= 600 ? 14 : Math.min(scale(14), 18),
        tintColor: '#FF8A3C',
    },
    disabledArrowIcon: {
        tintColor: '#fbc8a6ff',
    },
    pageNumber: {
        width: width >= 600 ? 40 : Math.min(scale(36), 44),
        height: width >= 600 ? 40 : Math.min(scale(36), 44),
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: width >= 600 ? 20 : Math.min(scale(18), 22),
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: 'white',
    },
    activePageNumber: {
        backgroundColor: '#FFF5E5', // Light orange background for active
        borderColor: '#FF8A3C',
    },
    pageText: {
        fontSize: width >= 600 ? 14 : Math.min(moderateScale(14), 16),
        color: '#333',
        fontWeight: '500',
    },
    activePageText: {
        color: '#FF8A3C',
        fontWeight: '700',
    },
    ellipsisContainer: {
        width: width >= 600 ? 20 : scale(20),
        justifyContent: 'center',
        alignItems: 'center',
    },
    ellipsisText: {
        fontSize: width >= 600 ? 14 : Math.min(moderateScale(14), 16),
        color: '#888',
    },
});

export default Pagination;
