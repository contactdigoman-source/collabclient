import React from 'react';
import Ripple from 'react-native-material-ripple';
import { useTheme } from '@react-navigation/native';

const RippleButton = props => {
  const { colors } = useTheme();
  return (
    <Ripple {...props} rippleColor={props?.rippleColor || colors.white}>
      {props?.children}
    </Ripple>
  );
};

export default RippleButton;
