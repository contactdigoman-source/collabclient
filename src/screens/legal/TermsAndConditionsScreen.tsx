import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { AppContainer, BackHeader, AppText } from '../../components';
import { Configs, hp, wp } from '../../constants';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';

// Try to import WebView, fallback to Linking if not available
let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (e) {
  console.log('react-native-webview not installed, using fallback');
}

export default function TermsAndConditionsScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  const handleLoadEnd = (): void => {
    setLoading(false);
  };

  const handleLoadStart = (): void => {
    setLoading(true);
  };

  const handleBackPress = (): void => {
    navigation.goBack();
  };

  // Summary text for Terms and Conditions
  const termsSummary = t('terms.summary');

  return (
    <AppContainer>
      <View style={styles.container}>
        <BackHeader
          onBackPress={handleBackPress}
          rightContent={
            <View style={{ width: hp('2.48%'), height: hp('2.48%') }} />
          }
        />
        {WebView && Configs.privacyPolicyUrl ? (
          <View style={styles.webViewContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            <WebView
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              style={styles.webView}
              source={{ uri: Configs.privacyPolicyUrl }}
            />
          </View>
        ) : (
          <ScrollView
            style={styles.fallbackContainer}
            contentContainerStyle={styles.fallbackContent}
          >
            <AppText size={hp(2)} style={styles.fallbackText}>
              {t('terms.title')}
            </AppText>
            <AppText size={hp(1.8)} style={styles.summaryText}>
              {termsSummary}
            </AppText>
            <AppText size={hp(1.6)} style={styles.fallbackSubtext}>
              {t('terms.openedInBrowser')}
            </AppText>
            <AppText size={hp(1.6)} style={styles.fallbackSubtext}>
              {t('terms.readAndReturn')}
            </AppText>
          </ScrollView>
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
    backgroundColor: 'transparent',
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
  },
  fallbackContent: {
    padding: hp(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    marginBottom: hp(2),
    textAlign: 'center',
    fontWeight: 'bold',
  },
  summaryText: {
    marginBottom: hp(2),
    textAlign: 'left',
    lineHeight: hp(2.5),
    paddingHorizontal: wp(5),
  },
  fallbackSubtext: {
    marginBottom: hp(1),
    textAlign: 'center',
    opacity: 0.8,
  },
});

