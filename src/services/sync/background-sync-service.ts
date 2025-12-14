import { AppState, AppStateStatus } from 'react-native';
import { networkService } from '../network/network-service';
import { syncCoordinator } from './sync-coordinator';
import { store } from '../../redux';

const DEBUG = true;
const log = (...args: any[]): void => DEBUG && console.log('[BackgroundSync]', ...args);

/**
 * Background Sync Service
 * Auto-syncs when network becomes available
 */
class BackgroundSyncService {
  private networkUnsubscribe: (() => void) | null = null;
  private appStateSubscription: any = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start background sync monitoring
   */
  start(): void {
    if (this.isRunning) {
      log('Background sync already running');
      return;
    }

    this.isRunning = true;
    log('Starting background sync service');

    // Monitor network state changes
    this.networkUnsubscribe = networkService.subscribe((isConnected) => {
      if (isConnected) {
        log('Network available - triggering sync');
        this.triggerSync();
      } else {
        log('Network unavailable');
      }
    });

    // Monitor app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Periodic sync check (every 5 minutes when app is active)
    this.syncInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        this.triggerSync();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop background sync monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    log('Stopping background sync service');

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      log('App became active - triggering sync');
      this.triggerSync();
    }
  };

  /**
   * Trigger sync if network is available
   */
  private async triggerSync(): Promise<void> {
    try {
      const isOnline = await networkService.isConnected();
      if (!isOnline) {
        log('Network not available - skipping sync');
        return;
      }

      const userState = store.getState().userState;
      const email = userState?.userData?.email;
      const userID = userState?.userData?.id?.toString() || email || '';

      if (!email) {
        log('No user email - skipping sync');
        return;
      }

      log('Triggering background sync');
      await syncCoordinator.syncAll(email, userID);
    } catch (error) {
      console.log('Error triggering background sync:', error);
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService();

