import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';

import { AppContainer, AppImage, AppText, HomeHeader } from '../../components';
import { useAppSelector } from '../../redux';
import { hp, Images } from '../../constants';

export default function DaysBottomTabScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const userLastAttendance = useAppSelector(
    state => state.userState.userLastAttendance,
  );
  const userData = useAppSelector(state => state.userState.userData);

  return (
    <AppContainer>
      <View style={styles.container}>
        <AppImage size={hp(20)} source={Images.forgot_pass_image} />
        <AppText size={hp(2.2)} style={{ marginTop: hp(2) }}>
          {'This feature is locked!'}
        </AppText>
      </View>
      <HomeHeader
        userName={`${userData?.firstName || ''} ${userData?.lastName || ''}`}
        borderBottomColor={colors.home_header_border}
        punchTimestamp={userLastAttendance?.Timestamp}
        punchDirection={userLastAttendance?.PunchDirection}
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

