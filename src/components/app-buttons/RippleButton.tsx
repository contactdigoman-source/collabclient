import React, { ReactNode } from 'react';
import Ripple, { RippleProps } from 'react-native-material-ripple';
import { useAppSelector } from '../../redux';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';

interface RippleButtonProps extends RippleProps {
  children?: ReactNode;
  rippleColor?: string;
}

const RippleButton: React.FC<RippleButtonProps> = ({ children, rippleColor, ...props }) => {
  const { appTheme } = useAppSelector(state => state.appState);
  const colors = appTheme === APP_THEMES.dark ? DarkThemeColors : LightThemeColors;
  return (
    <Ripple {...props} rippleColor={rippleColor || colors.white}>
      {children}
    </Ripple>
  );
};

export default RippleButton;

