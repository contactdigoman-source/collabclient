import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { AppText, AppButton } from '..';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { DarkThemeColors } from '../../themes';

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
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Message */}
          <AppText size={hp(1.9)} style={styles.message}>
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
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#686868',
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
    color: '#FFFFFF',
    marginBottom: hp(3),
    paddingHorizontal: wp(2),
  },
  resetButton: {
    width: wp(41.9), // 157.18px equivalent
    height: hp(4.8), // 39px equivalent
    borderRadius: wp(19.8), // 74.2424px equivalent
    backgroundColor: '#62C268',
    marginTop: hp(1),
  },
});

