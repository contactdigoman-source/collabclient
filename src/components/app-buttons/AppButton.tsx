import React, { memo } from 'react';
import { StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { FontTypes, hp, wp } from '../../constants';
import { AppText, RippleButton } from '..';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

interface AppButtonProps {
  title?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
  titleSize?: number;
  titleColor?: string;
  borderRadius?: number;
}

function AppButton({
  title = 'Submit',
  loading = false,
  disabled = false,
  style,
  onPress,
  titleSize = hp(2.24),
  titleColor = 'white',
  borderRadius = wp(100),
}: AppButtonProps): React.JSX.Element {
  const { appTheme } = useAppSelector(state => state.appState);
  const colors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;

  return (
    <RippleButton
      rippleContainerBorderRadius={borderRadius}
      disabled={disabled || loading}
      activeOpacity={0.5}
      accessibilityRole="button"
      accessible
      style={[
        styles.buttonContainer,
        {
          opacity: disabled ? 0.5 : 1,
          borderRadius: borderRadius,
          backgroundColor: colors.primary,
        },
        style,
      ]}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator style={styles.loader} color={titleColor} />
      ) : (
        <AppText
          size={titleSize}
          fontType={FontTypes.medium}
          color={titleColor}
        >
          {title}
        </AppText>
      )}
    </RippleButton>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(3.82),
    paddingVertical: hp(2),
  },
  loader: {
    flex: 1,
    height: hp(3),
    width: hp(3),
  },
});

export default memo(AppButton);

