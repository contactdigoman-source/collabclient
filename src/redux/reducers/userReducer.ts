import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_REGION } from '../../constants';
import {
  UserState,
  UserData,
  LocationRegion,
  AttendanceRecord,
} from '../types';

const initialState: UserState = {
  userData: null,
  userLocationRegion: DEFAULT_REGION,
  userLastAttendance: null,
  userAttendanceHistory: [],
  userAadhaarFaceValidated: false,
  lastAadhaarVerificationDate: null,
  isPanCardVerified: false,
  storedAadhaarNumber: null,
};

const userSlice = createSlice({
  name: 'userState',
  initialState,
  reducers: {
    setUserData(state, action: PayloadAction<UserData | null>) {
      state.userData = action.payload;
    },
    setUserLocationRegion(state, action: PayloadAction<LocationRegion>) {
      const payload = { ...action.payload };
      payload.latitudeDelta = 0.01;
      payload.longitudeDelta = 0.01;
      state.userLocationRegion = payload;
    },
    setUserLastAttendance(state, action: PayloadAction<AttendanceRecord | null>) {
      state.userLastAttendance = action.payload;
    },
    setUserAttendanceHistory(state, action: PayloadAction<AttendanceRecord[]>) {
      state.userAttendanceHistory = action.payload;
      if (action.payload?.length > 0) {
        state.userLastAttendance = action.payload[0];
      }
    },
    setUserAadhaarFaceValidated(state, action: PayloadAction<boolean>) {
      console.log('setUserAadhaarFaceValidated', action.payload);
      state.userAadhaarFaceValidated = action.payload;
      if (action.payload) {
        // Store today's date when Aadhaar is verified
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        state.lastAadhaarVerificationDate = today;
        state.isPanCardVerified = false;
      }
    },
    setLastAadhaarVerificationDate(state, action: PayloadAction<string | null>) {
      state.lastAadhaarVerificationDate = action.payload;
    },
    setIsPanCardVerified(state, action: PayloadAction<boolean>) {
      state.isPanCardVerified = action.payload;
      if (action.payload) {
        // Store today's date when PAN card is verified
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        state.lastAadhaarVerificationDate = today;
        state.userAadhaarFaceValidated = true; // Allow check-in
      }
    },
    setStoredAadhaarNumber(state, action: PayloadAction<string | null>) {
      state.storedAadhaarNumber = action.payload;
    },
  },
});

export const {
  setUserData,
  setUserLocationRegion,
  setUserLastAttendance,
  setUserAttendanceHistory,
  setUserAadhaarFaceValidated,
  setLastAadhaarVerificationDate,
  setIsPanCardVerified,
  setStoredAadhaarNumber,
} = userSlice.actions;
export default userSlice.reducer;
