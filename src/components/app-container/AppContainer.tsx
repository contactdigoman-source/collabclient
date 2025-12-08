import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

interface AppContainerProps {
  children?: ReactNode;
  style?: ViewStyle;
}

const AppContainer: React.FC<AppContainerProps> = ({ children, style }) => {
  const { appTheme } = useAppSelector(state => state.appState);
  
  // Use Redux theme directly - it's the source of truth and works everywhere
  const backgroundColor = appTheme === APP_THEMES.dark 
    ? DarkThemeColors.background 
    : LightThemeColors.background;
  
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
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

