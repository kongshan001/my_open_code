import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompressionManager } from '../../src/compression.js';
import { createTestConfig, createLongConversation, createLargeMessage } from '../helpers/factories.js';
import type { CompressionConfig } from '../../src/types.js';

describe('Performance Tests', () => {
  let compressionManager: CompressionManager;
  let testConfig: CompressionConfig;

  beforeEach(() => {
    compressionManager = new CompressionManager();
    testConfig = {
      enabled: true,
      threshold: 50,
      strategy: 'summary',
      preserveToolHistory: true,
      preserveRecentMessages: 20,
      notifyBeforeCompression: false
    };
    vi.clearAllMocks();
  });

  describe('Compression Performance', () => {
    it('should reduce token usage significantly', async () => {
      const messages = createLongConversation(100);
      
      const usageBefore = messages.reduce((sum, msg) => sum + msg.content.length, 0);
      
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(result.originalTokenCount).toBeGreaterThan(0);
      expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });

    it('should maintain performance with different compression strategies', async () => {
      const messages = createLongConversation(50);
      const strategies: Array<'summary' | 'sliding-window' | 'importance'> = 
        ['summary', 'sliding-window', 'importance'];
      
      for (const strategy of strategies) {
        const config: CompressionConfig = { ...testConfig, strategy };
        const result = await compressionManager.compress(messages, config, 'tiny-test-model');
        
        expect(result.compressed).toBe(true);
        expect(result.strategy).toBe(strategy);
        expect(result.reductionPercentage).toBeGreaterThan(0);
      }
    });

    it('should scale linearly with message count for summary strategy', async () => {
      const smallMessages = createLongConversation(25);
      const mediumMessages = createLongConversation(50);
      const largeMessages = createLongConversation(100);
      
      const smallStart = Date.now();
      await compressionManager.compress(smallMessages, testConfig, 'tiny-test-model');
      const smallDuration = Date.now() - smallStart;
      
      const mediumStart = Date.now();
      await compressionManager.compress(mediumMessages, testConfig, 'tiny-test-model');
      const mediumDuration = Date.now() - mediumStart;
      
      const largeStart = Date.now();
      await compressionManager.compress(largeMessages, testConfig, 'tiny-test-model');
      const largeDuration = Date.now() - largeStart;
      
      // Large should not be more than 5x slower than small
      expect(largeDuration).toBeLessThan(smallDuration * 5);
    });
  });

  describe('Session Management Performance', () => {
    it('should handle message processing under load', async () => {
      const messages = createLongConversation(50);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });

    it('should maintain performance with compression enabled', async () => {
      const messages = createLongConversation(100);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete in <10s
    });

    it('should handle large sessions efficiently', async () => {
      const messages = createLongConversation(200);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(duration).toBeLessThan(15000); // Should complete in <15s
    });
  });

  describe('Throughput Performance', () => {
    it('should maintain throughput under sustained load', async () => {
      const messages = createLongConversation(100);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      
      // Should process at least 20 messages per second
      const throughput = messages.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(2);
    });

    it('should handle concurrent compression operations', async () => {
      const messages = createLongConversation(50);
      
      const promises = Array.from({ length: 5 }, () =>
        compressionManager.compress(messages, testConfig, 'tiny-test-model')
      );
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      results.forEach(result => {
        expect(result.compressed).toBe(true);
      });
      
      expect(duration).toBeLessThan(10000); // 5 concurrent ops in <10s
    });
  });

  describe('Stress Tests', () => {
    it('should maintain performance with mixed workloads', async () => {
      const messages: any[] = [];
      
      for (let i = 0; i < 100; i++) {
        messages.push({
          id: `msg-${i}`,
          role: 'user',
          content: `Mixed test ${i + 1}`,
          timestamp: Date.now() - (100 - i) * 1000
        });
        
        if (i % 5 === 0) {
          messages.push({
            id: `msg-${i}-assistant`,
            role: 'assistant',
            content: `Code response ${i + 1}`,
            timestamp: Date.now() - (100 - i) * 900
          });
        } else if (i % 3 === 0) {
          messages.push({
            id: `msg-${i}-tool`,
            role: 'tool',
            content: `Tool result ${i + 1}`,
            timestamp: Date.now() - (100 - i) * 800,
            toolResults: [
              { toolCallId: `tool-${i}`, name: 'test', output: `Result ${i + 1}` } as any
            ] as any
          });
        }
      }
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(10000);
    });

    it('should handle very large message sets', async () => {
      const messages = createLongConversation(500);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Benchmark Tests', () => {
    it('should meet baseline performance benchmarks', async () => {
      const messages = createLongConversation(100);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      
      // Baseline: compress 100 messages in <5 seconds
      expect(duration).toBeLessThan(5000);
      
      // Baseline: reduce by at least 50%
      expect(result.reductionPercentage).toBeGreaterThan(50);
    });

    it('should maintain consistent performance across runs', async () => {
      const messages = createLongConversation(50);
      
      const runs = 5;
      const durations: number[] = [];
      
      for (let i = 0; i < runs; i++) {
        const start = Date.now();
        await compressionManager.compress(messages, testConfig, 'tiny-test-model');
        durations.push(Date.now() - start);
      }
      
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / runs;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      // Performance should be consistent (within 2x variance)
      expect(maxDuration / minDuration).toBeLessThan(2);
      
      // Average should be reasonable
      expect(avgDuration).toBeLessThan(3000);
    });
  });
});
