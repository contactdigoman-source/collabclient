import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AppButton, AppText } from '..';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { DarkThemeColors, LightThemeColors } from '../../themes';
import { useAppSelector } from '../../redux';
import { APP_THEMES } from '../../themes';

interface FaceRDVerificationModalProps {
  visible: boolean;
  isVerifying: boolean;
  error?: string | null;
  onSuccess: () => void;
  onOTPFallback: () => void;
  onCancel: () => void;
}

export default function FaceRDVerificationModal({
  visible,
  isVerifying,
  error,
  onSuccess,
  onOTPFallback,
  onCancel,
}: FaceRDVerificationModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const { appTheme } = useAppSelector(state => state.appState);
  const themeColors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;

  // Debug logging
  useEffect(() => {
    console.log('FaceRDVerificationModal: visible=', visible, 'isVerifying=', isVerifying, 'error=', error);
  }, [visible, isVerifying, error]);

  // Auto-dismiss on success
  useEffect(() => {
    if (!isVerifying && !error && visible) {
      // Small delay to show success state before dismissing
      const timer = setTimeout(() => {
        onSuccess();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVerifying, error, visible, onSuccess]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: themeColors.background_secondary }]}>
          {isVerifying ? (
            <>
              <ActivityIndicator size="large" color={themeColors.primary} />
              <AppText
                size={hp(2.25)}
                color={themeColors.text_primary}
                style={styles.message}
              >
                {t('faceRD.verifying', 'Authenticating...')}
              </AppText>
            </>
          ) : error ? (
            <>
              <AppText
                size={hp(2.5)}
                color={themeColors.error || '#FF4444'}
                style={styles.errorTitle}
              >
                {t('faceRD.failed', 'Biometric verification failed')}
              </AppText>
              <View style={styles.buttonContainer}>
                <AppButton
                  title={t('faceRD.useOTP', 'Use OTP instead')}
                  onPress={onOTPFallback}
                  style={styles.otpButton}
                />
                <TouchableOpacity
                  onPress={onCancel}
                  style={styles.cancelButton}
                >
                  <AppText
                    size={hp(1.8)}
                    color={themeColors.text_secondary}
                  >
                    {t('faceRD.cancel', 'Cancel')}
                  </AppText>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
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
    width: wp(80),
    borderRadius: 15,
    padding: hp(3),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: hp(20),
  },
  message: {
    marginTop: hp(2),
    textAlign: 'center',
  },
  errorTitle: {
    marginBottom: hp(1),
    textAlign: 'center',
    fontWeight: '600',
  },
  errorMessage: {
    marginBottom: hp(3),
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  otpButton: {
    width: '100%',
    marginBottom: hp(1.5),
  },
  cancelButton: {
    paddingVertical: hp(1),
    paddingHorizontal: wp(5),
  },
});
