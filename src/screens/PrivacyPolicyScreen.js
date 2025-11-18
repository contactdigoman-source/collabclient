import React from 'react';
import { View, StyleSheet } from 'react-native';

import { AppContainer, AppImage, AppText, BackHeader } from '../components';
import { hp, Images } from '../constants';

export default function PrivacyPolicyScreen() {
  return (
    <AppContainer>
      <BackHeader />
      <View style={styles.container}>
        <AppImage size={hp(20)} source={Images.forgot_pass_image} />
        <AppText size={hp(2.2)} style={{ marginTop: hp(2) }}>
          {'This feature is locked!'}
        </AppText>
      </View>
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
