import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import AppText from '../app-texts/AppText';
import { hp, Icons, wp } from '../../constants';
import AppImage from '../app-images/AppImage';
import RippleButton from '../app-buttons/RippleButton';

const ProfileDrawerItem = ({
  icon = Icons.home,
  title = 'Item Title',
  iconColor,
  rightContent = null,
  style,
  ...rest
}) => {
  // ✅ Memoize combined container style to avoid re-creation every render
  const subContainerStyle = useMemo(
    () => [styles.subContainer, style],
    [style],
  );

  return (
    <View style={styles.container}>
      <RippleButton style={subContainerStyle} {...rest}>
        <AppImage size={hp(2.48)} source={icon} tintColor={iconColor} />
        <AppText size={hp(1.98)} style={styles.title}>
          {title}
        </AppText>
      </RippleButton>

      {rightContent}
    </View>
  );
};

// ✅ Wrap with memo to prevent re-renders unless props change
export default memo(ProfileDrawerItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: hp(2),
  },
  title: {
    marginStart: wp(4),
  },
});
