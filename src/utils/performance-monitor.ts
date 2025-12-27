import { logger } from '../services/logger';

/**
 * Performance metrics
 */
interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Frame rate monitoring
 */
class FrameRateMonitor {
  private frameCount = 0;
  private lastTime = Date.now();
  private fps = 60;
  private isMonitoring = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastTime = Date.now();

    const measureFPS = () => {
      const now = Date.now();
      const elapsed = now - this.lastTime;

      if (elapsed >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastTime = now;

        if (this.fps < 30) {
          logger.warn('[Performance] Low FPS detected', { fps: this.fps });
        }
      }

      this.frameCount++;
      if (this.isMonitoring) {
        requestAnimationFrame(measureFPS);
      }
    };

    requestAnimationFrame(measureFPS);
  }

  stop(): void {
    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getFPS(): number {
    return this.fps;
  }
}

/**
 * Performance Monitor
 */
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private frameRateMonitor = new FrameRateMonitor();
  private navigationTimes: Array<{ route: string; duration: number }> = [];

  /**
   * Start tracking a performance metric
   */
  startMetric(name: string, metadata?: Record<string, any>): void {
    this.metrics.set(name, {
      name,
      startTime: Date.now(),
      metadata,
    });
  }

  /**
   * End tracking a performance metric
   */
  endMetric(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn('[Performance] Metric not found', { name });
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    // Log slow operations
    if (duration > 1000) {
      logger.warn('[Performance] Slow operation detected', {
        name,
        duration,
        metadata: metric.metadata,
      });
    }

    this.metrics.delete(name);
    return duration;
  }

  /**
   * Track navigation transition
   */
  trackNavigation(route: string, duration: number): void {
    this.navigationTimes.push({ route, duration });
    
    // Keep only last 50 navigation times
    if (this.navigationTimes.length > 50) {
      this.navigationTimes.shift();
    }

    if (duration > 500) {
      logger.warn('[Performance] Slow navigation transition', { route, duration });
    }
  }

  /**
   * Get average navigation time
   */
  getAverageNavigationTime(): number {
    if (this.navigationTimes.length === 0) return 0;
    const sum = this.navigationTimes.reduce((acc, item) => acc + item.duration, 0);
    return sum / this.navigationTimes.length;
  }

  /**
   * Start frame rate monitoring
   */
  startFrameRateMonitoring(): void {
    this.frameRateMonitor.start();
  }

  /**
   * Stop frame rate monitoring
   */
  stopFrameRateMonitoring(): void {
    this.frameRateMonitor.stop();
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.frameRateMonitor.getFPS();
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order function to measure function execution time
 */
export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T {
  return ((...args: Parameters<T>) => {
    const metricName = name || fn.name || 'anonymous';
    performanceMonitor.startMetric(metricName);
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.endMetric(metricName);
        }) as ReturnType<T>;
      }
      performanceMonitor.endMetric(metricName);
      return result;
    } catch (error) {
      performanceMonitor.endMetric(metricName);
      throw error;
    }
  }) as T;
}




