import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';

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

/**
 * Check if a specific permission is granted
 * Note: iOS permissions are handled differently and may require react-native-permissions for full support
 */
export const checkPermission = async (
  type: PermissionType,
): Promise<PermissionStatus> => {
  try {
    if (Platform.OS === 'ios') {
      // iOS permissions require Info.plist configuration and may need react-native-permissions
      // For now, return a default status (can be enhanced later)
      console.warn(`iOS permission check for ${type} - consider using react-native-permissions for full support`);
      return { type, granted: false, canRequest: true };
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
    console.error(`Error checking permission ${type}:`, error);
    return { type, granted: false, canRequest: false };
  }
};

/**
 * Request a specific permission
 * Note: iOS permissions are handled differently and may require react-native-permissions for full support
 */
export const requestPermission = async (
  type: PermissionType,
): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      // iOS permissions require Info.plist configuration and may need react-native-permissions
      // For now, return false (can be enhanced later)
      console.warn(`iOS permission request for ${type} - consider using react-native-permissions for full support`);
      return false;
    }

    const permission = getAndroidPermission(type);
    if (!permission) {
      return false;
    }

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
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
  try {
    Linking.openSettings();
  } catch (error) {
    console.error('Error opening app settings:', error);
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


