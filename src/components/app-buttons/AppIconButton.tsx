import React, { useMemo } from 'react';
import { StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';
import { useTheme } from '@react-navigation/native';

import RippleButton from './RippleButton';
import { hp, Images } from '../../constants';
import AppText from '../app-texts/AppText';
import AppImage from '../app-images/AppImage';

interface AppIconButtonProps {
  source?: ImageSourcePropType;
  size?: number;
  title?: string;
  style?: ViewStyle;
}

function AppIconButton({
  source = Images.app_logo,
  size = hp('5%'),
  title = 'Title',
  style = {},
}: AppIconButtonProps): React.JSX.Element {
  const { colors } = useTheme();

  // ✅ Memoize dynamic style so it doesn't recalc each render
  const containerStyle = useMemo(
    () => [
      styles.container,
      { backgroundColor: colors.home_myspace_bg },
      style,
    ],
    [colors.home_myspace_bg, style],
  );

  return (
    <RippleButton rippleContainerBorderRadius={hp('1%')} style={containerStyle}>
      <AppImage size={size} source={source} />
      <AppText size={hp('1.49%')} style={styles.title}>
        {title}
      </AppText>
    </RippleButton>
  );
}

export default React.memo(AppIconButton);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: hp('1.86%'),
    borderRadius: hp('1%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: hp('1%'),
  },
});

