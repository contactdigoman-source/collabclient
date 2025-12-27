/**
 * Navigation Helper
 * Provides event-based navigation for non-React contexts (e.g., interceptors)
 * 
 * This allows interceptors and services to trigger navigation without direct
 * access to the navigation ref, avoiding tight coupling.
 */
class NavigationHelper {
  private static instance: NavigationHelper;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NavigationHelper {
    if (!NavigationHelper.instance) {
      NavigationHelper.instance = new NavigationHelper();
    }
    return NavigationHelper.instance;
  }

  /**
   * Emit event to navigate to login screen
   * Used when token refresh fails or user needs to be logged out
   */
  public navigateToLogin(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in navigation callback:', error);
      }
    });
  }

  /**
   * Subscribe to navigate to login event
   * @param callback Function to call when navigation to login is needed
   * @returns Unsubscribe function
   */
  public onNavigateToLogin(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const navigationHelper = NavigationHelper.getInstance();

