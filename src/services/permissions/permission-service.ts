import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { PERMISSIONS, request, check, RESULTS, openSettings } from 'react-native-permissions';

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

// Map permission types to platform-specific permissions
const getPermissionConstant = (type: PermissionType): string => {
  if (Platform.OS === 'ios') {
    switch (type) {
      case 'location':
        return PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      case 'storage':
        return PERMISSIONS.IOS.PHOTO_LIBRARY;
      case 'camera':
        return PERMISSIONS.IOS.CAMERA;
      case 'microphone':
        return PERMISSIONS.IOS.MICROPHONE;
      case 'phone':
        return PERMISSIONS.IOS.CONTACTS; // iOS doesn't have phone state permission
      case 'device':
        return PERMISSIONS.IOS.IDFA; // Device identifier
      default:
        return '';
    }
  } else {
    switch (type) {
      case 'location':
        return PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      case 'storage':
        return PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      case 'camera':
        return PERMISSIONS.ANDROID.CAMERA;
      case 'microphone':
        return PERMISSIONS.ANDROID.RECORD_AUDIO;
      case 'phone':
        return PERMISSIONS.ANDROID.READ_PHONE_STATE;
      case 'device':
        return PERMISSIONS.ANDROID.READ_PHONE_STATE; // Device ID is part of phone state
      default:
        return '';
    }
  }
};

/**
 * Check if a specific permission is granted
 */
export const checkPermission = async (
  type: PermissionType,
): Promise<PermissionStatus> => {
  try {
    const permission = getPermissionConstant(type);
    if (!permission) {
      return { type, granted: false, canRequest: false };
    }

    const result = await check(permission);
    return {
      type,
      granted: result === RESULTS.GRANTED || result === RESULTS.LIMITED,
      canRequest: result === RESULTS.DENIED,
    };
  } catch (error) {
    console.error(`Error checking permission ${type}:`, error);
    return { type, granted: false, canRequest: false };
  }
};

/**
 * Request a specific permission
 */
export const requestPermission = async (
  type: PermissionType,
): Promise<boolean> => {
  try {
    const permission = getPermissionConstant(type);
    if (!permission) {
      return false;
    }

    const result = await request(permission);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  } catch (error) {
    console.error(`Error requesting permission ${type}:`, error);
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
  openSettings().catch(() => {
    Linking.openSettings();
  });
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


