import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppSelector } from '../../redux';
import AppText from '../app-texts/AppText';
import { FontTypes } from '../../constants';
import { useTheme } from '@react-navigation/native';
import { DarkThemeColors } from '../../themes';

interface SyncStatusIndicatorProps {
  onPress?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ onPress }) => {
  const theme = useTheme();
  const colors = theme?.colors || {};
  const syncState = useAppSelector((state) => state.syncState);
  const { isSyncing, unsyncedItems } = syncState;

  const totalUnsynced =
    unsyncedItems.profile.length +
    unsyncedItems.attendance.length +
    unsyncedItems.settings.length;

  if (totalUnsynced === 0 && !isSyncing) {
    return null; // Don't show indicator if everything is synced
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.card || DarkThemeColors.cardBg,
          borderColor: colors.border || DarkThemeColors.cardBorder,
        },
      ]}
      activeOpacity={0.7}
    >
      {isSyncing ? (
        <View style={styles.syncingContainer}>
          <ActivityIndicator
            size="small"
            color={colors.primary || DarkThemeColors.primary}
          />
          <AppText
            size={12}
            fontType={FontTypes.regular}
            color={colors.text || DarkThemeColors.white_common}
            style={styles.text}
          >
            Syncing...
          </AppText>
        </View>
      ) : (
        <View style={styles.unsyncedContainer}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.notification || '#FF6B6B',
              },
            ]}
          >
            <AppText
              size={10}
              fontType={FontTypes.medium}
              color="#FFFFFF"
            >
              {totalUnsynced}
            </AppText>
          </View>
          <AppText
            size={12}
            fontType={FontTypes.regular}
            color={colors.text || DarkThemeColors.white_common}
            style={styles.text}
          >
            {totalUnsynced === 1 ? 'item' : 'items'} pending
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unsyncedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  text: {
    marginLeft: 4,
  },
});

