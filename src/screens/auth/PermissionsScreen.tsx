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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContainer, AppText, AppButton } from '../../components';
import { NavigationProp } from '../../types/navigation';
import { hp, wp, FontTypes } from '../../constants';
import { useTheme } from '@react-navigation/native';
import { markFirstTimeLoginCompleted } from '../../services';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon?: any;
}

const PERMISSIONS: PermissionItem[] = [
  {
    id: 'location',
    title: 'location',
    description:
      'Location related permissions are required to capture and display your location to provide with accurate data at the time of check in check out.',
  },
  {
    id: 'storage',
    title: 'storage',
    description:
      'Storage permission is required so that any kind of files or any other documents can easily be downloaded, uploaded, shared or saved to your phone, which you need to collaborate with your teammates',
  },
  {
    id: 'camera',
    title: 'camera',
    description:
      'Permission to access camera is required so that you can easily scan or capture any document and send it to anyone within organization directly without any browsing requirement. This will ensure that you are provided with a seamless experience while using our application.',
  },
  {
    id: 'time',
    title: 'time capture',
    description:
      'Permission to access your device clock is required to capture the exact time of your attendance so that we can display the exact time of check in and check out',
  },
  {
    id: 'personal',
    title: 'Personal information',
    description:
      'Personal information related permission will allow us to collect user email & photo to login into the app. This information\'s are required as a part of registration process. Our app also collects mobile number for verification to check the active SIM status of the device.',
  },
  {
    id: 'device',
    title: 'device id',
    description:
      'By giving device id permission nobody can use my credentials to login from other devices',
  },
  {
    id: 'microphone',
    title: 'Microphone',
    description:
      'Colab requires access to your microphone to enable clear audio during voice and video calls.',
  },
  {
    id: 'phone',
    title: 'Phone call',
    description:
      'Colab requires access to your phone to manage call connectivity and enhance communication features',
  },
];

export default function PermissionsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState<boolean>(false);

  const handleAgree = (): void => {
    if (agreed) {
      // Mark first-time login as completed
      markFirstTimeLoginCompleted();
      // Navigate to dashboard after agreeing
      navigation.replace('DashboardScreen');
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
                        {permission.title}
                      </AppText>
                      <AppText
                        size={hp(1.6)}
                        fontType={FontTypes.regular}
                        style={styles.permissionDescription}
                      >
                        {permission.description}
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
                  You agree to our Privacy Policy and Terms and Conditions
                </AppText>
              </View>

              {/* Action Button */}
              <View style={styles.buttonContainer}>
                <AppButton
                  title="I agree"
                  style={styles.agreeButton}
                  titleSize={hp(1.5)}
                  titleColor="#FFFFFF"
                  borderRadius={wp(10)}
                  disabled={!agreed}
                  onPress={handleAgree}
                />
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

