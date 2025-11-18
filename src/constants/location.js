const DEFAULT_REGION = {
  latitude: 20.5937, // fallback: India center
  longitude: 78.9629,
  latitudeDelta: 5,
  longitudeDelta: 5,
};
const ZOOM_IN_DELTA = 0.004;
const ZOOM_OUT_DELTA = 0.0421;
const MINIMUM_ACCURACY_REQUIRED = 150; // meters

const PUNCH_DIRECTIONS = {
  in: 'IN',
  out: 'OUT',
};

export {
  DEFAULT_REGION,
  ZOOM_IN_DELTA,
  ZOOM_OUT_DELTA,
  MINIMUM_ACCURACY_REQUIRED,
  PUNCH_DIRECTIONS,
};
