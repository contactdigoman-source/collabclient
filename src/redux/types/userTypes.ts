// User Data Types
export interface UserData {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  requiresPasswordChange?: boolean;
  roles?: string[];
  firstTimeLogin?: boolean;
  [key: string]: any; // Allow additional properties
}

// Account Status Type
export type AccountStatus = 'active' | 'locked' | 'password expired' | 'inactive';

// Location Region Type
export interface LocationRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// Attendance Record Type
export interface AttendanceRecord {
  Timestamp: number;
  OrgID?: string;
  UserID?: string;
  PunchType?: string;
  PunchDirection?: 'IN' | 'OUT';
  LatLon?: string;
  Address?: string;
  CreatedOn?: number;
  IsSynced?: 'Y' | 'N';
  DateOfPunch?: string;
  AttendanceStatus?: string;
  ModuleID?: string;
  TripType?: string;
  PassengerID?: string;
  AllowanceData?: any[] | string; // Can be array or JSON string
  IsCheckoutQrScan?: number;
  TravelerName?: string;
  PhoneNumber?: string;
}

// First Time Login Data (temporary storage before API submission)
export interface FirstTimeLoginData {
  firstName: string;
  lastName: string;
  newPassword: string;
}

// User State Type
export interface UserState {
  userData: UserData | null;
  jwtToken: string | null; // JWT token for API authentication
  accountStatus: AccountStatus | null; // Current account status
  userLocationRegion: LocationRegion;
  userLastAttendance: AttendanceRecord | null;
  userAttendanceHistory: AttendanceRecord[];
  userAadhaarFaceValidated: boolean;
  lastAadhaarVerificationDate: string | null; // Format: YYYY-MM-DD
  isPanCardVerified: boolean; // If user verified using PAN card instead of Aadhaar
  storedAadhaarNumber: string | null; // Stored Aadhaar number for Face RD verification
  firstTimeLoginData: FirstTimeLoginData | null; // Temporary storage for first-time login form data
}

