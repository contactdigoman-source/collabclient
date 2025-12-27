import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { logger } from '../logger';

// Import react-native-permissions with error handling
let check: any;
let request: any;
let PERMISSIONS: any;
let RESULTS: any;
let PermissionStatus: any;

try {
  const RNPermissions = require('react-native-permissions');
  check = RNPermissions.check;
  request = RNPermissions.request;
  PERMISSIONS = RNPermissions.PERMISSIONS;
  RESULTS = RNPermissions.RESULTS;
  PermissionStatus = RNPermissions.PermissionStatus;
} catch (error) {
  logger.warn('react-native-permissions not available, iOS permissions will fallback to basic handling', error);
}

export type PermissionType =
  | 'location'
  | 'storage'
  | 'camera'
  | 'microphone'
  | 'phone'
  | 'device';

export interface PermissionStatus {
  type: PermissionType;
  granted: boolean;
  canRequest: boolean;
}

// Map permission types to react-native-permissions constants for iOS
const getIOSPermission = (type: PermissionType): string | null => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  // If react-native-permissions is not available, return null
  if (!PERMISSIONS || !PERMISSIONS.IOS) {
    return null;
  }

  switch (type) {
    case 'location':
      return PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    case 'camera':
      return PERMISSIONS.IOS.CAMERA;
    case 'microphone':
      return PERMISSIONS.IOS.MICROPHONE;
    case 'phone':
      return PERMISSIONS.IOS.CONTACTS; // iOS doesn't have direct phone permission
    case 'storage':
    case 'device':
      return null; // Not applicable on iOS
    default:
      return null;
  }
};

// Map permission types to Android permission constants
// Accessing constants directly to avoid Hermes "property is not configurable" errors
const getAndroidPermission = (type: PermissionType): typeof PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION | null => {
  if (Platform.OS !== 'android') {
    return null;
  }

  // Access constants directly without storing in variables to avoid frozen object issues
  switch (type) {
    case 'location':
      return PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    case 'storage':
      return PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    case 'camera':
      return PermissionsAndroid.PERMISSIONS.CAMERA;
    case 'microphone':
      return PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    case 'phone':
      return PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE;
    case 'device':
      return PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE;
    default:
      return null;
  }
};

// Helper to convert react-native-permissions status to our PermissionStatus
const convertRNPermissionStatus = (
  type: PermissionType,
  status: any,
): PermissionStatus => {
  if (!RESULTS) {
    return { type, granted: false, canRequest: false };
  }
  const granted = status === RESULTS.GRANTED;
  const canRequest = status === RESULTS.DENIED || status === RESULTS.BLOCKED;
  return { type, granted, canRequest };
};

/**
 * Check if a specific permission is granted
 * Uses react-native-permissions for iOS location permissions
 */
export const checkPermission = async (
  type: PermissionType,
): Promise<PermissionStatus> => {
  try {
    if (Platform.OS === 'ios') {
      const iosPermission = getIOSPermission(type);
      if (!iosPermission) {
        // Permission not applicable on iOS (e.g., storage, device) or react-native-permissions not available
        if (!PERMISSIONS) {
          logger.warn(`react-native-permissions not available for iOS permission check: ${type}`);
        }
        return { type, granted: false, canRequest: false };
      }

      if (!check) {
        logger.warn(`react-native-permissions check function not available for iOS permission: ${type}`);
        return { type, granted: false, canRequest: false };
      }

      try {
        const status = await check(iosPermission as any);
        return convertRNPermissionStatus(type, status);
      } catch (error) {
        logger.error(`Error checking iOS permission ${type}`, error);
        return { type, granted: false, canRequest: false };
      }
    }

    const permission = getAndroidPermission(type);
    if (!permission) {
      return { type, granted: false, canRequest: false };
    }

    const result = await PermissionsAndroid.check(permission);
    return {
      type,
      granted: result,
      canRequest: !result, // Can request if not granted
    };
  } catch (error) {
    logger.error(`Error checking permission ${type}`, error);
    return { type, granted: false, canRequest: false };
  }
};

/**
 * Request a specific permission
 * Uses react-native-permissions for iOS location permissions
 */
export const requestPermission = async (
  type: PermissionType,
): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      const iosPermission = getIOSPermission(type);
      if (!iosPermission) {
        // Permission not applicable on iOS or react-native-permissions not available
        if (!PERMISSIONS) {
          logger.warn(`react-native-permissions not available for iOS permission request: ${type}`);
        }
        return false;
      }

      if (!request || !RESULTS) {
        logger.warn(`react-native-permissions request function not available for iOS permission: ${type}`);
        return false;
      }

      try {
        const status = await request(iosPermission as any);
        return status === RESULTS.GRANTED;
      } catch (error) {
        logger.error(`Error requesting iOS permission ${type}`, error);
        return false;
      }
    }

    const permission = getAndroidPermission(type);
    if (!permission) {
      return false;
    }

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    logger.error(`Error requesting permission ${type}`, error);
    return false;
  }
};

/**
 * Check all required permissions
 */
export const checkAllPermissions = async (): Promise<PermissionStatus[]> => {
  const permissionTypes: PermissionType[] = [
    'location',
    'storage',
    'camera',
    'microphone',
    'phone',
    'device',
  ];

  const results = await Promise.all(
    permissionTypes.map((type) => checkPermission(type)),
  );

  return results;
};

/**
 * Request all required permissions sequentially
 */
export const requestAllPermissions = async (): Promise<{
  allGranted: boolean;
  results: PermissionStatus[];
}> => {
  const permissionTypes: PermissionType[] = [
    'location',
    'storage',
    'camera',
    'microphone',
    'phone',
    'device',
  ];

  const results: PermissionStatus[] = [];

  for (const type of permissionTypes) {
    const status = await checkPermission(type);
    if (!status.granted && status.canRequest) {
      const granted = await requestPermission(type);
      results.push({ type, granted, canRequest: !granted });
    } else {
      results.push(status);
    }
  }

  const allGranted = results.every((r) => r.granted);

  return { allGranted, results };
};

/**
 * Check if all required permissions are granted
 */
export const areAllPermissionsGranted = async (): Promise<boolean> => {
  const statuses = await checkAllPermissions();
  return statuses.every((status) => status.granted);
};

/**
 * Get missing permissions
 */
export const getMissingPermissions = async (): Promise<PermissionType[]> => {
  const statuses = await checkAllPermissions();
  return statuses.filter((s) => !s.granted).map((s) => s.type);
};

/**
 * Open app settings for user to manually grant permissions
 */
export const openAppSettings = (): void => {
  try {
    Linking.openSettings();
  } catch (error) {
    logger.error('Error opening app settings', error);
  }
};

/**
 * Show alert to user about missing permissions
 */
export const showPermissionAlert = (
  missingPermissions: PermissionType[],
  onSettingsPress?: () => void,
): void => {
  const permissionNames = missingPermissions
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(', ');

  Alert.alert(
    'Permissions Required',
    `The app requires the following permissions to function properly: ${permissionNames}. Please grant these permissions in settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          openAppSettings();
          onSettingsPress?.();
        },
      },
    ],
  );
};


