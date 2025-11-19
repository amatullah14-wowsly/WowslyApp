import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { Guest, GuestGroup, guestListData } from './guestData';

export type GuestFilter = 'All' | GuestGroup;

type GuestScreenTemplateProps = {
  initialFilter?: GuestFilter;
};

const tabs: GuestFilter[] = ['All', 'Manager', 'Invited', 'Registered'];

const statusChipStyles: Record<
  Guest['status'],
  { backgroundColor: string; color: string }
> = {
  'Checked In': { backgroundColor: '#E3F8EB', color: '#16794C' },
  Pending: { backgroundColor: '#FFF2D4', color: '#A46A00' },
  'No-Show': { backgroundColor: '#FFE2E2', color: '#BE2F2F' },
};

const BACK_ICON = require('../../assets/img/common/back.png');
const SEARCH_ICON = {
  uri: 'https://img.icons8.com/ios-glyphs/30/969696/search--v1.png',
};

const NOGUESTS_ICON = require('../../assets/img/common/noguests.png');

const GuestScreenTemplate: React.FC<GuestScreenTemplateProps> = ({
  initialFilter = 'All',
}) => {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState<GuestFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGuests = useMemo(() => {
    return guestListData.filter((guest) => {
      const matchesFilter =
        activeFilter === 'All' ? true : guest.group === activeFilter;
      const matchesSearch = guest.name
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

  const renderGuest = ({ item }: { item: Guest }) => {
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
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          <View style={styles.guestInfo}>
            <Text style={styles.guestName}>{item.name}</Text>
          </View>
          <View style={[styles.statusChip, statusChipStyles[item.status]]}>
            <Text
              style={[
                styles.statusChipText,
                { color: statusChipStyles[item.status].color },
              ]}
            >
              {item.status}
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
        <FlatList
          data={filteredGuests}
          keyExtractor={(item) => item.id}
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
    height:50,
  },
  editButton: {
    backgroundColor: '#1D6EF9',
    // borderTopLeftRadius: 16,
    // borderBottomLeftRadius: 16,
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
});

