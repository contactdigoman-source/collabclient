import { Platform } from 'react-native';
import apiClient from '../api/api-client';
import { logger } from '../logger';
import { getDeviceUniqueIdentifier } from './device-identifier-service';

export interface DeviceRegistrationRequest {
  deviceId: string;
  platform: string;
  platformVersion: string;
  appVersion?: string;
  deviceModel?: string;
  deviceManufacturer?: string;
}

export interface DeviceRegistrationResponse {
  success: boolean;
  message: string;
  deviceId: string;
  registeredAt: string;
}

/**
 * Register device with the server
 */
export const registerDevice = async (): Promise<DeviceRegistrationResponse> => {
  try {
    const deviceId = await getDeviceUniqueIdentifier();
    
    const request: DeviceRegistrationRequest = {
      deviceId,
      platform: Platform.OS,
      platformVersion: Platform.Version?.toString() || 'unknown',
      // Add more device info if available
    };

    logger.debug('Registering device', { deviceId, platform: Platform.OS });

    const response = await apiClient.post<DeviceRegistrationResponse>(
      '/api/device/register',
      request,
    );

    logger.info('Device registered successfully', { 
      deviceId: response.data.deviceId,
      registeredAt: response.data.registeredAt,
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to register device', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Failed to register device'
    );
  }
};

