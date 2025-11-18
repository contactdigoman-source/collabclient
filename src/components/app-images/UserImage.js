import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import AppImage from './AppImage';
import {
  FontTypes,
  hp,
  Icons,
  Images,
  PUNCH_DIRECTIONS,
} from '../../constants';
import AppText from '../app-texts/AppText';

export default function UserImage(props) {
  const { colors } = useTheme();
  const {
    size = hp('6%'),
    source = null,
    isAttendanceStatusVisible = true,
    isClickable = false,
    onPress = () => {},
    punchDirection = PUNCH_DIRECTIONS.out,
    isDummy = false,
    userName = '',
    charsCount = 2,
    charsColor = colors.white,
  } = props;

  const firstCharsOfString = (stringValue = '', charsCount = 1) => {
    let stringValue_trimmed = stringValue.trim();
    if (stringValue_trimmed.length > 0) {
      var matches = stringValue.match(/\b(\w)/g);
      var acronym = matches.join('');
      return acronym.substring(0, charsCount);
    } else {
      return null;
    }
  };

  // ✅ Add `colors` to dependency (to recalc when theme changes)
  const attendanceStatus = useMemo(() => {
    switch (punchDirection) {
      case PUNCH_DIRECTIONS.in:
        return colors.checked_in_indicator;
      case PUNCH_DIRECTIONS.out:
      default:
        return colors.checked_out_indicator;
    }
  }, [punchDirection, colors]);

  const BORDER_OUTER = size / 18;
  const BORDER_INNER = size / 8;

  const SUB_CONTAINER_SIZE = size + BORDER_INNER;
  const CONTAINER_SIZE = SUB_CONTAINER_SIZE + BORDER_OUTER;

  // ✅ Simplify & fix dependencies (no need for unused colors)
  const containerStyle = useMemo(
    () => ({
      height: CONTAINER_SIZE,
      width: CONTAINER_SIZE,
      borderRadius: CONTAINER_SIZE / 2, // ✅ proper circular border radius
      borderColor: isAttendanceStatusVisible
        ? attendanceStatus
        : colors.transparent,
      borderWidth: BORDER_OUTER,
    }),
    [size, isAttendanceStatusVisible, attendanceStatus, colors.transparent],
  );

  const subContainerStyle = useMemo(
    () => ({
      height: SUB_CONTAINER_SIZE,
      width: SUB_CONTAINER_SIZE,
      borderRadius: SUB_CONTAINER_SIZE / 2, // ✅ proper circular border radius
      borderColor: colors.transparent,
      borderWidth: BORDER_INNER,
    }),
    [size, isAttendanceStatusVisible, attendanceStatus, colors.transparent],
  );

  if (isDummy) {
    return (
      <View
        style={[
          styles.container,
          containerStyle,
          { backgroundColor: colors.my_teams_dummy_item_bg },
        ]}
      >
        <AppImage size={size / 2} source={Icons.dummy_user} />
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.container, subContainerStyle]}>
        <AppImage
          size={size}
          isRounded
          source={source}
          isClickable={isClickable}
          onPress={onPress}
          accessibilityRole={isClickable ? 'imagebutton' : 'image'}
          accessibilityLabel="User profile picture"
          style={{ backgroundColor: colors.user_image_bg }}
        >
          {userName && !source ? (
            <View style={styles.charsContainer}>
              <AppText
                size={size / 2.75}
                color={charsColor}
                fontType={FontTypes.medium}
                style={styles.charsText}
              >
                {firstCharsOfString(userName, charsCount)}
              </AppText>
            </View>
          ) : null}
        </AppImage>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  charsContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charsText: { alignSelf: 'center', textTransform: 'uppercase' },
});
