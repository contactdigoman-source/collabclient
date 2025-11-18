import React, { useState, memo } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useTheme } from '@react-navigation/native';
import { hp, Icons } from '../../constants';
import RippleButton from '../app-buttons/RippleButton';
import { AppText } from '..';

function AppImage({
  source = null,
  size = hp('2%'),
  isRounded = false,
  isClickable = false,
  onPress,
  onLongPress,
  style,
  borderRadius,
  height = size,
  width = size,
  resizeMode = 'contain',
  isNoPreviewTitle = false,
  noPreviewIconSize = hp('3%'),
  noPreviewTitleSize = hp('1.74%'),
  isLoadingVisible = true,
  tintColor,
  children,
  ...props
}) {
  const { colors } = useTheme();
  const [status, setStatus] = useState('idle');

  const handleLoadStart = () => {
    if (source?.uri && isLoadingVisible) setStatus('loading');
  };

  const handleLoad = () => setStatus('idle');
  const handleLoadEnd = () => setStatus('idle');
  const handleError = () => {
    if (source?.uri) setStatus('error');
  };

  const finalBorderRadius = borderRadius ?? (isRounded ? size / 2 : 0);

  return (
    <RippleButton
      rippleContainerBorderRadius={finalBorderRadius}
      disabled={!isClickable}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <FastImage
        {...props}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        style={[style, { width, height, borderRadius: finalBorderRadius }]}
        tintColor={style?.tintColor || tintColor}
        resizeMode={resizeMode}
        source={
          source?.uri
            ? { uri: source.uri, priority: FastImage.priority.high }
            : source
        }
      >
        {isLoadingVisible && source?.uri && (
          <View style={styles.overlay}>
            {status === 'loading' && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            {status === 'error' && (
              <View style={styles.errorContainer}>
                <FastImage
                  style={{
                    width: noPreviewIconSize,
                    height: noPreviewIconSize,
                  }}
                  source={Icons.eye_closed}
                  resizeMode="contain"
                  tintColor={colors.white}
                />
                {isNoPreviewTitle && (
                  <AppText
                    size={noPreviewTitleSize}
                    color={colors.white}
                    style={styles.errorText}
                  >
                    No preview available
                  </AppText>
                )}
              </View>
            )}
          </View>
        )}
        {children}
      </FastImage>
    </RippleButton>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    paddingTop: hp('1%'),
  },
});

export default memo(AppImage);
