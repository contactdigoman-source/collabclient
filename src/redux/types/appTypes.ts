// App Theme Type
export type AppTheme = 'dark' | 'light';

// Device Registration Data
export interface DeviceRegistrationData {
  deviceId: string;
  registeredAt: string;
  platform: string;
  platformVersion: string;
}

// Time Zone Data
export interface TimeZoneData {
  currentTime: string; // ISO 8601 format
  timezone: string; // Timezone name (e.g., "Asia/Kolkata")
  timezoneOffset: number; // Offset in minutes from UTC
  timestamp: number; // Unix timestamp in milliseconds
}

// App State Type
export interface AppState {
  appTheme: AppTheme;
  correlationId: string | null; // Unique correlation ID for logging
  deviceRegistration: DeviceRegistrationData | null;
  timeZoneData: TimeZoneData | null;
}

