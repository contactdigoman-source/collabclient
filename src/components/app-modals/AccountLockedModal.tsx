import React, { useMemo } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AppText, AppButton, AppImage } from '..';
import { hp, wp, Icons } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { APP_THEMES, DarkThemeColors } from '../../themes';
import { useAppSelector } from '../../redux';

interface AccountLockedModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AccountLockedModal({
  visible,
  onClose,
}: AccountLockedModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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
          {/* Icon Circle */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              {/* Lock icon - using AppImage if available, otherwise simple representation */}
              {Icons.lock ? (
                <AppImage
                  size={wp(15)}
                  source={Icons.lock}
                  tintColor={colors.text || '#365E7D'}
                />
              ) : (
                <View style={styles.lockIcon}>
                  <View style={styles.lockShackle} />
                  <View style={styles.lockBody} />
                </View>
              )}
            </View>
          </View>

          {/* Message */}
          <AppText size={hp(1.9)} color={colors.text || '#FFFFFF'} style={styles.message}>
            {t('auth.accountLocked.message', 'Your account has been temporarily locked due to multiple failed login attempts. Please contact your administrator to regain access.')}
          </AppText>

          {/* Okay Button */}
          <AppButton
            title={t('auth.accountLocked.okay', 'Okay')}
            style={styles.okayButton}
            onPress={onClose}
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
    height: hp(38.4), // 311.27px equivalent
    borderWidth: 1,
    borderRadius: wp(4.7), // 17.6121px equivalent
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(3),
  },
  iconContainer: {
    marginBottom: hp(2),
  },
  iconCircle: {
    width: wp(21.3), // 79.8px equivalent
    height: wp(21.3), // 79.8px equivalent
    borderRadius: wp(21.3) / 2,
    backgroundColor: '#FAF0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lockBody: {
    width: wp(6),
    height: wp(5),
    backgroundColor: '#365E7D',
    borderRadius: wp(0.5),
    position: 'absolute',
    bottom: 0,
  },
  lockShackle: {
    width: wp(5),
    height: wp(4),
    borderWidth: 2.5,
    borderColor: '#365E7D',
    borderRadius: wp(2.5),
    borderBottomWidth: 0,
    position: 'absolute',
    top: 0,
    left: wp(2.5),
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
  okayButton: {
    width: wp(41.9), // 157.18px equivalent
    height: hp(6.8), // 39px equivalent
    borderRadius: wp(19.8), // 74.2424px equivalent
    backgroundColor: '#62C268',
    marginTop: hp(1),
  },
});

