import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAppSelector } from '../../redux';
import AppText from '../app-texts/AppText';
import { FontTypes } from '../../constants';
import { useTheme } from '@react-navigation/native';
import { DarkThemeColors } from '../../themes';
import { syncCoordinator } from '../../services/sync';

interface UnsyncedItemsListProps {
  onClose?: () => void;
}

export const UnsyncedItemsList: React.FC<UnsyncedItemsListProps> = ({ onClose }) => {
  const theme = useTheme();
  const colors = theme?.colors || {};
  const syncState = useAppSelector((state) => state.syncState);
  const { unsyncedItems } = syncState;
  const userState = useAppSelector((state) => state.userState);
  const email = userState?.userData?.email || '';
  const userID = userState?.userData?.id?.toString() || email || '';

  const handleSyncAll = async () => {
    if (email && userID) {
      await syncCoordinator.syncAll(email, userID);
      if (onClose) {
        onClose();
      }
    }
  };

  const renderProfileItems = () => {
    if (unsyncedItems.profile.length === 0) return null;

    return (
      <View style={styles.section}>
        <AppText
          size={16}
          fontType={FontTypes.bold}
          color={colors.text || DarkThemeColors.white_common}
          style={styles.sectionTitle}
        >
          Profile ({unsyncedItems.profile.length})
        </AppText>
        {unsyncedItems.profile.map((item, index) => (
          <View
            key={`${item.property}-${index}`}
            style={[
              styles.item,
              {
                backgroundColor: colors.card || DarkThemeColors.cardBg,
                borderColor: colors.border || DarkThemeColors.cardBorder,
              },
            ]}
          >
            <AppText
              size={14}
              fontType={FontTypes.medium}
              color={colors.text || DarkThemeColors.white_common}
            >
              {item.property}
            </AppText>
            <AppText
              size={12}
              fontType={FontTypes.regular}
              color={colors.text || DarkThemeColors.white_common}
              style={styles.itemValue}
            >
              {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
            </AppText>
          </View>
        ))}
      </View>
    );
  };

  const renderAttendanceItems = () => {
    if (unsyncedItems.attendance.length === 0) return null;

    return (
      <View style={styles.section}>
        <AppText
          size={16}
          fontType={FontTypes.bold}
          color={colors.text || DarkThemeColors.white_common}
          style={styles.sectionTitle}
        >
          Attendance ({unsyncedItems.attendance.length})
        </AppText>
        {unsyncedItems.attendance.map((item, index) => (
          <View
            key={`${item.Timestamp}-${index}`}
            style={[
              styles.item,
              {
                backgroundColor: colors.card || DarkThemeColors.cardBg,
                borderColor: colors.border || DarkThemeColors.cardBorder,
              },
            ]}
          >
            <AppText
              size={14}
              fontType={FontTypes.medium}
              color={colors.text || DarkThemeColors.white_common}
            >
              {item.PunchDirection} - {new Date(item.Timestamp).toLocaleString()}
            </AppText>
            {item.Address && (
              <AppText
                size={12}
                fontType={FontTypes.regular}
                color={colors.text || DarkThemeColors.white_common}
                style={styles.itemValue}
              >
                {item.Address}
              </AppText>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderSettingsItems = () => {
    if (unsyncedItems.settings.length === 0) return null;

    return (
      <View style={styles.section}>
        <AppText
          size={16}
          fontType={FontTypes.bold}
          color={colors.text || DarkThemeColors.white_common}
          style={styles.sectionTitle}
        >
          Settings ({unsyncedItems.settings.length})
        </AppText>
        {unsyncedItems.settings.map((item, index) => (
          <View
            key={`${item.key}-${index}`}
            style={[
              styles.item,
              {
                backgroundColor: colors.card || DarkThemeColors.cardBg,
                borderColor: colors.border || DarkThemeColors.cardBorder,
              },
            ]}
          >
            <AppText
              size={14}
              fontType={FontTypes.medium}
              color={colors.text || DarkThemeColors.white_common}
            >
              {item.key}
            </AppText>
            <AppText
              size={12}
              fontType={FontTypes.regular}
              color={colors.text || DarkThemeColors.white_common}
              style={styles.itemValue}
            >
              {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
            </AppText>
          </View>
        ))}
      </View>
    );
  };

  const totalUnsynced =
    unsyncedItems.profile.length +
    unsyncedItems.attendance.length +
    unsyncedItems.settings.length;

  if (totalUnsynced === 0) {
    return (
      <View style={styles.emptyContainer}>
        <AppText
          size={16}
          fontType={FontTypes.regular}
          color={colors.text || DarkThemeColors.white_common}
        >
          All items are synced
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background || DarkThemeColors.black,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card || DarkThemeColors.cardBg,
            borderBottomColor: colors.border || DarkThemeColors.cardBorder,
          },
        ]}
      >
        <AppText
          size={18}
          fontType={FontTypes.bold}
          color={colors.text || DarkThemeColors.white_common}
        >
          Unsynced Items ({totalUnsynced})
        </AppText>
        <TouchableOpacity
          onPress={handleSyncAll}
          style={[
            styles.syncButton,
            {
              backgroundColor: colors.primary || DarkThemeColors.primary,
            },
          ]}
        >
          <AppText
            size={14}
            fontType={FontTypes.medium}
            color="#FFFFFF"
          >
            Sync All
          </AppText>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderProfileItems()}
        {renderAttendanceItems()}
        {renderSettingsItems()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  syncButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  item: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemValue: {
    marginTop: 4,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});

