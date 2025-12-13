import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import AppText from '../app-texts/AppText';
import { FontTypes, hp, wp } from '../../constants';

interface ComingSoonBadgeProps {
  style?: any;
}

export default function ComingSoonBadge({ style }: ComingSoonBadgeProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: colors.primary }, style]}>
      <AppText
        size={hp(1.2)}
        fontType={FontTypes.medium}
        color="#FFFFFF"
        style={styles.text}
      >
        Coming Soon
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: hp(0.5),
    right: wp(2),
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.3),
    borderRadius: hp(0.8),
    zIndex: 10,
  },
  text: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});


