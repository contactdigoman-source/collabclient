import axios, { AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios';
import { logger } from '../logger';
import apiClient from './api-client';

/**
 * Request priority levels
 */
export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Request metadata
 */
interface QueuedRequest {
  id: string;
  config: AxiosRequestConfig;
  priority: RequestPriority;
  resolve: (value: AxiosResponse) => void;
  reject: (error: any) => void;
  cancelToken: CancelTokenSource;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Request cache entry
 */
interface CacheEntry {
  response: AxiosResponse;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * API Queue Service
 * Handles request queuing, deduplication, batching, and caching
 */
class ApiQueueService {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, QueuedRequest[]>();
  private readonly maxConcurrentRequests = 5;
  private readonly defaultCacheTTL = 60000; // 1 minute
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  /**
   * Generate a unique request ID based on method, URL, and data
   */
  private generateRequestId(config: AxiosRequestConfig): string {
    const method = (config.method || 'get').toUpperCase();
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';
    return `${method}:${url}:${params}:${data}`;
  }

  /**
   * Check if request is cached and still valid
   */
  private getCachedResponse(requestId: string): AxiosResponse | null {
    const entry = this.cache.get(requestId);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(requestId);
      return null;
    }

    return entry.response;
  }

  /**
   * Cache a response
   */
  private setCachedResponse(requestId: string, response: AxiosResponse, ttl?: number): void {
    this.cache.set(requestId, {
      response,
      timestamp: Date.now(),
      ttl: ttl || this.defaultCacheTTL,
    });
  }

  /**
   * Check if a similar request is already pending
   */
  private findPendingRequest(requestId: string): QueuedRequest[] | null {
    return this.pendingRequests.get(requestId) || null;
  }

  /**
   * Add request to pending map
   */
  private addPendingRequest(requestId: string, request: QueuedRequest): void {
    if (!this.pendingRequests.has(requestId)) {
      this.pendingRequests.set(requestId, []);
    }
    this.pendingRequests.get(requestId)!.push(request);
  }

  /**
   * Remove request from pending map
   */
  private removePendingRequest(requestId: string, request: QueuedRequest): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      const index = pending.indexOf(request);
      if (index > -1) {
        pending.splice(index, 1);
      }
      if (pending.length === 0) {
        this.pendingRequests.delete(requestId);
      }
    }
  }

  /**
   * Resolve all pending requests with the same ID
   */
  private resolvePendingRequests(requestId: string, response: AxiosResponse): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      pending.forEach(req => {
        req.resolve(response);
        req.cancelToken.cancel('Request deduplicated');
      });
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Reject all pending requests with the same ID
   */
  private rejectPendingRequests(requestId: string, error: any): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      pending.forEach(req => {
        req.reject(error);
        req.cancelToken.cancel('Request failed');
      });
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Execute a request with retry logic
   * Uses apiClient to ensure interceptors are applied
   */
  private async executeRequest(request: QueuedRequest): Promise<AxiosResponse> {
    const requestId = this.generateRequestId(request.config);
    
    try {
      // Use apiClient instead of raw axios to ensure interceptors are applied
      const response = await apiClient(request.config);
      
      // Cache successful GET requests
      if (request.config.method?.toLowerCase() === 'get' && response.status === 200) {
        this.setCachedResponse(requestId, response);
      }
      
      return response;
    } catch (error: any) {
      // Retry on network errors or 5xx errors
      if (
        request.retryCount < request.maxRetries &&
        (!error.response || (error.response.status >= 500 && error.response.status < 600))
      ) {
        request.retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * request.retryCount));
        return this.executeRequest(request);
      }
      throw error;
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Sort by priority (higher first), then by timestamp
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Process up to maxConcurrentRequests
      const batch = this.queue.splice(0, this.maxConcurrentRequests);
      const promises = batch.map(request => {
        const requestId = this.generateRequestId(request.config);
        
        return this.executeRequest(request)
          .then(response => {
            this.resolvePendingRequests(requestId, response);
            request.resolve(response);
            this.removePendingRequest(requestId, request);
          })
          .catch(error => {
            this.rejectPendingRequests(requestId, error);
            request.reject(error);
            this.removePendingRequest(requestId, request);
          });
      });

      await Promise.allSettled(promises);
    }

    this.processing = false;
  }

  /**
   * Add a request to the queue
   */
  public async enqueue(
    config: AxiosRequestConfig,
    priority: RequestPriority = RequestPriority.NORMAL,
    useCache: boolean = true,
    cacheTTL?: number
  ): Promise<AxiosResponse> {
    const requestId = this.generateRequestId(config);

    // Check cache first (only for GET requests)
    if (useCache && config.method?.toLowerCase() === 'get') {
      const cached = this.getCachedResponse(requestId);
      if (cached) {
        logger.debug('[ApiQueue] Cache hit', { requestId, url: config.url });
        return Promise.resolve(cached);
      }
    }

    // Check if similar request is pending (deduplication)
    const pending = this.findPendingRequest(requestId);
    if (pending && pending.length > 0) {
      logger.debug('[ApiQueue] Request deduplicated', { requestId, url: config.url });
        return new Promise((resolve, reject) => {
          // Use axios for cancel token (apiClient doesn't export CancelToken)
          const cancelToken = axios.CancelToken.source();
        const request: QueuedRequest = {
          id: requestId,
          config,
          priority,
          resolve,
          reject,
          cancelToken,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: this.maxRetries,
        };
        this.addPendingRequest(requestId, request);
      });
    }

    // Create new request
        return new Promise((resolve, reject) => {
          // Use axios for cancel token (apiClient doesn't export CancelToken)
          const cancelToken = axios.CancelToken.source();
      const request: QueuedRequest = {
        id: requestId,
        config: {
          ...config,
          cancelToken: cancelToken.token,
        },
        priority,
        resolve,
        reject,
        cancelToken,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: this.maxRetries,
      };

      this.queue.push(request);
      this.addPendingRequest(requestId, request);
      this.processQueue();
    });
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific request pattern
   */
  public clearCacheForPattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}

export const apiQueueService = new ApiQueueService();




