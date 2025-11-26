import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { AppContainer, BackHeader, AppText } from '../../components';
import { Configs, hp, wp } from '../../constants';
import { NavigationProp } from '../../types/navigation';

// Try to import WebView, fallback to Linking if not available
let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (e) {
  console.log('react-native-webview not installed, using fallback');
}

export default function PrivacyPolicyScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If WebView is not available, open in browser
    if (!WebView && Configs.privacyPolicyUrl) {
      Linking.openURL(Configs.privacyPolicyUrl).catch((err) =>
        console.error('Failed to open privacy policy URL:', err),
      );
    }
  }, []);

  const handleLoadEnd = (): void => {
    setLoading(false);
  };

  const handleLoadStart = (): void => {
    setLoading(true);
  };

  const handleBackPress = (): void => {
    // Navigate to PermissionsScreen instead of going back
    navigation.replace('PermissionsScreen');
  };

  return (
    <AppContainer>
      <View style={styles.container}>
        <BackHeader
          onBackPress={handleBackPress}
          rightContent={
            <View style={{ width: hp('2.48%'), height: hp('2.48%') }} />
          }
        />
        {WebView ? (
          <View style={styles.webViewContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            <WebView
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              style={[styles.webView, { backgroundColor: 'transparent' }]}
              source={{ uri: Configs.privacyPolicyUrl }}
            />
          </View>
        ) : (
          <View style={styles.fallbackContainer}>
            <AppText size={hp(2)} style={styles.fallbackText}>
              Privacy Policy
            </AppText>
            <AppText size={hp(1.8)} style={styles.fallbackSubtext}>
              The privacy policy has been opened in your browser.
            </AppText>
            <AppText size={hp(1.6)} style={styles.fallbackSubtext}>
              Please read it and return to continue.
            </AppText>
          </View>
        )}
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    marginHorizontal: wp('2.54%'),
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: hp(4),
  },
  fallbackText: {
    marginBottom: hp(2),
    textAlign: 'center',
  },
  fallbackSubtext: {
    marginBottom: hp(1),
    textAlign: 'center',
    opacity: 0.8,
  },
});
