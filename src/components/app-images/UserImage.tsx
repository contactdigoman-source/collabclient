import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import AppImage from './AppImage';
import {
  FontTypes,
  hp,
  Icons,
  PUNCH_DIRECTIONS,
} from '../../constants';
import AppText from '../app-texts/AppText';
import { ImageSourcePropType } from 'react-native';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

interface UserImageProps {
  size?: number;
  source?: ImageSourcePropType | null;
  isAttendanceStatusVisible?: boolean;
  isClickable?: boolean;
  onPress?: () => void;
  punchDirection?: typeof PUNCH_DIRECTIONS[keyof typeof PUNCH_DIRECTIONS];
  isDummy?: boolean;
  userName?: string;
  charsCount?: number;
  charsColor?: string;
}

export default function UserImage(props: UserImageProps): React.JSX.Element {
  const { appTheme } = useAppSelector(state => state.appState);
  const colors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;
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
    charsColor,
  } = props;
  
  const finalCharsColor = charsColor || colors.white;

  const firstCharsOfString = (stringValue: string = '', charsCount: number = 1): string | null => {
    const stringValue_trimmed = stringValue.trim();
    if (stringValue_trimmed.length > 0) {
      // Split by spaces to get first and last name
      const parts = stringValue_trimmed.split(/\s+/).filter(part => part.length > 0);
      if (parts.length >= 2) {
        // If we have at least first and last name, show lastname first, then firstname
        const lastName = parts[parts.length - 1]; // Last part is lastname
        const firstName = parts[0]; // First part is firstname
        const initials = (lastName.charAt(0) + firstName.charAt(0)).toUpperCase();
        return initials.substring(0, charsCount);
      } else if (parts.length === 1) {
        // If only one name, show first char
        return parts[0].charAt(0).toUpperCase();
      }
    }
    return null;
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
    [size, isAttendanceStatusVisible, attendanceStatus, colors.transparent, CONTAINER_SIZE],
  );

  const subContainerStyle = useMemo(
    () => ({
      height: SUB_CONTAINER_SIZE,
      width: SUB_CONTAINER_SIZE,
      borderRadius: SUB_CONTAINER_SIZE / 2, // ✅ proper circular border radius
      borderColor: colors.transparent,
      borderWidth: BORDER_INNER,
    }),
    [SUB_CONTAINER_SIZE, colors.transparent],
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
          style={{ backgroundColor: colors.user_image_bg } as ViewStyle}
        >
          {userName && !source ? (
            <View style={styles.charsContainer}>
              <AppText
                size={size / 2.75}
                color={finalCharsColor}
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

