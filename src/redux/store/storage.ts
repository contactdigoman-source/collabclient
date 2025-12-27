import { Storage } from 'redux-persist';
import { logger } from '../../services/logger';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const reduxStorage: Storage = {
  setItem: (key, value) => {
    storage.set(key, value);
    return Promise.resolve();
  },
  getItem: key => {
    const value = storage.getString(key);
    return Promise.resolve(value ?? null);
  },
  removeItem: key => {
    storage.delete(key);
    return Promise.resolve();
  },
};

export const clearStorage = () => {
  try {
    storage.clearAll();
  } catch (error) {
    logger.debug('clearStorage error', error);
  }
};

export default reduxStorage;
