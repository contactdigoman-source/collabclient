// store.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { userReducer, appReducer, aadhaarReducer } from '../reducers';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import reduxStorage from './storage';

const appReducers = combineReducers({
  userState: userReducer,
  appState: appReducer,
  aadhaarState: aadhaarReducer,
});

// 👇 This function resets state when LOGOUT is dispatched
const rootReducer = (state: any, action: any) => {
  if (action.type === 'LOGOUT') {
    reduxStorage.removeItem('persist:root'); // 👈 ensures storage is also cleared
    state = undefined;
  }
  return appReducers(state, action);
};

const persistConfig = {
  key: 'root',
  version: 1,
  storage: reduxStorage,
  timeout: 0,
  whitelist: ['userState', 'appState'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
      // Disable in production for better performance
      immutableCheck: { warnAfter: 128 },
      thunk: true,
    }),
  // Enable Redux DevTools only in development
  devTools: __DEV__,
});

export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export default store;
