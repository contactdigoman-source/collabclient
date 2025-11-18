import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const appSlice = createSlice({
  name: 'appState',
  initialState: {
    appTheme: 'dark',
  },
  reducers: {
    setAppTheme(state, action: PayloadAction<string>) {
      state.appTheme = action.payload;
    },
  },
});

export const { setAppTheme } = appSlice.actions;
export default appSlice.reducer;
