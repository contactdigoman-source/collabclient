import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import { useTheme } from '@react-navigation/native';

import { AppButton, AppContainer, AppImage, AppText } from '../../components';
import { hp, wp, Images } from '../../constants';
import { checkUsbDebuggingStatus } from '../../services/security-service';

export default function UsbDebuggingBlockScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const handleCheckAgain = useCallback(async (): Promise<void> => {
    setIsChecking(true);
    await checkUsbDebuggingStatus();
    setIsChecking(false);
    // Navigation component will handle redirect if USB debugging is disabled
    // It checks every 5 seconds automatically
  }, []);

  const handleOpenSettings = useCallback((): void => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  }, []);

  return (
    <AppContainer>
      <View style={styles.container}>
        <AppImage
          size={hp(15)}
          source={Images.forgot_pass_image}
          style={styles.image}
        />

        <AppText size={hp(2.8)} style={styles.title} fontType="medium">
          USB Debugging Detected
        </AppText>

        <AppText size={hp(1.8)} style={styles.description} color={colors.white}>
          For security reasons, the app cannot be used while USB debugging is
          enabled on your device.
        </AppText>

        <AppText size={hp(1.6)} style={styles.instructions} color={colors.white}>
          To continue using the app:
        </AppText>

        <View style={styles.stepsContainer}>
          <AppText size={hp(1.5)} style={styles.step} color={colors.white}>
            1. Open Settings on your device
          </AppText>
          <AppText size={hp(1.5)} style={styles.step} color={colors.white}>
            2. Navigate to Developer Options
          </AppText>
          <AppText size={hp(1.5)} style={styles.step} color={colors.white}>
            3. Disable USB Debugging
          </AppText>
          <AppText size={hp(1.5)} style={styles.step} color={colors.white}>
            4. Return to this app
          </AppText>
        </View>

        <View style={styles.buttonContainer}>
          <AppButton
            title={isChecking ? 'Checking...' : 'Check Again'}
            onPress={handleCheckAgain}
            style={styles.checkButton}
          />

          <AppButton
            title="Open Settings"
            onPress={handleOpenSettings}
            style={[styles.settingsButton, { borderColor: colors.primary }]}
            titleColor={colors.primary}
          />
        </View>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: hp(4),
  },
  image: {
    marginBottom: hp(3),
  },
  title: {
    textAlign: 'center',
    marginBottom: hp(2),
    color: '#FF4444',
  },
  description: {
    textAlign: 'center',
    marginBottom: hp(3),
    paddingHorizontal: wp(5),
    lineHeight: hp(2.5),
  },
  instructions: {
    textAlign: 'center',
    marginBottom: hp(2),
    fontWeight: '600',
  },
  stepsContainer: {
    width: '100%',
    paddingHorizontal: wp(8),
    marginBottom: hp(4),
  },
  step: {
    marginBottom: hp(1),
    lineHeight: hp(2.2),
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: wp(5),
    gap: hp(2),
  },
  checkButton: {
    marginBottom: 0,
  },
  settingsButton: {
    marginTop: 0,
    borderWidth: 2,
  },
});

