import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useTheme } from '@react-navigation/native';
import { AppContainer, BackHeader, AppText } from '../../components';
import { Configs, hp, wp } from '../../constants';
import { NavigationProp } from '../../types/navigation';
import { useTranslation } from '../../hooks/useTranslation';
import { logger } from '../../services/logger';

export default function PrivacyPolicyScreen(): React.JSX.Element {
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
    // Navigate back to FirstTimeLoginScreen
    navigation.goBack();
  };

  const handleError = (syntheticEvent: any): void => {
    const { nativeEvent } = syntheticEvent;
    logger.error('WebView error: ', nativeEvent);
    setLoading(false);
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
        {Configs.privacyPolicyUrl ? (
          <View style={styles.webViewContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            <WebView
              source={{ uri: Configs.privacyPolicyUrl }}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              // onHttpError={(syntheticEvent) => {
              //   const { nativeEvent } = syntheticEvent;
              //   logger.error('WebView HTTP error: ', nativeEvent);
              //   setLoading(false);
              // }}
              style={styles.webView}
              startInLoadingState={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsBackForwardNavigationGestures={true}
              scalesPageToFit={true}
              mixedContentMode="always"
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              originWhitelist={['*']}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
        ) : (
          <View style={styles.fallbackContainer}>
            <AppText size={hp(2)} style={styles.fallbackText}>
              {t('privacy.title')}
            </AppText>
            <AppText size={hp(1.6)} style={styles.fallbackSubtext}>
              Privacy Policy URL is not configured
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
