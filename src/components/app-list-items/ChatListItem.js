import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import AppText from '../app-texts/AppText';
import UserImage from '../app-images/UserImage';
import { FontTypes, hp, wp } from '../../constants';
import RippleButton from '../app-buttons/RippleButton';

const ChatListItem = () => {
  // Remove console.log in production (it prevents component from being pure)
  console.log('render ChatListItem');

  return (
    <RippleButton style={styles.container}>
      <UserImage size={hp(5)} />
      <View style={styles.subContainer}>
        <AppText fontType={FontTypes.medium}>{'Channel Name'}</AppText>
        <AppText size={hp(1.61)} style={styles.lastMessage}>
          {'Last Message'}
        </AppText>
      </View>
    </RippleButton>
  );
};

// ✅ Use React.memo to prevent re-renders if props don’t change
export default memo(ChatListItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1),
  },
  subContainer: {
    paddingHorizontal: wp(2),
  },
  lastMessage: {
    marginTop: hp(0.5),
  },
});
