import { RootState } from '../store';

export const selectIsAuthenticatingFace = (state: RootState) =>
  state.aadhaarState.isAuthenticatingFace;

export const selectIsAadhaarFaceValidated = (state: RootState) =>
  state.aadhaarState.isAadhaarFaceValidated;
