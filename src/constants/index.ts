import {
  widthPercentageToDP,
  heightPercentageToDP,
} from 'react-native-responsive-screen';
import { Images } from './Images';
import { Icons } from './Icons';
import {
  DEFAULT_REGION,
  MINIMUM_ACCURACY_REQUIRED,
  PUNCH_DIRECTIONS,
  ZOOM_IN_DELTA,
  ZOOM_OUT_DELTA,
} from './location';
import { Configs } from './configs';

export const FontTypes = {
  regular: 'regular',
  medium: 'medium',
  bold: 'bold',
} as const;

const wp =
  widthPercentageToDP('100%') < heightPercentageToDP('100%')
    ? widthPercentageToDP
    : heightPercentageToDP;
const hp =
  widthPercentageToDP('100%') > heightPercentageToDP('100%')
    ? widthPercentageToDP
    : heightPercentageToDP;

export const MAIL_FORMAT =
  /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;

export const PASSWORD_FORMAT =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*?[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[^\s]*$/;

export { wp, hp, Images, Icons, Configs };
export {
  DEFAULT_REGION,
  MINIMUM_ACCURACY_REQUIRED,
  ZOOM_IN_DELTA,
  ZOOM_OUT_DELTA,
  PUNCH_DIRECTIONS,
};

