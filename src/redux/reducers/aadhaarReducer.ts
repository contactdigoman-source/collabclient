import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AadhaarState } from '../types';

const initialState: AadhaarState = {
  isAuthenticatingFace: false,
  isAadhaarFaceValidated: false,
};

const aadhaarSlice = createSlice({
  name: 'aadhaarState',
  initialState,
  reducers: {
    setIsAuthenticatingFace(state, action: PayloadAction<boolean>) {
      state.isAuthenticatingFace = action.payload;
    },
    setIsAadhaarFaceValidated(state, action: PayloadAction<boolean>) {
      state.isAadhaarFaceValidated = action.payload;
    },
  },
});

export const { setIsAuthenticatingFace, setIsAadhaarFaceValidated } =
  aadhaarSlice.actions;
export default aadhaarSlice.reducer;
