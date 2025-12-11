// Export all services
// Using explicit exports to avoid circular dependency and undefined export issues

// Aadhaar services
export * from './aadhaar';

// Attendance services
export * from './attendance';

// Auth services (login, OTP, first-time login)
export * from './auth';

// Biometric services
export * from './biometric';

// Location services
// Note: openAppSettings from location-service takes precedence
export * from './location';

// Notification services
export * from './notifications';

// Permission services
// Excluding openAppSettings to avoid conflict with location-service
export {
  type PermissionType,
  type PermissionStatus,
  checkPermission,
  requestPermission,
  checkAllPermissions,
  requestAllPermissions,
  areAllPermissionsGranted,
  getMissingPermissions,
  showPermissionAlert,
} from './permissions';
// Re-export openAppSettings from permissions with alias to avoid conflict
export { openAppSettings as openAppSettingsForPermissions } from './permissions';

// Logger services
export * from './logger';

// Security services (named exports, not default)
export * from './security-service';

// Device services
export * from './device';
