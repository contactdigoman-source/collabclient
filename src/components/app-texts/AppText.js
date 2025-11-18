import React, { memo, useMemo } from 'react';
import { Platform, Text, StyleSheet } from 'react-native';
import { FontTypes, hp } from '../../constants';
import { useTheme } from '@react-navigation/native';
// import { getFontFamily } from '../services/utils';

function AppText({
  fontType = FontTypes.regular,
  size = hp('1.74%'),
  color,
  style,
  numberOfLines,
  children,
  ...rest
}) {
  const { colors } = useTheme();

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
          // fontFamily: getFontFamily(fontType),
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
