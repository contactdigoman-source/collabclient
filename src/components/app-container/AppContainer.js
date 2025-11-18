import { useTheme } from '@react-navigation/native';
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

const AppContainer = props => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {props.children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default memo(AppContainer);
