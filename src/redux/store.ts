// store.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import userReducer from './userReducer';
import appReducer from './appReducer';
import aadhaarReducer from './aadhaarReducer';
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
    }),
});

export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export default store;
