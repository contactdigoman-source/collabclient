/**
 * BackHeader Component
 * A customizable header with back arrow, title, and optional middle/right content.
 */

import React, { memo, useCallback, useMemo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontTypes, Icons, hp } from '../../constants';
import { AppImage, AppText } from '../../components';
import { NavigationProp } from '../../types/navigation';

interface BackHeaderProps {
  title?: string;
  onBackPress?: () => void;
  rightContent?: ReactNode;
  isBottomBorder?: boolean;
  bgColor?: string;
  isTitleVisible?: boolean;
  middleContent?: ReactNode;
  fontType?: keyof typeof FontTypes;
  borderBottomColor?: string;
  titleStyle?: TextStyle;
}

function BackHeader({
  title,
  onBackPress,
  rightContent,
  isBottomBorder = false,
  bgColor,
  isTitleVisible = true,
  middleContent,
  fontType = FontTypes.bold,
  borderBottomColor,
  titleStyle,
}: BackHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        borderBottomWidth: isBottomBorder ? 1 : 0,
        backgroundColor: bgColor || colors.black,
        borderBottomColor: borderBottomColor || colors.grey_dark_37,
      },
    ],
    [isBottomBorder, bgColor, colors, borderBottomColor],
  );

  const onBackArrowPress = useCallback((): void => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [onBackPress, navigation]);

  return (
    <View
      style={[
        styles.safeArea,
        { backgroundColor: bgColor || colors.black, paddingTop: insets.top },
      ]}
    >
      <View style={containerStyle}>
        {/* Left Section - Back Button */}
        <AppImage
          isClickable
          size={hp('2.48%')}
          source={Icons.back_arrow}
          style={styles.backIcon}
          tintColor={colors.text}
          onPress={onBackArrowPress}
          accessibilityRole="button"
          accessibilityLabel="Back"
        />

        {/* Middle Section - Title or Custom */}
        <View style={styles.middleSection}>
          {isTitleVisible ? (
            <AppText
              numberOfLines={1}
              size={hp('1.98%')}
              fontType={fontType}
              style={titleStyle}
            >
              {title}
            </AppText>
          ) : (
            middleContent
          )}
        </View>

        {/* Right Section */}
        {rightContent ? (
          <View style={styles.rightSection}>{rightContent}</View>
        ) : (
          <AppImage size={hp('2.48%')} source={null} style={styles.backIcon} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIcon: {
    margin: hp('1.86%'),
  },
  middleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    paddingEnd: hp('1.86%'),
  },
});

export default memo(BackHeader);

