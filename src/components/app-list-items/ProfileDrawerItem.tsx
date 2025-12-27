import React, { memo, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';
import AppText from '../app-texts/AppText';
import { hp, Icons } from '../../constants';
import AppImage from '../app-images/AppImage';
import RippleButton from '../app-buttons/RippleButton';

interface ProfileDrawerItemProps {
  icon?: ImageSourcePropType;
  title?: string;
  iconColor?: string;
  rightContent?: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
  onPress?: () => void;
}

const ProfileDrawerItem: React.FC<ProfileDrawerItemProps> = ({
  icon = Icons.home,
  title = 'Item Title',
  iconColor,
  rightContent = null,
  style,
  disabled = false,
  onPress,
}) => {
  // ✅ Memoize combined container style to avoid re-creation every render
  const subContainerStyle = useMemo(
    () => [styles.subContainer, style],
    [style],
  );

  return (
    <View style={styles.container}>
      <RippleButton
        {...({ style: subContainerStyle } as any)}
        disabled={disabled}
        onPress={onPress}
      >
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

