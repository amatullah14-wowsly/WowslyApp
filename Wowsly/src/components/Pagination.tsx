import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList } from 'react-native';
import { scale, moderateScale, verticalScale } from '../utils/scaling';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {

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
                    <View key={index} style={{ marginHorizontal: scale(4) }}>
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

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: verticalScale(10),
        width: '100%',
    },
    numbersContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        // flexWrap: 'wrap', // Prevent wrapping if too many, logic handles ellipsis
    },
    arrowButton: {
        width: scale(36), // Slightly larger touch area
        height: scale(36),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: scale(18), // Circle
        marginHorizontal: scale(5),
    },
    disabledArrow: {
        borderColor: '#F0F0F0',
    },
    arrowIcon: {
        width: scale(14),
        height: scale(14),
        tintColor: '#333',
    },
    disabledArrowIcon: {
        tintColor: '#CCC',
    },
    pageNumber: {
        width: scale(36),
        height: scale(36),
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: scale(18),
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: 'white',
    },
    activePageNumber: {
        backgroundColor: '#FFF5E5', // Light orange background for active
        borderColor: '#FF8A3C',
    },
    pageText: {
        fontSize: moderateScale(14),
        color: '#333',
        fontWeight: '500',
    },
    activePageText: {
        color: '#FF8A3C',
        fontWeight: '700',
    },
    ellipsisContainer: {
        width: scale(20),
        justifyContent: 'center',
        alignItems: 'center',
    },
    ellipsisText: {
        fontSize: moderateScale(14),
        color: '#888',
    },
});

export default Pagination;
