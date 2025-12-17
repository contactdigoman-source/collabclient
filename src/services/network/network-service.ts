import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import Config from 'react-native-config';

/**
 * Network Service
 * Provides utilities to detect and monitor network connectivity
 */
class NetworkService {
  private listeners: Set<(isConnected: boolean) => void> = new Set();

  /**
   * Get forced network state from environment variable (for testing)
   * Set FORCE_NETWORK_ONLINE=true in .env to force online
   * Set FORCE_NETWORK_ONLINE=false to force offline
   */
  private getForcedNetworkState(): boolean | null {
    const forceNetwork = Config.FORCE_NETWORK_ONLINE;
    if (forceNetwork === 'true' || forceNetwork === '1') {
      return true;
    }
    if (forceNetwork === 'false' || forceNetwork === '0') {
      return false;
    }
    return null; // No override, use actual network state
  }

  /**
   * Check if device is currently online
   */
  async isOnline(): Promise<boolean> {
    const forced = this.getForcedNetworkState();
    if (forced !== null) {
      return forced;
    }
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  /**
   * Check if device is connected (more specific than isOnline)
   */
  async isConnected(): Promise<boolean> {
    const forced = this.getForcedNetworkState();
    if (forced !== null) {
      return forced;
    }
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  }

  /**
   * Get current network state
   */
  async getNetworkState(): Promise<NetInfoState> {
    return await NetInfo.fetch();
  }

  /**
   * Subscribe to network state changes
   * @param callback Function to call when network state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (isConnected: boolean) => void): () => void {
    this.listeners.add(callback);

    const unsubscribe = NetInfo.addEventListener((state) => {
      const forced = this.getForcedNetworkState();
      const isConnected = forced !== null 
        ? forced 
        : (state.isConnected === true && state.isInternetReachable === true);
      this.listeners.forEach((listener) => listener(isConnected));
    });

    // Initial check
    this.isConnected().then((connected) => {
      callback(connected);
    });

    return () => {
      this.listeners.delete(callback);
      unsubscribe();
    };
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

export const networkService = new NetworkService();

