import * as Keychain from 'react-native-keychain';
import { store, persistor } from '../../redux';

export const logoutUser = async (): Promise<void> => {
  // Clear Aadhaar data from Keychain before logout
  const userData = store.getState().userState?.userData;
  if (userData?.email) {
    try {
      await Keychain.resetGenericPassword({
        service: userData.email,
      });
    } catch (error) {
      console.log('Error clearing Aadhaar keychain data:', error);
    }
  }

  // Clear persisted Redux data
  await persistor.purge();
  
  // Reset in-memory Redux state (including Aadhaar validated flag)
  store.dispatch({ type: 'LOGOUT' });
};

