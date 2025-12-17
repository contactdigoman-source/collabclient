import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  LoginScreen: undefined;
  FirstTimeLoginScreen: undefined;
  PermissionsScreen: undefined;
  DashboardScreen: undefined;
  ForgotPasswordScreen: { emailID?: string };
  CheckInScreen: undefined;
  ProfileDrawerScreen: undefined;
  AttendanceLogsScreen: { filterToday?: boolean } | undefined;
  GeoLocationsScreen: { filterToday?: boolean } | undefined;
  ViewProfileScreen: undefined;
  OtpScreen: {
    emailID?: string;
    isPasswordReset?: boolean;
    isPunchFlow?: boolean;
  };
  AadhaarOtpScreen: {
    emailID?: string;
    aadhaarNumber?: string;
  };
  ChangeForgottenPassword: { emailID?: string };
  ChangePasswordScreen: undefined;
  AadhaarInputScreen: undefined;
  PanCardCaptureScreen: undefined;
  PrivacyPolicyScreen: undefined;
  TermsAndConditionsScreen: undefined;
  ProfilePhotoScreen: undefined;
  UsbDebuggingBlockScreen: undefined;
  DatabaseViewerScreen: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

