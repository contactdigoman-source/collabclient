import React, { memo, useMemo, ReactNode } from 'react';
import { Platform, Text, StyleSheet, TextStyle } from 'react-native';
import { FontTypes, hp } from '../../constants';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

interface AppTextProps {
  fontType?: keyof typeof FontTypes;
  size?: number;
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
  children?: ReactNode;
  [key: string]: any;
}

function AppText({
  fontType = FontTypes.regular,
  size = hp('1.74%'),
  color,
  style,
  numberOfLines,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  const { appTheme } = useAppSelector(state => state.appState);
  const colors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;

  const FONTWEIGHT = useMemo(() => {
    switch (fontType) {
      case FontTypes.bold:
        return 'bold';

      case FontTypes.medium:
        return '600';

      case FontTypes.regular:
        return '400';

      default:
        return '400';
    }
  }, [fontType]);

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.base,
        {
          fontSize: size,
          color: color || colors.white,
          fontWeight: FONTWEIGHT,
          lineHeight: Platform.OS === 'ios' ? size * 1.2 : size * 1.25,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false, // Android: removes extra padding
    textAlignVertical: 'center',
  },
});

export default memo(AppText);

