import React, { memo, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';
import AppText from '../app-texts/AppText';
import { hp, Icons } from '../../constants';
import AppImage from '../app-images/AppImage';
import RippleButton, { RippleButtonProps } from '../app-buttons/RippleButton';

interface ProfileDrawerItemProps extends Omit<RippleButtonProps, 'style'> {
  icon?: ImageSourcePropType;
  title?: string;
  iconColor?: string;
  rightContent?: React.ReactNode;
  style?: ViewStyle;
}

const ProfileDrawerItem: React.FC<ProfileDrawerItemProps> = ({
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
    marginStart: hp(1.49),
  },
});

