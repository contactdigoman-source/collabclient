import { RootState } from '../store';

export const selectIsAuthenticatingFace = (state: RootState) =>
  state.userState.isAuthenticatingFace;
