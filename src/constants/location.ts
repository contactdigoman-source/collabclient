export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export const DEFAULT_REGION: Region = {
  latitude: 20.5937, // fallback: India center
  longitude: 78.9629,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

export const ZOOM_IN_DELTA = 0.004;
export const ZOOM_OUT_DELTA = 0.0421;
export const MINIMUM_ACCURACY_REQUIRED = 150; // meters

export const PUNCH_DIRECTIONS = {
  in: 'IN',
  out: 'OUT',
} as const;

