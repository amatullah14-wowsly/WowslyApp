import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import BackButton from './BackButton';

type TicketStat = {
  ticket_id: number;
  ticket_name: string;
  total_check_in: string | number;
  total_purchase_ticket: number;
  total_facilities_check_in?: any;
};

type TicketCheckInModalProps = {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  checkInStats: TicketStat[];
};

const INFO_ICON = require('../assets/img/common/info.png');
const DOWNLOAD_ICON = { uri: 'https://img.icons8.com/ios-glyphs/30/000000/download.png' };

const TicketCheckInModal: React.FC<TicketCheckInModalProps> = ({
  visible,
  onClose,
  loading,
  checkInStats,
}) => {
  const renderItem = ({ item }: { item: TicketStat }) => {
    const checkedIn = Number(item.total_check_in || 0);
    const total = Number(item.total_purchase_ticket || 0);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.ticketName}>{item.ticket_name}</Text>
          <View style={styles.iconsRow}>
             {/* Info Icon */}
             <TouchableOpacity>
                <Image source={INFO_ICON} style={styles.icon} resizeMode="contain" />
             </TouchableOpacity>
             {/* Download Icon */}
             <TouchableOpacity style={{marginLeft: 8}}>
                <Image source={DOWNLOAD_ICON} style={styles.icon} resizeMode="contain" />
             </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.entryText}>
          Entry : {checkedIn}/{total}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.modalContent} 
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <BackButton onPress={onClose} style={styles.backButtonStyle} />
            <Text style={styles.title}>Event Check-In Records</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF8A3C" />
            </View>
          ) : (
            <FlatList
              data={checkInStats}
              keyExtractor={(item, index) => `${item.ticket_id}-${index}`}
              renderItem={renderItem}
              // Removed numColumns and columnWrapperStyle for single column
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No check-in records found.</Text>
                  </View>
              }
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default TicketCheckInModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: 'white',
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 15,
  },
  backButtonStyle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 0, // Simplified for modal header
      backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 5,
  },
  closeText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 100, // Keep consistent height
    justifyContent: 'space-between',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    marginRight: 8,
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 20, // Slightly larger for better touch target visibility
    height: 20,
    tintColor: '#1F2937',
  },
  entryText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  emptyContainer: {
      padding: 20,
      alignItems: 'center',
  },
  emptyText: {
      color: '#666',
      fontSize: 16,
  }
});
