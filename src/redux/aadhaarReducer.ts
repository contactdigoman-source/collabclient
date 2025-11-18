import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const aadhaarSlice = createSlice({
  name: 'aadhaarState',
  initialState: {
    isAuthenticatingFace: false,
    isAadhaarFaceValidated: false,
  },
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
