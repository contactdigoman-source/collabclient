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

const FontTypes = {
  regular: 'regular',
  medium: 'medium',
  bold: 'bold',
};

const wp =
  widthPercentageToDP('100%') < heightPercentageToDP('100%')
    ? widthPercentageToDP
    : heightPercentageToDP;
const hp =
  widthPercentageToDP('100%') > heightPercentageToDP('100%')
    ? widthPercentageToDP
    : heightPercentageToDP;

const MAIL_FORMAT =
  /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/;

const PASSWORD_FORMAT =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*?[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[^\s]*$/;

export {
  FontTypes,
  wp,
  hp,
  Images,
  Icons,
  MAIL_FORMAT,
  DEFAULT_REGION,
  MINIMUM_ACCURACY_REQUIRED,
  ZOOM_IN_DELTA,
  ZOOM_OUT_DELTA,
  PUNCH_DIRECTIONS,
  Configs,
  PASSWORD_FORMAT,
};
