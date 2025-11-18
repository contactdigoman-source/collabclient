/**
 * BackHeader Component
 * A customizable header with back arrow, title, and optional middle/right content.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';

import { FontTypes, Icons, hp } from '../../constants';
import { AppImage, AppText } from '../../components';

function BackHeader({
  title,
  onBackPress,
  rightContent,
  isBottomBorder,
  bgColor,
  isTitleVisible,
  middleContent,
  fontType,
  borderBottomColor,
  titleStyle,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();
  console.log('BackHeader rendered');

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

  const onBackArrowPress = useCallback(() => {
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
          tintColor={colors.white}
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

BackHeader.defaultProps = {
  isBottomBorder: false,
  isTitleVisible: true,
  fontType: FontTypes.bold,
};

BackHeader.propTypes = {
  title: PropTypes.string,
  onBackPress: PropTypes.func,
  rightContent: PropTypes.node,
  isBottomBorder: PropTypes.bool,
  bgColor: PropTypes.string,
  isTitleVisible: PropTypes.bool,
  middleContent: PropTypes.node,
  fontType: PropTypes.string,
  borderBottomColor: PropTypes.string,
  titleStyle: PropTypes.object,
};

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
