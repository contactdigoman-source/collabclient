import Geolocation from '@react-native-community/geolocation';
import {
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import axios from 'axios';

import { store, setUserLocationRegion } from '../../redux';
import { Configs } from '../../constants';

interface LocationEnablerModule {
  isLocationEnabled: () => Promise<boolean>;
  enableLocation: () => Promise<boolean>;
}

const { LocationEnabler } = NativeModules as {
  LocationEnabler?: LocationEnablerModule;
};

export const isLocationEnabled = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    if (!LocationEnabler) {
      console.warn('LocationEnabler native module not found');
      return false;
    }
    // 2️⃣ Check if location is ON
    const isEnabled = await LocationEnabler.isLocationEnabled();
    if (!isEnabled) {
      const result = await LocationEnabler.enableLocation();
      return result; // true if user turned it on
    }
    return isEnabled;
  } else {
    return true;
  }
};

export async function requestLocationPermission(
  onCancelPress: () => void,
): Promise<boolean> {
  try {
    // 1️⃣ Request location permission
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Permission denied',
          'You declined the permission to access to your location. Please turn it on manually from settings.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => onCancelPress() },
            { text: 'Go to Settings', onPress: () => openAppSettings() },
          ],
          {
            cancelable: false,
          },
        );
        return false;
      }
    }

    return true; // already on
  } catch (error) {
    console.log('Error checking location:', error);
    return false;
  }
}

export function openAppSettings(): void {
  try {
    Linking.openSettings();
  } catch (error) {
    console.log('openSettings error', error);
  }
}

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export async function getCurrentPositionOfUser(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        store.dispatch(setUserLocationRegion(position.coords));
        resolve(position.coords);
      },
      error => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

export const getLocationFromLatLon = async (
  latitude: number,
  longitude: number,
): Promise<string | null> => {
  try {
    const apiKey = Configs.googleMapsApiKey;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    
    console.log('Calling Google Geocoding API:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    
    const { data } = await axios.get<{
      results?: Array<{ formatted_address?: string }>;
      status?: string;
      error_message?: string;
    }>(url);

    console.log('Google Geocoding API response status:', data?.status);
    
    if (data?.status === 'OK' && data?.results && data.results.length > 0) {
      const address = data.results[0]?.formatted_address || null;
      console.log('Google API returned address:', address);
      return address;
    } else {
      console.log('Google API error:', data?.status, data?.error_message);
      return null;
    }
  } catch (error: any) {
    console.log('Error fetching address from Google API:', error?.message || error);
    if (error?.response) {
      console.log('API Error Response:', error.response.status, error.response.data);
    }
    return null;
  }
};

export function watchUserLocation(
  onLocationUpdate: (coords: Coordinates) => void,
): number {
  const watchId = Geolocation.watchPosition(
    position => {
      onLocationUpdate(position.coords);
    },
    error => {
      console.log('Watch error:', error);
    },
    { enableHighAccuracy: true, distanceFilter: 0, interval: 5000 }, // update every 5s
  );

  return watchId;
}

export function clearWatch(watchId: number | null): void {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
  }
}

