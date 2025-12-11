import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'device-storage' });
const DEVICE_ID_KEY = 'device_unique_id';

/**
 * Generates a unique device identifier
 * Uses a combination of platform info and stored UUID
 * @returns {Promise<string>} Unique device identifier
 */
export const getDeviceUniqueIdentifier = async (): Promise<string> => {
  try {
    // Check if we already have a stored device ID
    const existingId = storage.getString(DEVICE_ID_KEY);
    if (existingId) {
      return existingId;
    }

    // Generate a new unique ID
    // Format: platform-timestamp-random
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const platform = Platform.OS;
    const deviceId = `${platform}-${timestamp}-${random}`;

    // Store it for future use
    storage.set(DEVICE_ID_KEY, deviceId);

    return deviceId;
  } catch (error) {
    // Fallback: generate a simple ID if storage fails
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${Platform.OS}-${timestamp}-${random}`;
  }
};

/**
 * Gets the stored device identifier without generating a new one
 * @returns {string | null} Stored device identifier or null if not found
 */
export const getStoredDeviceIdentifier = (): string | null => {
  try {
    return storage.getString(DEVICE_ID_KEY) || null;
  } catch {
    return null;
  }
};

