import React, { memo, useCallback, useMemo } from 'react';
import { Animated, StyleSheet, AnimatedValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useTheme } from '@react-navigation/native';
import moment from 'moment';

import { hp, Icons, wp } from '../../constants';
import { UserImage } from '../../components';
import { NavigationProp } from '../../types/navigation';
import { PUNCH_DIRECTIONS } from '../../constants';
import { useAppSelector } from '../../redux';

interface HomeHeaderProps {
  bgColor?: string | AnimatedValue;
  borderBottomColor?: string | AnimatedValue;
  punchTimestamp?: string | number | null;
  punchDirection?: typeof PUNCH_DIRECTIONS[keyof typeof PUNCH_DIRECTIONS];
  textColor?: string | AnimatedValue;
  userName?: string;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({
  bgColor = 'transparent',
  borderBottomColor = 'transparent',
  punchTimestamp = null,
  punchDirection,
  textColor,
  userName = '',
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { userData } = useAppSelector(state => state.userState);

  const formattedDate = useMemo(
    () =>
      punchTimestamp
        ? moment(punchTimestamp).format('DD MMM, YY')
        : '-- ---, --',
    [punchTimestamp],
  );
  const formattedTime = useMemo(
    () =>
      punchTimestamp
        ? `${moment(punchTimestamp).format('hh:mm A')} ${punchDirection}`
        : '--:--',
    [punchTimestamp, punchDirection],
  );

  const headerContainerStyle = useMemo(
    () => [
      styles.headerContainer,
      {
        paddingTop: insets.top || wp('2%'),
        backgroundColor: bgColor, // can now be Animated.Value
        borderBottomColor, // can now be Animated.Value
      },
    ],
    [insets.top, bgColor, borderBottomColor],
  );

  const onProfilePress = useCallback((): void => {
    navigation.navigate('ProfileDrawerScreen');
  }, [navigation]);

  return (
    <Animated.View style={styles.container}>
      <Animated.View style={headerContainerStyle}>
        <UserImage
          source={userData?.profilePhoto ? { uri: userData.profilePhoto } : null}
          userName={userData?.profilePhoto ? undefined : userName}
          size={wp('10%')}
          isClickable
          punchDirection={punchDirection}
          onPress={onProfilePress}
          charsCount={2}
        />
        <Animated.View style={styles.middleSection}>
          <Animated.Text style={{ color: textColor || colors.white }}>
            {formattedDate}
          </Animated.Text>
          <Animated.Text style={{ color: textColor || colors.white }}>
            {formattedTime}
          </Animated.Text>
        </Animated.View>
        <Animated.Image
          style={styles.chatIcon}
          source={Icons.chat}
          tintColor={textColor || colors.white}
        />
      </Animated.View>
    </Animated.View>
  );
};

function areEqual(
  prevProps: HomeHeaderProps,
  nextProps: HomeHeaderProps,
): boolean {
  // Note: This comparison doesn't include userData.profilePhoto changes
  // because userData comes from Redux, not props. The component will
  // re-render when Redux state changes anyway.
  return (
    prevProps.userName === nextProps.userName &&
    prevProps.punchTimestamp === nextProps.punchTimestamp &&
    prevProps.punchDirection === nextProps.punchDirection
  );
}

export default memo(HomeHeader, areEqual);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: wp('2%'),
    borderBottomWidth: 1,
  },
  middleSection: { flex: 1, paddingHorizontal: wp('3%') },
  chatIcon: {
    height: hp(3),
    width: hp(3),
    resizeMode: 'contain',
  },
});

