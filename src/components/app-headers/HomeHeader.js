import React, { memo, useCallback, useMemo } from 'react';
import { Alert, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useTheme } from '@react-navigation/native';
import moment from 'moment';

import { hp, Icons, wp } from '../../constants';
import { UserImage } from '../../components';

const HomeHeader = ({
  bgColor = 'transparent',
  borderBottomColor = 'transparent',
  punchTimestamp = null,
  punchDirection,
  textColor,
  userName = '',
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();

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
    [punchTimestamp],
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

  const onProfilePress = useCallback(() => {
    navigation.navigate('ProfileDrawerScreen');
  }, []);

  return (
    <Animated.View style={styles.container}>
      <Animated.View style={headerContainerStyle}>
        <UserImage
          source={null}
          userName={userName}
          size={wp('10%')}
          isClickable
          punchDirection={punchDirection}
          onPress={onProfilePress}
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
        {/* <AppImage
          size={hp('3%')}
          source={Icons.chat}
          tintColor={colors.white}
          isClickable
        /> */}
      </Animated.View>
    </Animated.View>
  );
};

function areEqual(prevProps, nextProps) {
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
