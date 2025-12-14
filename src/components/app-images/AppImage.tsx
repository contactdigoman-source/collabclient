import React, { useState, memo, ReactNode } from 'react';
import { ActivityIndicator, View, StyleSheet, ImageStyle, ImageSourcePropType, Image, Platform } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';
import { hp, Icons } from '../../constants';
import RippleButton from '../app-buttons/RippleButton';
import { AppText } from '..';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

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
  const { appTheme } = useAppSelector(state => state.appState);
  const colors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;
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
  
  // Handle image source - FastImage needs proper format for local assets on Android
  const getImageSource = () => {
    if (!source) return null; // No placeholder, return null
    
    // If it's a URI (remote image)
    if ((source as { uri?: string })?.uri) {
      const uri = (source as { uri: string }).uri;
      // Only return if URI is valid and not empty
      if (uri && uri.trim() !== '') {
        return { uri, priority: FastImage.priority.high };
      }
      return null;
    }
    
    // Handle require() assets - check for default export first
    let localSource = source;
    if ((source as any)?.default) {
      localSource = (source as any).default;
    }
    
    // For local require() assets on Android, ensure proper format
    if (typeof localSource === 'number') {
      // FastImage should handle numbers directly, but on Android we'll use resolveAssetSource
      // to get a proper URI format if needed
      if (Platform.OS === 'android') {
        try {
          const resolvedSource = Image.resolveAssetSource(localSource);
          // If resolved to a file:// URI, FastImage might not handle it well
          // So we'll use the number directly which should work
          if (resolvedSource && !resolvedSource.uri?.startsWith('file://')) {
            return { uri: resolvedSource.uri, priority: FastImage.priority.normal };
          }
        } catch (e) {
          // If resolution fails, use the number directly
        }
      }
      // Use the number directly - FastImage should handle this
      return localSource;
    }
    
    // For other formats, pass as-is
    return localSource as ImageSourcePropType;
  };
  
  const imageSource = getImageSource();

  // If no valid source, just render children in a container
  if (!imageSource) {
    return (
      <RippleButton
        rippleContainerBorderRadius={finalBorderRadius}
        disabled={!isClickable}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <View style={[style, { width, height, borderRadius: finalBorderRadius }] as ImageStyle}>
          {children}
        </View>
      </RippleButton>
    );
  }

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
              // No placeholder - let parent component handle fallback (e.g., initials)
              null
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

