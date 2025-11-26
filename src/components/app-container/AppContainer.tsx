import { useTheme } from '@react-navigation/native';
import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface AppContainerProps {
  children?: ReactNode;
  style?: ViewStyle;
}

const AppContainer: React.FC<AppContainerProps> = ({ children, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default memo(AppContainer);

