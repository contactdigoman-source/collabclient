/**
 * Retry Service
 * Implements exponential backoff algorithm for retrying failed operations
 */
class RetryService {
  private readonly initialDelay: number = 1000; // 1 second
  private readonly maxDelay: number = 30000; // 30 seconds
  private readonly maxAttempts: number = 6; // 6 attempts max

  /**
   * Calculate next retry delay using exponential backoff
   * Formula: min(initialDelay * 2^attempts, maxDelay)
   * @param attempts Current attempt number (0-indexed)
   * @returns Delay in milliseconds
   */
  calculateNextRetry(attempts: number): number {
    const delay = Math.min(
      this.initialDelay * Math.pow(2, attempts),
      this.maxDelay,
    );
    return delay;
  }

  /**
   * Check if operation should be retried
   * @param attempts Current attempt number
   * @param maxAttempts Maximum number of attempts (defaults to this.maxAttempts)
   * @returns True if should retry, false otherwise
   */
  shouldRetry(attempts: number, maxAttempts?: number): boolean {
    const max = maxAttempts ?? this.maxAttempts;
    return attempts < max;
  }

  /**
   * Calculate next retry timestamp
   * @param attempts Current attempt number
   * @returns Timestamp in milliseconds when next retry should occur
   */
  calculateNextRetryAt(attempts: number): number {
    const delay = this.calculateNextRetry(attempts);
    return Date.now() + delay;
  }

  /**
   * Get retry delays for all attempts (for debugging/logging)
   * @returns Array of delays in milliseconds for each attempt
   */
  getRetryDelays(): number[] {
    const delays: number[] = [];
    for (let i = 0; i < this.maxAttempts; i++) {
      delays.push(this.calculateNextRetry(i));
    }
    return delays;
  }
}

export const retryService = new RetryService();
