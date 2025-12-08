// User Data Types
export interface UserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: any; // Allow additional properties
}

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

// User State Type
export interface UserState {
  userData: UserData | null;
  userLocationRegion: LocationRegion;
  userLastAttendance: AttendanceRecord | null;
  userAttendanceHistory: AttendanceRecord[];
  userAadhaarFaceValidated: boolean;
  lastAadhaarVerificationDate: string | null; // Format: YYYY-MM-DD
  isPanCardVerified: boolean; // If user verified using PAN card instead of Aadhaar
}

