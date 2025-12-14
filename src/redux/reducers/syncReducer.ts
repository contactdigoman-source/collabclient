import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UnsyncedProfileProperty } from '../../services/sync/profile-sync-service';
import { UnsyncedSetting } from '../../services/sync/settings-sync-service';
import { AttendanceRecord } from '../types/userTypes';

export interface SyncError {
  id: string;
  message: string;
  timestamp: number;
  type: 'profile' | 'attendance' | 'settings';
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncErrors: SyncError[];
  unsyncedItems: {
    profile: UnsyncedProfileProperty[];
    attendance: AttendanceRecord[];
    settings: UnsyncedSetting[];
  };
}

const initialState: SyncState = {
  isSyncing: false,
  lastSyncAt: null,
  syncErrors: [],
  unsyncedItems: {
    profile: [],
    attendance: [],
    settings: [],
  },
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setLastSyncAt: (state, action: PayloadAction<number | null>) => {
      state.lastSyncAt = action.payload;
    },
    addSyncError: (state, action: PayloadAction<Omit<SyncError, 'id' | 'timestamp'>>) => {
      const error: SyncError = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        ...action.payload,
      };
      state.syncErrors.push(error);
      // Keep only last 10 errors
      if (state.syncErrors.length > 10) {
        state.syncErrors = state.syncErrors.slice(-10);
      }
    },
    clearSyncErrors: (state) => {
      state.syncErrors = [];
    },
    setUnsyncedItems: (
      state,
      action: PayloadAction<{
        profile?: UnsyncedProfileProperty[];
        attendance?: AttendanceRecord[];
        settings?: UnsyncedSetting[];
      }>,
    ) => {
      if (action.payload.profile !== undefined) {
        state.unsyncedItems.profile = action.payload.profile;
      }
      if (action.payload.attendance !== undefined) {
        state.unsyncedItems.attendance = action.payload.attendance;
      }
      if (action.payload.settings !== undefined) {
        state.unsyncedItems.settings = action.payload.settings;
      }
    },
    clearUnsyncedItems: (state) => {
      state.unsyncedItems = {
        profile: [],
        attendance: [],
        settings: [],
      };
    },
  },
});

export const {
  setSyncing,
  setLastSyncAt,
  addSyncError,
  clearSyncErrors,
  setUnsyncedItems,
  clearUnsyncedItems,
} = syncSlice.actions;

export default syncSlice.reducer;

