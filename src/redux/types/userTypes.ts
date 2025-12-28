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
export type AccountStatus = 'active' | 'locked' | 'passwordExpired' | 'inactive';

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
  // New fields for approval workflow and status tracking
  ApprovalRequired?: 'Y' | 'N';
  Reason?: 'FORGOT_TO_CHECKOUT' | 'MANUAL_CORRECTION' | null;
  OriginalCheckoutTime?: number;
  CorrectedCheckoutTime?: number;
  WorkedHours?: number;
  MinimumHoursRequired?: number;
  
  // For overnight shifts - links Day 2 checkout to Day 1 entry
  LinkedEntryDate?: string;
  
  // For correction tracking
  CorrectionType?: 'FORGOT_CHECKOUT' | 'MANUAL_TIME' | null;
  ManualCheckoutTime?: number;
  
  // Store shift times with each record (captured at check-in time)
  ShiftStartTime?: string;   // "HH:mm" - from profile at check-in
  ShiftEndTime?: string;     // "HH:mm" - from profile at check-in
}

// First Time Login Data (temporary storage before API submission)
export interface FirstTimeLoginData {
  firstName: string;
  lastName: string;
  newPassword: string;
  permissions?: string[]; // List of permission IDs that were consented to
  permissionsTimestamp?: string; // ISO 8601 format - time when permissions were granted
}

// User State Type
export interface UserState {
  userData: UserData | null;
  jwtToken: string | null; // JWT token for API authentication
  idpjourneyToken: string | null; // IDP journey token from login, used in OTP verification
  expiresAt: string | null; // Session expiration timestamp (ISO 8601 format)
  accountStatus: AccountStatus | null; // Current account status
  userLocationRegion: LocationRegion;
  userLastAttendance: AttendanceRecord | null;
  userAttendanceHistory: AttendanceRecord[];
  userAadhaarFaceValidated: boolean;
  lastAadhaarVerificationDate: string | null; // Format: YYYY-MM-DD
  isPanCardVerified: boolean; // If user verified using PAN card instead of Aadhaar
  storedAadhaarNumber: string | null; // Stored Aadhaar number for Face RD verification
  firstTimeLoginData: FirstTimeLoginData | null; // Temporary storage for first-time login form data
  displayBreakStatus: boolean; // User preference to display break status on home screen
  isAuthenticatingFace: boolean; // UI loading state during Aadhaar authentication
}

