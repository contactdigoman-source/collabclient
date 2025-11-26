import { RootState } from '../store';
import { AppTheme } from '../types';

export const selectAppTheme = (state: RootState): AppTheme =>
  state.appState.appTheme;
