import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Platform, StatusBar, BackHandler } from 'react-native';

import { AppButton, AppContainer, AppImage, AppText } from '../../components';
import { hp, wp, Images } from '../../constants';
import { checkUsbDebuggingStatus } from '../../services/security-service';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

export default function UsbDebuggingBlockScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const { appTheme } = useAppSelector(state => state.appState);
  
  // Get theme colors based on app theme
  const themeColors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;

  const handleCheckAgain = useCallback(async (): Promise<void> => {
    setIsChecking(true);
    await checkUsbDebuggingStatus();
    setIsChecking(false);
    // Navigation component will handle redirect if USB debugging is disabled
    // It checks every 5 seconds automatically
  }, []);

  const handleExit = useCallback((): void => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    }
  }, []);

  return (
    <AppContainer>
      <StatusBar
        barStyle={appTheme === APP_THEMES.dark ? 'light-content' : 'dark-content'}
        translucent={false}
        backgroundColor={themeColors.black}
      />
      <View style={styles.container}>
        <AppImage
          size={hp(15)}
          source={Images.forgot_pass_image}
          style={styles.image}
        />

        <AppText size={hp(2.8)} style={styles.title} fontType="medium">
          {t('security.usbDebuggingDetected')}
        </AppText>

        <AppText size={hp(1.8)} style={styles.description} color={themeColors.white_common || '#FFFFFF'}>
          {t('security.securityMessage')}
        </AppText>

        <AppText size={hp(1.6)} style={styles.instructions} color={themeColors.white_common || '#FFFFFF'}>
          {t('security.toContinue')}
        </AppText>

        <View style={styles.stepsContainer}>
          <AppText size={hp(1.5)} style={styles.step} color={themeColors.white_common || '#FFFFFF'}>
            {t('security.step1')}
          </AppText>
          <AppText size={hp(1.5)} style={styles.step} color={themeColors.white_common || '#FFFFFF'}>
            {t('security.step2')}
          </AppText>
          <AppText size={hp(1.5)} style={styles.step} color={themeColors.white_common || '#FFFFFF'}>
            {t('security.step3')}
          </AppText>
          <AppText size={hp(1.5)} style={styles.step} color={themeColors.white_common || '#FFFFFF'}>
            {t('security.step4')}
          </AppText>
        </View>

        <View style={styles.buttonContainer}>
          <AppButton
            title={isChecking ? t('security.checking') : t('security.checkAgain')}
            onPress={handleCheckAgain}
            style={styles.checkButton}
          />

          <AppButton
            title={t('security.exit')}
            onPress={handleExit}
            style={StyleSheet.flatten([styles.settingsButton, { borderColor: themeColors.primary || '#62C268' }])}
            titleColor={themeColors.white_common || '#62C268'}
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

