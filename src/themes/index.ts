import { DarkThemeColors, LightThemeColors } from './colors';
import { LightTheme } from './light';
import { DarkTheme } from './dark';

export const APP_THEMES = {
  dark: 'dark',
  light: 'light',
  default: 'default',
} as const;

export { DarkThemeColors, LightThemeColors, LightTheme, DarkTheme };

