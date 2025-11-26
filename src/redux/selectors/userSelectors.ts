import { RootState } from '../store';
import { UserData, AttendanceRecord } from '../types';

export const selectUserData = (state: RootState): UserData | null =>
  state.userState.userData;
export const selectUserLocationRegion = (state: RootState) =>
  state.userState.userLocationRegion;
export const selectUserLastAttendance = (
  state: RootState,
): AttendanceRecord | null => state.userState.userLastAttendance;

export const selectUserAttendanceHistory = (
  state: RootState,
): AttendanceRecord[] => state.userState.userAttendanceHistory;
export const selectUserAadhaarFaceValidated = (state: RootState) =>
  state.userState.userAadhaarFaceValidated;

export const selectUserEmail = (state: RootState): string | undefined =>
  state.userState.userData?.email;

export const selectUserName = (state: RootState): string => {
  const user = state.userState.userData;
  return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
};
