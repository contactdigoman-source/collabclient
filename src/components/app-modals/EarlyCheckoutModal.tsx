import React, { useMemo } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AppText } from '..';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppSelector } from '../../redux';
import { APP_THEMES } from '../../themes';

interface BreakStatusOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface EarlyCheckoutModalProps {
  visible: boolean;
  hoursWorked: number;
  onSelectBreakStatus: (status: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function EarlyCheckoutModal({
  visible,
  hoursWorked,
  onSelectBreakStatus,
  onSkip,
  onCancel,
}: EarlyCheckoutModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { appTheme } = useAppSelector(state => state.appState);

  const breakStatusOptions: BreakStatusOption[] = useMemo(() => [
    { 
      id: 'LUNCH', 
      label: t('attendance.breakStatus.atLunch', 'At Lunch')
    },
    { 
      id: 'SHORTBREAK', 
      label: t('attendance.breakStatus.shortBreak', 'Short Break')
    },
    { 
      id: 'COMMUTING', 
      label: t('attendance.breakStatus.commuting', 'Commuting')
    },
    { 
      id: 'PERSONALTIMEOUT', 
      label: t('attendance.breakStatus.personalTimeout', 'Personal Timeout')
    },
    { 
      id: 'OUTFORDINNER', 
      label: t('attendance.breakStatus.outForDinner', 'Out for Dinner')
    },
  ], [t]);

  const renderIcon = (statusId: string): React.ReactNode => {
    const iconSize = hp(3.5); // ~28px
    const iconStyle = { width: iconSize, height: iconSize };

    switch (statusId) {
      case 'LUNCH':
        return (
          <View style={[styles.iconContainer, iconStyle]}>
            <AppText size={hp(2.5)} color={colors.text}>
              🍽️
            </AppText>
          </View>
        );
      case 'SHORTBREAK':
        return (
          <View style={[styles.iconContainer, iconStyle]}>
            <AppText size={hp(2.5)} color={colors.text}>
              ☕
            </AppText>
          </View>
        );
      case 'COMMUTING':
        return (
          <View style={[styles.iconContainer, iconStyle]}>
            <AppText size={hp(2.5)} color={colors.text}>
              🚗
            </AppText>
          </View>
        );
      case 'PERSONALTIMEOUT':
        return (
          <View style={[styles.iconContainer, iconStyle]}>
            <AppText size={hp(2.5)} color={colors.text}>
              ⏰
            </AppText>
          </View>
        );
      case 'OUTFORDINNER':
        return (
          <View style={[styles.iconContainer, iconStyle]}>
            <AppText size={hp(2.5)} color={colors.text}>
              🍴
            </AppText>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card || '#272727',
              borderWidth: appTheme === APP_THEMES.light ? 1 : 0,
              borderColor: appTheme === APP_THEMES.light ? colors.border : 'transparent',
            }
          ]}>
            {/* Header with title and skip button */}
            <View style={styles.header}>
              <AppText
                size={hp(2.25)} // 18px
                style={styles.title}
                color={colors.text}
              >
                {t('attendance.breakStatus.updateBreakStatus', 'Update break status')}
              </AppText>
              <TouchableOpacity
                style={[styles.skipButton, { backgroundColor: colors.border || '#545454' }]}
                onPress={onSkip}
                activeOpacity={0.7}
              >
                <AppText
                  size={hp(1.8)} // 14.5714px
                  color={colors.text}
                >
                  {t('attendance.breakStatus.skip', 'Skip')}
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Break status options */}
            <View style={styles.optionsContainer}>
              {breakStatusOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionItem}
                  onPress={() => onSelectBreakStatus(option.id)}
                  activeOpacity={0.7}
                >
                  {renderIcon(option.id)}
                  <AppText
                    size={hp(2.25)} // 18px
                    style={styles.optionLabel}
                    color={colors.text}
                  >
                    {option.label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: wp(100.56), // 377.1px / 375px * 100 = 100.56%
    height: hp(42.5), // 345.33px / 813.33px * 100 = 42.5%
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: hp(2.2), // ~18px from top: 486.33px - 468px = 18.33px
    paddingHorizontal: wp(7.95), // ~29.81px / 375px * 100 = 7.95%
    paddingBottom: hp(3),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2.5), // Space before first option
  },
  title: {
    fontFamily: 'Roboto',
    fontWeight: '400',
    lineHeight: hp(2.6), // 21px
  },
  skipButton: {
    borderRadius: 100, // Fully rounded pill
    paddingHorizontal: wp(4), // ~15px
    paddingVertical: hp(0.7), // ~5.7px to get height of 28px
    minWidth: wp(15.7), // 59.07px
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    gap: hp(2.2), // Space between options (~18px)
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4), // Space between icon and text (~15px)
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    fontFamily: 'Roboto',
    fontWeight: '400',
    lineHeight: hp(2.6), // 21px
  },
});
