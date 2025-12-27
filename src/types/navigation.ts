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
  LoginOtpScreen: {
    emailID?: string;
  };
  AadhaarOtpScreen: {
    emailID?: string;
    aadhaarNumber?: string;
  };
  ChangePasswordScreen: {
    emailID?: string;
    token?: string; // Token from OTP verification (if present, it's password expired from login flow - no current password needed)
  } | undefined; // If no params, it's from profile page (requires current password)
  AadhaarInputScreen: undefined;
  PanCardCaptureScreen: undefined;
  PrivacyPolicyScreen: undefined;
  TermsAndConditionsScreen: undefined;
  ProfilePhotoScreen: undefined;
  UsbDebuggingBlockScreen: undefined;
  DatabaseViewerScreen: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

