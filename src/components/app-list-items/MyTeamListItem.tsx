import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';

import { FontTypes, hp, wp } from '../../constants';
import AppText from '../app-texts/AppText';
import RippleButton from '../app-buttons/RippleButton';

interface MyTeamListItemProps {
  teamName?: string;
  isDummy?: boolean;
}

const MyTeamListItem: React.FC<MyTeamListItemProps> = ({ teamName = '', isDummy = false }) => {
  const { colors } = useTheme();

  // ✅ Memoize dynamic styles to avoid new object creation each render
  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        backgroundColor: isDummy
          ? colors.my_teams_dummy_item_bg
          : colors.my_teams_item_bg,
        borderColor: isDummy ? colors.transparent : colors.my_teams_item_border,
      },
    ],
    [colors.my_teams_item_bg, colors.my_teams_item_border, colors.my_teams_dummy_item_bg, colors.transparent, isDummy],
  );

  return (
    <RippleButton rippleContainerBorderRadius={hp(1.86)} style={containerStyle}>
      {!isDummy && (
        <AppText fontType={FontTypes.medium}>{teamName}</AppText>
      )}
    </RippleButton>
  );
};

// ✅ Memoize component to prevent re-renders when props and theme don't change
export default memo(MyTeamListItem);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: hp(11.11),
    margin: wp(1),
    borderWidth: 1,
    borderRadius: hp(1.86),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

