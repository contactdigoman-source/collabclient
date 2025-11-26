import React, { ReactNode } from 'react';
import Ripple, { RippleProps } from 'react-native-material-ripple';
import { useTheme } from '@react-navigation/native';

interface RippleButtonProps extends RippleProps {
  children?: ReactNode;
  rippleColor?: string;
}

const RippleButton: React.FC<RippleButtonProps> = ({ children, rippleColor, ...props }) => {
  const { colors } = useTheme();
  return (
    <Ripple {...props} rippleColor={rippleColor || colors.white}>
      {children}
    </Ripple>
  );
};

export default RippleButton;

