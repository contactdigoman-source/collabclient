// App Theme Type
export type AppTheme = 'dark' | 'light';

// App State Type
export interface AppState {
  appTheme: AppTheme;
  correlationId: string | null; // Unique correlation ID for logging
}

