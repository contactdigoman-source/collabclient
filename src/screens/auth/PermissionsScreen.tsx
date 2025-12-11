import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContainer, AppText, AppButton } from '../../components';
import { NavigationProp } from '../../types/navigation';
import { hp, wp, FontTypes } from '../../constants';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector, setFirstTimeLoginData } from '../../redux';
import { submitFirstTimeLogin } from '../../services/auth/first-time-login-service';
import { requestAllPermissions } from '../../services/permissions/permission-service';

interface PermissionItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon?: any;
}

export default function PermissionsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Get first-time login data and user email from store
  const firstTimeLoginData = useAppSelector((state) => state.userState.firstTimeLoginData);
  const userData = useAppSelector((state) => state.userState.userData);

  const PERMISSIONS: PermissionItem[] = [
    {
      id: 'location',
      titleKey: 'auth.permissions.location.title',
      descriptionKey: 'auth.permissions.location.description',
    },
    {
      id: 'storage',
      titleKey: 'auth.permissions.storage.title',
      descriptionKey: 'auth.permissions.storage.description',
    },
    {
      id: 'camera',
      titleKey: 'auth.permissions.camera.title',
      descriptionKey: 'auth.permissions.camera.description',
    },
    {
      id: 'time',
      titleKey: 'auth.permissions.timeCapture.title',
      descriptionKey: 'auth.permissions.timeCapture.description',
    },
    {
      id: 'personal',
      titleKey: 'auth.permissions.personalInformation.title',
      descriptionKey: 'auth.permissions.personalInformation.description',
    },
    {
      id: 'device',
      titleKey: 'auth.permissions.deviceId.title',
      descriptionKey: 'auth.permissions.deviceId.description',
    },
    {
      id: 'microphone',
      titleKey: 'auth.permissions.microphone.title',
      descriptionKey: 'auth.permissions.microphone.description',
    },
    {
      id: 'phone',
      titleKey: 'auth.permissions.phoneCall.title',
      descriptionKey: 'auth.permissions.phoneCall.description',
    },
  ];

  const handleAgree = async (): Promise<void> => {
    if (!agreed) {
      return;
    }

    // Check if we have first-time login data
    if (!firstTimeLoginData) {
      Alert.alert(
        t('auth.permissions.error', 'Error'),
        t('auth.permissions.missingData', 'First-time login data is missing. Please go back and complete the form.'),
      );
      return;
    }

    // Check if we have user email
    const email = userData?.email;
    if (!email) {
      Alert.alert(
        t('auth.permissions.error', 'Error'),
        t('auth.permissions.missingEmail', 'User email is missing. Please login again.'),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Request all permissions first
      await requestAllPermissions();
      
      // Get list of permission IDs that were shown (all permissions in this screen)
      const permissionIds = PERMISSIONS.map((p) => p.id);

      // Submit first-time login data with consent
      await submitFirstTimeLogin({
        email: email,
        firstName: firstTimeLoginData.firstName,
        lastName: firstTimeLoginData.lastName,
        newPassword: firstTimeLoginData.newPassword,
        permissions: permissionIds,
      });

      // Clear temporary first-time login data
      dispatch(setFirstTimeLoginData(null));

      // Navigate to DashboardScreen (home)
      navigation.replace('DashboardScreen');
    } catch (error: any) {
      Alert.alert(
        t('auth.permissions.error', 'Error'),
        error.message || t('auth.permissions.submitError', 'Failed to submit first-time login data. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkboxStyle = useMemo(
    () => ({
      backgroundColor: agreed ? colors.primary : 'transparent',
      borderColor: colors.primary,
    }),
    [agreed, colors.primary],
  );

  const renderPermissionIcon = (permissionId: string): React.ReactNode => {
    // Placeholder icons - these can be replaced with actual icon assets
    const iconSize = hp(3.2);
    const iconStyle = { width: iconSize, height: iconSize };

    switch (permissionId) {
      case 'location':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>📍</AppText>
          </View>
        );
      case 'storage':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>📁</AppText>
          </View>
        );
      case 'camera':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>📷</AppText>
          </View>
        );
      case 'time':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>🕐</AppText>
          </View>
        );
      case 'personal':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>👤</AppText>
          </View>
        );
      case 'device':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>📱</AppText>
          </View>
        );
      case 'microphone':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>🎤</AppText>
          </View>
        );
      case 'phone':
        return (
          <View style={[styles.iconPlaceholder, iconStyle]}>
            <AppText size={hp(1.8)}>📞</AppText>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <AppContainer>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              {/* Header */}
              <View style={[styles.header, { paddingTop: insets.top + hp(4.5) }]}>
                <AppText size={hp(2.5)} fontType={FontTypes.regular} style={styles.title}>
                  permission
                </AppText>
              </View>

              {/* Divider */}
              <View style={[styles.divider, { borderColor: '#FFFFFF' }]} />

              {/* Permissions List */}
              <View style={styles.permissionsContainer}>
                {PERMISSIONS.map((permission) => (
                  <View key={permission.id} style={styles.permissionItem}>
                    {renderPermissionIcon(permission.id)}
                    <View style={styles.permissionContent}>
                      <AppText
                        size={hp(2.2)}
                        fontType={FontTypes.regular}
                        style={styles.permissionTitle}
                      >
                        {t(permission.titleKey)}
                      </AppText>
                      <AppText
                        size={hp(1.6)}
                        fontType={FontTypes.regular}
                        style={styles.permissionDescription}
                      >
                        {t(permission.descriptionKey)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>

              {/* Privacy Policy Checkbox */}
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[styles.checkbox, styles.checkboxBorder, checkboxStyle]}
                  onPress={() => setAgreed(!agreed)}
                >
                  {agreed && (
                    <AppText size={hp(1.5)} color="#FFFFFF">
                      ✓
                    </AppText>
                  )}
                </TouchableOpacity>
                <AppText
                  size={hp(1.5)}
                  fontType={FontTypes.regular}
                  style={styles.checkboxLabel}
                >
                  {t('auth.permissions.privacyAgreement')}
                </AppText>
              </View>

              {/* Action Button */}
              <View style={styles.buttonContainer}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <AppButton
                    title={t('auth.permissions.agree')}
                    style={styles.agreeButton}
                    titleSize={hp(1.5)}
                    titleColor="#FFFFFF"
                    borderRadius={wp(10)}
                    disabled={!agreed || isSubmitting}
                    onPress={handleAgree}
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: hp(4),
  },
  container: {
    flex: 1,
    padding: hp(0),
  },
  header: {
    paddingHorizontal: wp(3.5),
    paddingBottom: hp(1),
    alignItems: 'center',
  },
  title: {
    textTransform: 'capitalize',
  },
  divider: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    marginTop: hp(1),
    marginBottom: hp(2),
    opacity: 0.2,
  },
  permissionsContainer: {
    paddingHorizontal: wp(5.3),
  },
  permissionItem: {
    flexDirection: 'row',
    marginBottom: hp(2.5),
    alignItems: 'flex-start',
  },
  iconPlaceholder: {
    width: hp(3.2),
    height: hp(3.2),
    marginRight: wp(4.8),
    marginTop: hp(0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    textTransform: 'capitalize',
    marginBottom: hp(0.5),
  },
  permissionDescription: {
    lineHeight: hp(2),
    opacity: 0.9,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5.3),
    marginTop: hp(2),
    marginBottom: hp(2),
  },
  checkbox: {
    width: wp(5.9),
    height: wp(5.9),
    borderRadius: wp(1.6),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(4.5),
  },
  checkboxBorder: {
    // Border styles handled by checkboxStyle
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: hp(2.1),
  },
  buttonContainer: {
    paddingHorizontal: wp(5.3),
    alignItems: 'center',
    marginTop: hp(2),
  },
  agreeButton: {
    width: wp(44),
    height: hp(6.5),
  },
});

