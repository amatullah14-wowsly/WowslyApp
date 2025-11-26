import React, { useMemo, useState, useEffect } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { Guest, GuestGroup } from './guestData';
import { getEventUsers } from '../../api/event';

export type GuestFilter = 'All' | GuestGroup;

type GuestScreenTemplateProps = {
  initialFilter?: GuestFilter;
  eventId?: string;
};

const tabs: GuestFilter[] = ['All', 'Manager', 'Invited', 'Registered'];

const statusChipStyles: Record<
  string,
  { backgroundColor: string; color: string }
> = {
  'Checked In': { backgroundColor: '#E3F8EB', color: '#16794C' },
  Pending: { backgroundColor: '#FFF2D4', color: '#A46A00' },
  'No-Show': { backgroundColor: '#FFE2E2', color: '#BE2F2F' },
  'registered': { backgroundColor: '#E3F8EB', color: '#16794C' },
  'invited': { backgroundColor: '#E0F2F1', color: '#00695C' },
};

const BACK_ICON = require('../../assets/img/common/back.png');
const SEARCH_ICON = {
  uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};

const NOGUESTS_ICON = require('../../assets/img/common/noguests.png');

const GuestScreenTemplate: React.FC<GuestScreenTemplateProps> = ({
  initialFilter = 'All',
  eventId,
}) => {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<GuestFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchGuests();
    }
  }, [eventId, activeFilter]);

  const fetchGuests = async () => {
    setLoading(true);

    try {
      if (activeFilter === 'All') {
        // Fetch all categories and combine them
        const [managerRes, invitedRes, registeredRes] = await Promise.all([
          getEventUsers(eventId, 1, 'manager'),
          getEventUsers(eventId, 1, 'invited'),
          getEventUsers(eventId, 1, 'registered'),
        ]);

        const allGuests = [
          ...(managerRes?.data || []),
          ...(invitedRes?.data || []),
          ...(registeredRes?.data || []),
        ];

        // Remove duplicates based on id
        const uniqueGuests = allGuests.filter((guest, index, self) =>
          index === self.findIndex((g) => g.id === guest.id)
        );

        setGuests(uniqueGuests);
      } else {
        // Fetch specific category
        let type = activeFilter.toLowerCase();
        const res = await getEventUsers(eventId, 1, type);
        setGuests(res?.data || []);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
      setGuests([]);
    }

    setLoading(false);
  };

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const name = guest.name || guest.first_name + ' ' + guest.last_name || 'Guest';
      const matchesSearch = name
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());
      return matchesSearch;
    });
  }, [guests, searchQuery]);

  const renderGuest = ({ item }: { item: any }) => {
    const name = item.name || item.first_name + ' ' + item.last_name || 'Guest';
    const avatar = item.avatar || item.profile_photo || 'https://ui-avatars.com/api/?name=' + name;
    const status = item.status || 'Registered';

    const renderRightActions = () => (
      <View style={styles.rowActions}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionButton, styles.editButton]}
        >
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <View style={styles.guestRow}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.guestInfo}>
            <Text style={styles.guestName}>{name}</Text>
          </View>
          <View style={[styles.statusChip, statusChipStyles[status] || statusChipStyles[status.toLowerCase()] || statusChipStyles['registered']]}>
            <Text
              style={[
                styles.statusChipText,
                { color: (statusChipStyles[status] || statusChipStyles[status.toLowerCase()] || statusChipStyles['registered']).color },
              ]}
            >
              {status}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.canGoBack() && navigation.goBack()}
        >
          <Image source={BACK_ICON} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guest List</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Image source={SEARCH_ICON} style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = tab === activeFilter;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              style={styles.tabButton}
              onPress={() => setActiveFilter(tab)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab}
              </Text>
              {isActive ? <View style={styles.tabIndicator} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchContainer}>
        <Image source={SEARCH_ICON} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name"
          placeholderTextColor="#A1A1A1"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <GestureHandlerRootView style={styles.listWrapper}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8A3C" />
          </View>
        ) : (
          <FlatList
            data={filteredGuests}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderGuest}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Image source={NOGUESTS_ICON} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No guests found</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different name or category.
                </Text>
              </View>
            }
          />
        )}
      </GestureHandlerRootView>
    </SafeAreaView>
  );
};

export default GuestScreenTemplate;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  headerIcon: {
    width: 18,
    height: 18,
    tintColor: '#111111',
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 20,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    color: '#7A7A7A',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FF8A3C',
  },
  tabIndicator: {
    marginTop: 6,
    height: 3,
    width: 24,
    borderRadius: 3,
    backgroundColor: '#FF8A3C',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    tintColor: '#9B9B9B',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111111',
  },
  listWrapper: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',

  },
  actionButton: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  editButton: {
    backgroundColor: '#1D6EF9',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7A7A7A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
