import axios from 'axios';
import { Configs } from '../../constants/configs';
import { getJWTToken } from '../auth/login-service';
import { logServiceError } from '../logger';

const API_BASE_URL = Configs.apiBaseUrl;

// Attendance Days API Types
export interface AttendanceDayRecord {
  Timestamp: number;
  PunchDirection: 'IN' | 'OUT';
  AttendanceStatus?: string | null;
  LatLon?: string;
  Address?: string;
  DateOfPunch?: string;
}

export interface AttendanceDay {
  dateOfPunch: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'PARTIAL';
  totalDuration: string; // Format: "HH:mm"
  breakDuration: string; // Format: "HH:mm"
  records: AttendanceDayRecord[];
}

export interface GetDaysAttendanceResponse {
  data: AttendanceDay[];
}

/**
 * Get attendance data grouped by days
 * Returns attendance records grouped by date with calculated durations
 */
export const getDaysAttendance = async (): Promise<AttendanceDay[]> => {
  try {
    const token = await getJWTToken('');
    // if (!token) {
    //   // Return empty array if no token - treat as no data available
    //   return [];
    // }

    const response = await axios.get<any[]>(
      `${API_BASE_URL}/api/attendance/days`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    // Transform API response to match our types
    const data = response.data || [];
    return data.map((day: any) => ({
      dateOfPunch: day.dateOfPunch,
      attendanceStatus: day.attendanceStatus,
      totalDuration: day.totalDuration,
      breakDuration: day.breakDuration,
      records: (day.records || []).map((record: any) => ({
        Timestamp: record.Timestamp || record.timestamp,
        PunchDirection: record.PunchDirection || record.punchDirection,
        AttendanceStatus: record.AttendanceStatus !== undefined ? record.AttendanceStatus : record.attendanceStatus,
        LatLon: record.LatLon || record.latLon,
        Address: record.Address || record.address,
        DateOfPunch: record.DateOfPunch || record.dateOfPunch,
      })),
    }));
  } catch (error: any) {
    // Log service error with context
    logServiceError(
      'attendance',
      'attendance-service.ts',
      'getDaysAttendance',
      error,
      {
        request: {
          url: `${API_BASE_URL}/api/attendance/days`,
          method: 'GET',
          statusCode: error.response?.status,
          responseBody: error.response?.data,
        },
        metadata: {
          hasResponse: !!error.response,
          hasRequest: !!error.request,
        },
      }
    );

    // Return empty array on error - treat as no data available
    return [];
  }
};

