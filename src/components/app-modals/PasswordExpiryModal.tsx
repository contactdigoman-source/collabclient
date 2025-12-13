import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AppText, AppButton } from '..';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { useAppSelector } from '../../redux';

interface PasswordExpiryModalProps {
  visible: boolean;
  onReset: () => void;
  onDismiss?: () => void;
}

export default function PasswordExpiryModal({
  visible,
  onReset,
  onDismiss,
}: PasswordExpiryModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContainer,
          {
            backgroundColor: colors.background || '#333333',
            borderColor: appTheme === APP_THEMES.light 
              ? (colors as any).cardBorder || '#E0E0E0'
              : '#686868',
            shadowColor: appTheme === APP_THEMES.light ? colors.black_common : 'transparent',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: appTheme === APP_THEMES.light ? 0.2 : 0,
            shadowRadius: appTheme === APP_THEMES.light ? 8 : 0,
            elevation: appTheme === APP_THEMES.light ? 8 : 0,
          }
        ]}>
          {/* Message */}
          <AppText size={hp(1.9)} color={colors.text || '#FFFFFF'} style={styles.message}>
            {t(
              'auth.passwordExpiry.message',
              'Your Colab Password will get expired within next 7 days. Please re-set your password to prevent force log out.',
            )}
          </AppText>

          {/* Reset Button */}
          <AppButton
            title={t('auth.passwordExpiry.reset', 'Reset')}
            style={styles.resetButton}
            onPress={onReset}
            titleColor="#FFFFFF"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: wp(90.67), // 340px equivalent
    minHeight: hp(20), // Minimum height
    borderWidth: 1,
    borderRadius: wp(4.7), // 17.6121px equivalent
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(3),
  },
  message: {
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: hp(1.9), // 15px equivalent
    lineHeight: hp(2.5), // 20px equivalent
    textAlign: 'center',
    marginBottom: hp(3),
    paddingHorizontal: wp(2),
  },
  resetButton: {
    width: wp(41.9), // 157.18px equivalent
    height: hp(6.8), // 39px equivalent
    borderRadius: wp(19.8), // 74.2424px equivalent
    backgroundColor: '#62C268',
    marginTop: hp(1),
  },
});

