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
    },
  },
});

export const {
  setUserData,
  setUserLocationRegion,
  setUserLastAttendance,
  setUserAttendanceHistory,
  setUserAadhaarFaceValidated,
} = userSlice.actions;
export default userSlice.reducer;
