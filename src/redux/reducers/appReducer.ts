import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppState, AppTheme } from '../types';

const initialState: AppState = {
  appTheme: 'dark',
};

const appSlice = createSlice({
  name: 'appState',
  initialState,
  reducers: {
    setAppTheme(state, action: PayloadAction<AppTheme>) {
      state.appTheme = action.payload;
    },
  },
});

export const { setAppTheme } = appSlice.actions;
export default appSlice.reducer;
