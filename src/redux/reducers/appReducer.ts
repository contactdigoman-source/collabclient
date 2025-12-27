import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppState, AppTheme, DeviceRegistrationData, TimeZoneData } from '../types';

const initialState: AppState = {
  appTheme: 'dark',
  correlationId: null,
  deviceRegistration: null,
  timeZoneData: null,
};

const appSlice = createSlice({
  name: 'appState',
  initialState,
  reducers: {
    setAppTheme(state, action: PayloadAction<AppTheme>) {
      state.appTheme = action.payload;
    },
    setCorrelationId(state, action: PayloadAction<string>) {
      state.correlationId = action.payload;
    },
    resetCorrelationId(state) {
      state.correlationId = null;
    },
    setDeviceRegistration(state, action: PayloadAction<DeviceRegistrationData>) {
      state.deviceRegistration = action.payload;
    },
    setTimeZoneData(state, action: PayloadAction<TimeZoneData>) {
      state.timeZoneData = action.payload;
    },
  },
});

export const { setAppTheme, setCorrelationId, resetCorrelationId, setDeviceRegistration, setTimeZoneData } = appSlice.actions;
export default appSlice.reducer;
