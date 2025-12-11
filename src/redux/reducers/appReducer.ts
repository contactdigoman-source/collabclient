import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppState, AppTheme } from '../types';

const initialState: AppState = {
  appTheme: 'dark',
  correlationId: null,
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
  },
});

export const { setAppTheme, setCorrelationId, resetCorrelationId } = appSlice.actions;
export default appSlice.reducer;
