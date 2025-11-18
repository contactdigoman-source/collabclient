import Geolocation from '@react-native-community/geolocation';
import {
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import axios from 'axios';

import store from '../redux/store';
import { setUserLocationRegion } from '../redux/userReducer';
import { Configs } from '../constants';

const { LocationEnabler } = NativeModules;

export const isLocationEnabled = async () => {
  if (Platform.OS === 'android') {
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

export async function requestLocationPermission(onCancelPress) {
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

export function openAppSettings() {
  try {
    Linking.openSettings();
  } catch (error) {
    console.log('openSettings error', error);
  }
}

export async function getCurrentPositionOfUser() {
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

export const getLocationFromLatLon = async (latitude, longitude) => {
  try {
    const { data } = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${Configs.googleMapsApiKey}`,
    );

    return data?.results?.[0]?.formatted_address || null;
  } catch (error) {
    console.log('Error fetching address:', error);
    return null;
  }
};

export function watchUserLocation(onLocationUpdate) {
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

export function clearWatch(watchId) {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
  }
}
