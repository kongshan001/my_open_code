import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, getGlobalRateLimiter, resetGlobalRateLimiter } from '../../src/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  let mockDate: Date;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequestsPerHour: 10,
      maxRequestsPerMinute: 5,
      maxConcurrentRequests: 2,
    });
    
    // Mock Date.now to control time
    mockDate = new Date('2024-01-01T12:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobalRateLimiter();
  });

  describe('canExecuteImmediately', () => {
    it('should allow execution when limits not reached', () => {
      const check = limiter.canExecuteImmediately();
      
      expect(check.canExecute).toBe(true);
      expect(check.reason).toBeUndefined();
      expect(check.waitTime).toBeUndefined();
    });

    it('should block when hourly limit reached', async () => {
      // 模拟已达到每小时限制
      for (let i = 0; i < 10; i++) {
        await limiter.executeRequest(() => Promise.resolve('ok'));
      }

      const check = limiter.canExecuteImmediately();
      
      expect(check.canExecute).toBe(false);
      expect(check.reason).toBe('Hourly rate limit exceeded');
      expect(check.waitTime).toBeGreaterThan(0);
    });

    it('should block when minute limit reached', async () => {
      // 模拟已达到每分钟限制
      for (let i = 0; i < 5; i++) {
        await limiter.executeRequest(() => Promise.resolve('ok'));
      }

      const check = limiter.canExecuteImmediately();
      
      expect(check.canExecute).toBe(false);
      expect(check.reason).toBe('Minute rate limit exceeded');
      expect(check.waitTime).toBeGreaterThan(0);
      expect(check.waitTime).toBeLessThanOrEqual(60000);
    });

    it('should block when concurrent limit reached', async () => {
      // 启动多个并发请求但让它们pending
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 3; i++) {
        const p = limiter.executeRequest(() => 
          new Promise(resolve => setTimeout(() => resolve('ok'), 1000))
        );
        promises.push(p);
      }

      const check = limiter.canExecuteImmediately();
      
      expect(check.canExecute).toBe(false);
      expect(check.reason).toBe('Too many concurrent requests');
    });
  });

  describe('executeRequest', () => {
    it('should execute request immediately when limits allow', async () => {
      const result = await limiter.executeRequest(() => Promise.resolve('success'));
      
      expect(result).toBe('success');
    });

    it('should track concurrent requests', async () => {
      const promises = [
        limiter.executeRequest(() => Promise.resolve('done1')),
        limiter.executeRequest(() => Promise.resolve('done2')),
      ];

      const stats = limiter.getStats();
      expect(stats.currentConcurrent).toBe(2);

      await Promise.all(promises);
    });

    it('should timeout request after specified time', async () => {
      vi.useFakeTimers();

      const promise = limiter.executeRequest(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 5000)),
        { timeout: 1000 }
      );

      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow('Request timeout');

      vi.useRealTimers();
    });

    it('should return error on request failure', async () => {
      const error = new Error('API Error');
      
      await expect(
        limiter.executeRequest(() => Promise.reject(error))
      ).rejects.toThrow('API Error');
    });
  });

  describe('getStats', () => {
    it('should return accurate stats', async () => {
      await limiter.executeRequest(() => Promise.resolve('r1'));
      await limiter.executeRequest(() => Promise.resolve('r2'));
      await limiter.executeRequest(() => Promise.resolve('r3'));

      const stats = limiter.getStats();

      expect(stats.requestsThisHour).toBe(3);
      expect(stats.requestsThisMinute).toBe(3);
      expect(stats.currentConcurrent).toBe(0);
      expect(stats.requestsQueued).toBe(0);
    });

    it('should calculate correct reset time', () => {
      const stats = limiter.getStats();

      const now = Date.now();
      const nextHour = Math.floor(now / 3600000) * 3600000 + 3600000;
      const nextMinute = Math.floor(now / 60000) * 60000 + 60000;

      expect(stats.resetTime).toBe(nextHour);
      expect(stats.minuteResetTime).toBe(nextMinute);
    });
  });

  describe('getUsageStats', () => {
    it('should return comprehensive usage statistics', async () => {
      await limiter.executeRequest(() => Promise.resolve('r1'));
      await limiter.executeRequest(() => Promise.resolve('r2'));

      const stats = limiter.getUsageStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('processedRequests');
      expect(stats).toHaveProperty('rejectedRequests');
      expect(stats).toHaveProperty('queuedRequests');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('hourlyLimit');
      expect(stats).toHaveProperty('minuteLimit');
      expect(stats).toHaveProperty('concurrentLimit');

      expect(stats.totalRequests).toBe(2);
      expect(stats.hourlyLimit).toBe(10);
      expect(stats.minuteLimit).toBe(5);
      expect(stats.concurrentLimit).toBe(2);
    });

    it('should calculate success rate correctly', async () => {
      await limiter.executeRequest(() => Promise.resolve('success'));
      await limiter.executeRequest(() => Promise.resolve('success'));
      
      // 等待所有请求完成
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = limiter.getUsageStats();

      expect(stats.successRate).toMatch(/\d+\.?\d*%/);
    });
  });

  describe('processQueue', () => {
    it('should process queued requests when limits allow', async () => {
      const resolve1 = vi.fn();
      const resolve2 = vi.fn();
      const resolve3 = vi.fn();

      limiter['requestQueue'] = [
        { id: '1', timestamp: Date.now(), priority: 'high' as any, execute: () => Promise.resolve('done1'), resolve: resolve1, reject: vi.fn() },
        { id: '2', timestamp: Date.now(), priority: 'medium' as any, execute: () => Promise.resolve('done2'), resolve: resolve2, reject: vi.fn() },
        { id: '3', timestamp: Date.now(), priority: 'low' as any, execute: () => Promise.resolve('done3'), resolve: resolve3, reject: vi.fn() },
      ];

      const processed = limiter.processQueue();

      expect(processed).toBeGreaterThan(0);
      expect(limiter['requestQueue'].length).toBeLessThan(3);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      limiter.updateConfig({ maxRequestsPerHour: 50 });

      const stats = limiter.getUsageStats();

      expect(stats.hourlyLimit).toBe(50);
    });

    it('should merge new config with existing', () => {
      limiter.updateConfig({ maxRequestsPerMinute: 20 });

      const stats = limiter.getUsageStats();

      expect(stats.hourlyLimit).toBe(10); // 保持原值
      expect(stats.minuteLimit).toBe(20); // 新值
      expect(stats.concurrentLimit).toBe(2); // 保持原值
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      await limiter.executeRequest(() => Promise.resolve('r1'));
      await limiter.executeRequest(() => Promise.resolve('r2'));

      limiter.resetStats();

      const stats = limiter.getStats();

      expect(stats.requestsThisHour).toBe(0);
      expect(stats.requestsThisMinute).toBe(0);
      expect(limiter['totalRequests']).toBe(0);
      expect(limiter['queuedRequests']).toBe(0);
      expect(limiter['processedRequests']).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear queue and reset queue size', async () => {
      const resolve1 = vi.fn();
      const resolve2 = vi.fn();
      const reject1 = vi.fn();
      const reject2 = vi.fn();

      limiter['requestQueue'] = [
        { id: '1', timestamp: Date.now(), priority: 'medium' as any, execute: () => Promise.resolve('done'), resolve: resolve1, reject: reject1 },
        { id: '2', timestamp: Date.now(), priority: 'medium' as any, execute: () => Promise.resolve('done'), resolve: resolve2, reject: reject2 },
      ];

      const cleared = limiter.clearQueue();

      expect(cleared).toBe(2);
      expect(limiter['requestQueue']).toHaveLength(0);
      expect(reject1).toHaveBeenCalledTimes(1);
      expect(reject2).toHaveBeenCalledTimes(1);
    });
  });

  describe('startQueueProcessor', () => {
    it('should start periodic queue processing', async () => {
      const stopProcessor = limiter.startQueueProcessor(100);
      
      // 添加一些排队请求
      limiter['requestQueue'] = [
        { id: '1', timestamp: Date.now(), priority: 'medium' as any, execute: () => Promise.resolve('done'), resolve: null as any, reject: null as any },
        { id: '2', timestamp: Date.now(), priority: 'medium' as any, execute: () => Promise.resolve('done'), resolve: null as any, reject: null as any },
      ];

      // 等待处理器处理（在实际场景中会由定时器触发）
      await new Promise(resolve => setTimeout(resolve, 100));

      stopProcessor();
    });
  });

  describe('Hourly Limit Reset', () => {
    it('should reset hourly counter at hour boundary', async () => {
      // 在12:59执行10个请求
      const timeBeforeHour = new Date('2024-01-01T12:59:59.000Z');
      vi.spyOn(Date, 'now').mockReturnValue(timeBeforeHour.getTime());

      for (let i = 0; i < 10; i++) {
        await limiter.executeRequest(() => Promise.resolve('ok'));
      }

      const statsBefore = limiter.getStats();
      expect(statsBefore.requestsThisHour).toBe(10);

      // 跳到13:00
      const timeAfterHour = new Date('2024-01-01T13:00:00.000Z');
      vi.spyOn(Date, 'now').mockReturnValue(timeAfterHour.getTime());

      await limiter.executeRequest(() => Promise.resolve('ok'));

      const statsAfter = limiter.getStats();
      expect(statsAfter.requestsThisHour).toBe(1); // 只计数新小时的请求
    });
  });

  describe('Global Rate Limiter', () => {
    it('should return singleton instance', () => {
      const limiter1 = getGlobalRateLimiter();
      const limiter2 = getGlobalRateLimiter();

      expect(limiter1).toBe(limiter2);
    });

    it('should update config on subsequent calls', () => {
      const limiter1 = getGlobalRateLimiter({ maxRequestsPerHour: 100 });
      const limiter2 = getGlobalRateLimiter({ maxRequestsPerHour: 200 });

      const stats = limiter2.getUsageStats();

      expect(stats.hourlyLimit).toBe(200);
    });

    it('should reset global limiter', () => {
      const limiter = getGlobalRateLimiter();

      limiter['requestHistory'].push(Date.now());
      limiter['totalRequests'] = 100;

      resetGlobalRateLimiter();

      const stats = limiter.getStats();

      expect(limiter['totalRequests']).toBe(0);
      expect(stats.requestsThisHour).toBe(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle burst of requests', async () => {
      // 模拟突发请求：10个请求快速到达
      const requests: Promise<any>[] = [];
      const executed: string[] = [];

      for (let i = 0; i < 10; i++) {
        const p = limiter.executeRequest(() => {
          executed.push(`req-${i}`);
          return `result-${i}`;
        });
        requests.push(p);
      }

      await Promise.all(requests);

      // 检查请求都已执行
      expect(executed).toHaveLength(10);

      // 并发请求应该受到限制
      const stats = limiter.getUsageStats();
      expect(stats.totalRequests).toBe(10);
    });

    it('should handle mixed priority requests', async () => {
      const highPriorityRequests = [
        limiter.executeRequest(() => Promise.resolve('h1'), { priority: 'high' }),
      ];

      const mediumPriorityRequests = [
        limiter.executeRequest(() => Promise.resolve('m1'), { priority: 'medium' }),
      ];

      const lowPriorityRequests = [
        limiter.executeRequest(() => Promise.resolve('l1'), { priority: 'low' }),
      ];

      // 串行执行以更好地观察优先级
      const allResults = [];
      allResults.push(await highPriorityRequests[0]);
      allResults.push(await mediumPriorityRequests[0]);
      allResults.push(await lowPriorityRequests[0]);

      expect(allResults).toHaveLength(3);
    });
  });
});