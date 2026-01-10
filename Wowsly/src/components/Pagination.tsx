import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { scale, moderateScale, verticalScale } from '../utils/scaling';

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
                style={[styles.arrowButton]}
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
                style={[styles.arrowButton]}
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
        backgroundColor: 'transparent', // No background for container
    },
    numbersContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowButton: {
        width: width >= 600 ? 40 : Math.min(scale(34), 40),
        height: width >= 600 ? 40 : Math.min(scale(34), 40),
        justifyContent: 'center',
        alignItems: 'center',
        // No borders
        // No background for arrows
    },
    arrowIcon: {
        width: width >= 600 ? 18 : Math.min(scale(16), 20),
        height: width >= 600 ? 18 : Math.min(scale(16), 20),
        tintColor: '#1F1F1F', // Black arrows
    },
    disabledArrowIcon: {
        tintColor: '#E0E0E0', // Light grey for disabled
    },
    pageNumber: {
        width: width >= 600 ? 32 : Math.min(scale(32), 36), // Smaller inactive
        height: width >= 600 ? 32 : Math.min(scale(32), 36),
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: width >= 600 ? 16 : Math.min(scale(16), 18),
        backgroundColor: '#F5F5F5', // Light grey background for inactive
        marginHorizontal: scale(2), // Add slight margin for spacing
    },
    activePageNumber: {
        width: width >= 600 ? 48 : Math.min(scale(44), 50), // Larger active (Zoom effect)
        height: width >= 600 ? 48 : Math.min(scale(44), 50),
        borderRadius: width >= 600 ? 24 : Math.min(scale(22), 25),
        backgroundColor: '#FF8A3C', // Orange for active
        // Lift effect (optional)
        shadowColor: "#FF8A3C",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    pageText: {
        fontSize: width >= 600 ? 12 : Math.min(moderateScale(12), 14), // Smaller inactive text
        color: '#666666', // Slightly lighter dark text for inactive
        fontWeight: '600',
    },
    activePageText: {
        fontSize: width >= 600 ? 16 : Math.min(moderateScale(16), 18), // Larger active text
        color: '#FFFFFF', // White text for active
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

