import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  LoginScreen: undefined;
  FirstTimeLoginScreen: undefined;
  PermissionsScreen: undefined;
  DashboardScreen: undefined;
  ForgotPasswordScreen: { emailID?: string };
  ConfirmPunchScreen: undefined;
  ProfileDrawerScreen: undefined;
  AttendanceLogsScreen: undefined;
  ViewProfileScreen: undefined;
  OtpScreen: {
    emailID?: string;
    isAadhaarFallback?: boolean;
    aadhaarNumber?: string;
  };
  ChangeForgottenPassword: { emailID?: string };
  AadhaarInputScreen: undefined;
  PrivacyPolicyScreen: undefined;
  UsbDebuggingBlockScreen: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

