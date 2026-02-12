export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerMinute?: number;
  maxConcurrentRequests?: number;
}

export interface RateLimitStats {
  requestsThisHour: number;
  requestsThisMinute: number;
  currentConcurrent: number;
  requestsQueued: number;
  resetTime: number; // 下次重置时间戳（小时）
  minuteResetTime: number; // 下次分钟重置时间戳
}

export interface RequestQueueItem {
  id: string;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private requestHistory: number[] = [];
  private concurrentRequests: number = 0;
  private requestQueue: RequestQueueItem[] = [];
  private hourStartTime: number;
  private minuteStartTime: number;
  private totalRequests: number = 0;
  private rejectedRequests: number = 0;
  private queuedRequests: number = 0;
  private processedRequests: number = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequestsPerHour: config.maxRequestsPerHour || 100,
      maxRequestsPerMinute: config.maxRequestsPerMinute || 10,
      maxConcurrentRequests: config.maxConcurrentRequests || 5,
    };

    const now = Date.now();
    this.hourStartTime = Math.floor(now / 3600000) * 3600000;
    this.minuteStartTime = Math.floor(now / 60000) * 60000;
  }

  /**
   * 检查是否可以立即执行请求
   */
  canExecuteImmediately(): { canExecute: boolean; reason?: string; waitTime?: number } {
    const now = Date.now();
    this.cleanupHistory(now);

    const stats = this.getStats();

    // 检查并发限制
    if (this.config.maxConcurrentRequests && stats.currentConcurrent >= this.config.maxConcurrentRequests) {
      return {
        canExecute: false,
        reason: 'Too many concurrent requests',
        waitTime: 1000,
      };
    }

    // 检查每分钟限制
    if (this.config.maxRequestsPerMinute && stats.requestsThisMinute >= this.config.maxRequestsPerMinute) {
      const waitTime = this.minuteStartTime + 60000 - now;
      return {
        canExecute: false,
        reason: 'Minute rate limit exceeded',
        waitTime,
      };
    }

    // 检查每小时限制
    if (stats.requestsThisHour >= this.config.maxRequestsPerHour) {
      const waitTime = this.hourStartTime + 3600000 - now;
      return {
        canExecute: false,
        reason: 'Hourly rate limit exceeded',
        waitTime,
      };
    }

    return { canExecute: true };
  }

  /**
   * 执行请求（自动处理限流和排队）
   */
  async executeRequest<T>(
    requestFn: () => Promise<T>,
    options?: {
      priority?: 'high' | 'medium' | 'low';
      timeout?: number;
    }
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const priority = options?.priority || 'medium';

    // 检查是否可以立即执行
    const check = this.canExecuteImmediately();
    
    if (check.canExecute) {
      // 可以立即执行
      this.concurrentRequests++;
      this.recordRequest();

      try {
        const result = await this.executeWithTimeout(requestFn, options?.timeout);
        this.processedRequests++;
        return result;
      } finally {
        this.concurrentRequests--;
      }
    } else {
      // 需要排队
      this.queuedRequests++;
      
      return new Promise((resolve, reject) => {
        const queueItem: RequestQueueItem = {
          id: requestId,
          timestamp: Date.now(),
          priority,
          execute: requestFn,
          resolve,
          reject,
        };

        this.requestQueue.push(queueItem);
        this.sortQueue();
        
        console.log(`[RateLimiter] Request queued: ${requestId} (${priority}) - Reason: ${check.reason}`);
      });
    }
  }

  /**
   * 处理队列中的请求
   */
  processQueue(): number {
    const now = Date.now();
    this.cleanupHistory(now);
    
    let processedCount = 0;

    while (this.requestQueue.length > 0) {
      const check = this.canExecuteImmediately();
      
      if (!check.canExecute) {
        // 无法立即执行更多请求
        break;
      }

      // 取出队列中的请求
      const item = this.requestQueue.shift()!;
      this.concurrentRequests++;
      this.recordRequest();

      // 异步执行请求
      (async () => {
        try {
          const result = await item.execute();
          this.processedRequests++;
          item.resolve(result);
        } catch (error) {
          this.rejectedRequests++;
          item.reject(error as Error);
        } finally {
          this.concurrentRequests--;
        }
      })();

      processedCount++;
    }

    if (processedCount > 0) {
      console.log(`[RateLimiter] Processed ${processedCount} queued requests`);
    }

    return processedCount;
  }

  /**
   * 获取当前统计信息
   */
  getStats(): RateLimitStats {
    const now = Date.now();
    this.cleanupHistory(now);

    return {
      requestsThisHour: this.requestHistory.filter(t => t >= this.hourStartTime).length,
      requestsThisMinute: this.requestHistory.filter(t => t >= this.minuteStartTime).length,
      currentConcurrent: this.concurrentRequests,
      requestsQueued: this.requestQueue.length,
      resetTime: this.hourStartTime + 3600000,
      minuteResetTime: this.minuteStartTime + 60000,
    };
  }

  /**
   * 获取完整的使用统计
   */
  getUsageStats() {
    return {
      totalRequests: this.totalRequests,
      processedRequests: this.processedRequests,
      rejectedRequests: this.rejectedRequests,
      queuedRequests: this.queuedRequests,
      queueSize: this.requestQueue.length,
      successRate: this.totalRequests > 0 
        ? ((this.processedRequests - this.rejectedRequests) / this.totalRequests * 100).toFixed(2) + '%'
        : 'N/A',
      hourlyLimit: this.config.maxRequestsPerHour,
      minuteLimit: this.config.maxRequestsPerMinute || 'N/A',
      concurrentLimit: this.config.maxConcurrentRequests || 'N/A',
      ...this.getStats(),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[RateLimiter] Config updated:`, this.config);
  }

  /**
   * 清理过期的请求历史
   */
  private cleanupHistory(now: number): void {
    const newHourStart = Math.floor(now / 3600000) * 3600000;
    const newMinuteStart = Math.floor(now / 60000) * 60000;

    // 如果跨小时，重置小时计数
    if (newHourStart > this.hourStartTime) {
      this.hourStartTime = newHourStart;
      console.log(`[RateLimiter] Hourly counter reset at ${new Date(newHourStart).toISOString()}`);
    }

    // 如果跨分钟，重置分钟计数
    if (newMinuteStart > this.minuteStartTime) {
      this.minuteStartTime = newMinuteStart;
    }

    // 清理超过1小时的请求历史
    this.requestHistory = this.requestHistory.filter(t => t >= newHourStart);
  }

  /**
   * 记录请求
   */
  private recordRequest(): void {
    const now = Date.now();
    this.requestHistory.push(now);
    this.totalRequests++;
  }

  /**
   * 对队列按优先级排序
   */
  private sortQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    this.requestQueue.sort((a, b) => {
      // 首先按优先级排序
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 相同优先级按时间排序（FIFO）
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) {
      return fn();
    }

    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 启动队列处理器（定时检查并处理队列）
   */
  startQueueProcessor(interval: number = 1000): () => void {
    console.log(`[RateLimiter] Starting queue processor (interval: ${interval}ms)`);

    const timer = setInterval(() => {
      this.processQueue();
    }, interval);

    // 返回清理函数
    return () => clearInterval(timer);
  }

  /**
   * 清空队列
   */
  clearQueue(): number {
    const cleared = this.requestQueue.length;
    
    // 拒绝所有排队的请求
    this.requestQueue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    this.requestQueue = [];
    
    console.log(`[RateLimiter] Queue cleared: ${cleared} requests rejected`);
    
    return cleared;
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.requestHistory = [];
    this.totalRequests = 0;
    this.rejectedRequests = 0;
    this.queuedRequests = 0;
    this.processedRequests = 0;
    this.hourStartTime = Math.floor(Date.now() / 3600000) * 3600000;
    this.minuteStartTime = Math.floor(Date.now() / 60000) * 60000;
    
    console.log('[RateLimiter] Stats reset');
  }
}

// 创建全局rate limiter实例
let globalRateLimiter: RateLimiter | null = null;

export function getGlobalRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(config);
  } else if (config) {
    globalRateLimiter.updateConfig(config);
  }
  
  return globalRateLimiter;
}

export function resetGlobalRateLimiter(): void {
  if (globalRateLimiter) {
    globalRateLimiter.clearQueue();
    globalRateLimiter.resetStats();
  }
}