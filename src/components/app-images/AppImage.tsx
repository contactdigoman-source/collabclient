import React, { useState, memo, ReactNode } from 'react';
import { ActivityIndicator, View, StyleSheet, ImageStyle, ImageSourcePropType } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { useTheme } from '@react-navigation/native';
import { hp, Icons } from '../../constants';
import RippleButton from '../app-buttons/RippleButton';
import { AppText } from '..';

type ImageStatus = 'idle' | 'loading' | 'error';

interface AppImageProps extends Omit<FastImageProps, 'source'> {
  source?: ImageSourcePropType | { uri?: string };
  size?: number;
  isRounded?: boolean;
  isClickable?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ImageStyle;
  borderRadius?: number;
  height?: number;
  width?: number;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  isNoPreviewTitle?: boolean;
  noPreviewIconSize?: number;
  noPreviewTitleSize?: number;
  isLoadingVisible?: boolean;
  tintColor?: string;
  children?: ReactNode;
}

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
}: AppImageProps): React.JSX.Element {
  const { colors } = useTheme();
  const [status, setStatus] = useState<ImageStatus>('idle');

  const handleLoadStart = (): void => {
    if ((source as { uri?: string })?.uri && isLoadingVisible) setStatus('loading');
  };

  const handleLoad = (): void => setStatus('idle');
  const handleLoadEnd = (): void => setStatus('idle');
  const handleError = (): void => {
    if ((source as { uri?: string })?.uri) setStatus('error');
  };

  const finalBorderRadius = borderRadius ?? (isRounded ? size / 2 : 0);
  const imageSource = (source as { uri?: string })?.uri
    ? { uri: (source as { uri: string }).uri, priority: FastImage.priority.high }
    : (source as ImageSourcePropType);

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
        style={[style, { width, height, borderRadius: finalBorderRadius }] as ImageStyle}
        tintColor={(style as ImageStyle)?.tintColor || tintColor}
        resizeMode={resizeMode}
        source={imageSource}
      >
        {isLoadingVisible && (source as { uri?: string })?.uri && (
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

