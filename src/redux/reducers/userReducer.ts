import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import moment from 'moment';
import { DEFAULT_REGION } from '../../constants';
import { logger } from '../../services/logger';
import {
  UserState,
  UserData,
  LocationRegion,
  AttendanceRecord,
  AccountStatus,
  FirstTimeLoginData,
} from '../types';

const initialState: UserState = {
  userData: null,
  jwtToken: null,
  idpjourneyToken: null,
  expiresAt: null,
  accountStatus: null,
  userLocationRegion: DEFAULT_REGION,
  userLastAttendance: null,
  userAttendanceHistory: [],
  userAadhaarFaceValidated: false,
  lastAadhaarVerificationDate: null,
  isPanCardVerified: false,
  storedAadhaarNumber: null,
  firstTimeLoginData: null,
  displayBreakStatus: false,
  isAuthenticatingFace: false, // UI loading state during Aadhaar authentication
};

const userSlice = createSlice({
  name: 'userState',
  initialState,
  reducers: {
    setUserData(state, action: PayloadAction<UserData | null>) {
      state.userData = action.payload;
    },
    setJWTToken(state, action: PayloadAction<string | null>) {
      state.jwtToken = action.payload;
    },
    setIdpjourneyToken(state, action: PayloadAction<string | null>) {
      state.idpjourneyToken = action.payload;
    },
    setExpiresAt(state, action: PayloadAction<string | null>) {
      state.expiresAt = action.payload;
    },
    setAccountStatus(state, action: PayloadAction<AccountStatus | null>) {
      state.accountStatus = action.payload;
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
      logger.debug('setUserAadhaarFaceValidated', { payload: action.payload });
      state.userAadhaarFaceValidated = action.payload;
      if (action.payload) {
        // Store today's date in UTC format (YYYY-MM-DD) when Aadhaar is verified
        const today = moment.utc().format('YYYY-MM-DD');
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
        // Store today's date in UTC format (YYYY-MM-DD) when PAN card is verified
        const today = moment.utc().format('YYYY-MM-DD');
        state.lastAadhaarVerificationDate = today;
        state.userAadhaarFaceValidated = true; // Allow check-in
      }
    },
    setStoredAadhaarNumber(state, action: PayloadAction<string | null>) {
      state.storedAadhaarNumber = action.payload;
    },
    setFirstTimeLoginData(state, action: PayloadAction<FirstTimeLoginData | null>) {
      state.firstTimeLoginData = action.payload;
    },
    setDisplayBreakStatus(state, action: PayloadAction<boolean>) {
      state.displayBreakStatus = action.payload;
    },
    setIsAuthenticatingFace(state, action: PayloadAction<boolean>) {
      state.isAuthenticatingFace = action.payload;
    },
    // Reset user state to initial state (for logout)
    resetUserState(_state) {
      return initialState;
    },
  },
});

export const {
  setUserData,
  setJWTToken,
  setIdpjourneyToken,
  setExpiresAt,
  setAccountStatus,
  setUserLocationRegion,
  setUserLastAttendance,
  setUserAttendanceHistory,
  setUserAadhaarFaceValidated,
  setLastAadhaarVerificationDate,
  setIsPanCardVerified,
  setStoredAadhaarNumber,
  setFirstTimeLoginData,
  setDisplayBreakStatus,
  setIsAuthenticatingFace,
  resetUserState,
} = userSlice.actions;
export default userSlice.reducer;
