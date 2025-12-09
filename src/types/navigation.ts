import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  LoginScreen: undefined;
  FirstTimeLoginScreen: undefined;
  PermissionsScreen: undefined;
  DashboardScreen: undefined;
  ForgotPasswordScreen: { emailID?: string };
  CheckInScreen: undefined;
  ConfirmPunchScreen: undefined;
  ProfileDrawerScreen: undefined;
  AttendanceLogsScreen: undefined;
  ViewProfileScreen: undefined;
  OtpScreen: {
    emailID?: string;
    isAadhaarFallback?: boolean;
    aadhaarNumber?: string;
    isPasswordReset?: boolean;
    isPunchFlow?: boolean;
  };
  ChangeForgottenPassword: { emailID?: string };
  AadhaarInputScreen: undefined;
  PanCardCaptureScreen: undefined;
  PrivacyPolicyScreen: undefined;
  TermsAndConditionsScreen: undefined;
  ProfilePhotoScreen: undefined;
  UsbDebuggingBlockScreen: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

