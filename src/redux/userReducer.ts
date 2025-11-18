import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_REGION } from '../constants';

const userSlice = createSlice({
  name: 'userState',
  initialState: {
    userData: null,
    userLocationRegion: DEFAULT_REGION,
    userLastAttendance: null,
    userAttendanceHistory: [],
    userAadhaarFaceValidated: false,
  },
  reducers: {
    setUserData(state, action: PayloadAction<any>) {
      state.userData = action.payload;
    },
    setUserLocationRegion(state, action: PayloadAction<any>) {
      action.payload.latitudeDelta = 0.01;
      action.payload.longitudeDelta = 0.01;
      state.userLocationRegion = action.payload;
    },
    setUserLastAttendance(state, action: PayloadAction<any>) {
      state.userLastAttendance = action.payload;
    },
    setUserAttendanceHistory(state, action: PayloadAction<any>) {
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
