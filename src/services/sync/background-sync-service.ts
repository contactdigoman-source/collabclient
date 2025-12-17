import { AppState, AppStateStatus } from 'react-native';
import { logger } from '../logger';
import { networkService } from '../network/network-service';
import { syncCoordinator } from './sync-coordinator';
import { store } from '../../redux';

const DEBUG = true;
const log = (...args: any[]): void => DEBUG && logger.debug('[BackgroundSync]', ...args);

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
      logger.debug('Background sync already running');
      return;
    }

    this.isRunning = true;
    logger.debug('Starting background sync service');

    // Monitor network state changes
    this.networkUnsubscribe = networkService.subscribe((isConnected) => {
      if (isConnected) {
        logger.debug('Network available - triggering sync');
        this.triggerSync();
      } else {
        logger.debug('Network unavailable');
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
    logger.debug('Stopping background sync service');

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
      logger.debug('App became active - triggering sync');
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
        logger.debug('Network not available - skipping sync');
        return;
      }

      const userState = store.getState().userState;
      const email = userState?.userData?.email;
      const userID = userState?.userData?.id?.toString() || email || '';

      if (!email) {
        logger.debug('No user email - skipping sync');
        return;
      }

      logger.debug('Triggering background sync');
      await syncCoordinator.syncAll(email, userID);
    } catch (error) {
      logger.debug('Error triggering background sync:', error);
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService();

