import store, { persistor } from '../redux/store';

export const logoutUser = async () => {
  await persistor.purge(); // clears persisted data
  store.dispatch({ type: 'LOGOUT' }); // resets in-memory Redux state
};
