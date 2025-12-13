import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AppText } from '..';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { useAppSelector } from '../../redux';

interface FaceRDNotInstalledModalProps {
  visible: boolean;
  onClose: () => void;
}

// Aadhaar FaceRD Play Store URL
const FACE_RD_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.gov.uidai.rdservice';

export default function FaceRDNotInstalledModal({
  visible,
  onClose,
}: FaceRDNotInstalledModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();

  const handleDownload = async () => {
    try {
      if (Platform.OS === 'android') {
        // Try to open Play Store app first
        const playStoreUrl = `market://details?id=in.gov.uidai.rdservice`;
        const canOpen = await Linking.canOpenURL(playStoreUrl);
        
        if (canOpen) {
          await Linking.openURL(playStoreUrl);
        } else {
          // Fallback to web Play Store
          await Linking.openURL(FACE_RD_PLAY_STORE_URL);
        }
      } else {
        // iOS - open web link (FaceRD is Android only)
        await Linking.openURL(FACE_RD_PLAY_STORE_URL);
      }
    } catch (error) {
      console.error('Error opening Play Store:', error);
    }
  };

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
            backgroundColor: colors.background || DarkThemeColors.black,
            borderWidth: appTheme === APP_THEMES.light ? 1 : 0,
            borderColor: appTheme === APP_THEMES.light ? (colors as any).cardBorder || '#E0E0E0' : 'transparent',
            shadowColor: appTheme === APP_THEMES.light ? colors.black_common : 'transparent',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: appTheme === APP_THEMES.light ? 0.2 : 0,
            shadowRadius: appTheme === APP_THEMES.light ? 8 : 0,
            elevation: appTheme === APP_THEMES.light ? 8 : 0,
          }
        ]}>
          {/* Icon/Logo - Install FaceRD Icon */}
          <View style={styles.iconContainer}>
            {/* Main circular background (Vector) */}
            <View style={styles.iconVector} />
            {/* Download/Install icon elements (Group 17107) */}
            <View style={styles.iconGroup}>
              <View style={styles.iconRectangle} />
              <View style={styles.iconEllipse} />
            </View>
          </View>

          {/* Message */}
          <AppText
            size={15}
            color={colors.text || DarkThemeColors.white_common}
            style={styles.message}
          >
            {t('faceRD.notInstalled', 'Download and install Aadhaar FaceRD for successful attendance.')}
          </AppText>

          {/* Download Button */}
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownload}
            activeOpacity={0.8}
          >
            <AppText
              size={15}
              color={colors.text || DarkThemeColors.white_common}
              style={styles.downloadButtonText}
            >
              {t('faceRD.downloadHere', 'Download Here')}
            </AppText>
          </TouchableOpacity>
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
    width: wp(75), // ~280px
    borderRadius: 15,
    padding: hp(3),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: 79.8,
    height: 79.8,
    marginTop: hp(1),
    marginBottom: hp(3),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconVector: {
    position: 'absolute',
    // Circular background - based on design percentages
    // The vector spans from 39.36% to 60.64% horizontally (21.28% width)
    // and from 41.23% to 51.06% vertically (9.83% height)
    // Making it a full circle for better visibility
    width: 79.8 * 0.5, // ~40px - making it more visible
    height: 79.8 * 0.5, // ~40px
    left: 79.8 * 0.25, // Center horizontally
    top: 79.8 * 0.25, // Center vertically
    backgroundColor: '#CD861B',
    borderRadius: 79.8 * 0.25, // Full circle
  },
  iconGroup: {
    position: 'absolute',
    width: 5.83,
    height: 32.67,
    // Center the download arrow within the icon
    left: (79.8 - 5.83) / 2, // Center horizontally
    top: (79.8 - 32.67) / 2, // Center vertically
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconRectangle: {
    width: 5.83,
    height: 22.36,
    backgroundColor: DarkThemeColors.white_common,
  },
  iconEllipse: {
    width: 5.83,
    height: 5.83,
    backgroundColor: DarkThemeColors.white_common,
    borderRadius: 2.915,
    marginTop: 4.48, // Space between rectangle and ellipse (32.67 - 22.36 - 5.83)
  },
  message: {
    width: 278.79,
    height: 40,
    textAlign: 'center',
    marginBottom: hp(2),
    lineHeight: 20,
    paddingHorizontal: wp(2),
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: 15,
  },
  downloadButton: {
    width: 157.18,
    height: 39,
    backgroundColor: '#62C268',
    borderRadius: 74.2424 / 2, // 74.2424px / 2
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(1),
  },
  downloadButtonText: {
    width: 110,
    height: 20,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Noto Sans',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: 15,
  },
});

