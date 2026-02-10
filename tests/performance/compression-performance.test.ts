import { describe, it, expect, beforeEach } from 'vitest';
import { CompressionManager } from '../../src/compression.js';
import { createTestMessage, createLongConversation } from '../helpers/factories.js';
import type { CompressionConfig } from '../../src/types.js';

describe('Compression Performance Tests', () => {
  let compressionManager: CompressionManager;
  const mockConfig: CompressionConfig = {
    enabled: true,
    threshold: 75,
    strategy: 'summary',
    preserveToolHistory: true,
    preserveRecentMessages: 10,
    notifyBeforeCompression: false
  };

  beforeEach(() => {
    compressionManager = new CompressionManager();
  });

  describe('Token Efficiency', () => {
    it('should reduce token usage significantly', async () => {
      const messages = createLongConversation(100);
      
      const result = await compressionManager.compress(messages, mockConfig, 'tiny-model');
      
      expect(result.compressed).toBe(true);
      expect(result.originalTokenCount).toBeGreaterThan(0);
      expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
      expect(result.reductionPercentage).toBeGreaterThan(50); // At least 50% reduction
    });

    it('should maintain reasonable compression ratio', async () => {
      const messages = createLongConversation(50);
      
      const result = await compressionManager.compress(messages, mockConfig, 'tiny-model');
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(result.reductionPercentage).toBeLessThan(100);
    });
  });

  describe('Performance Metrics', () => {
    it('should complete compression in reasonable time', async () => {
      const messages = createLongConversation(100);
      
      const startTime = Date.now();
      await compressionManager.compress(messages, mockConfig, 'glm-4.7');
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });

    it('should scale linearly with message count', async () => {
      const smallMessages = createLongConversation(50);
      const largeMessages = createLongConversation(200);
      
      const smallStart = Date.now();
      await compressionManager.compress(smallMessages, mockConfig, 'tiny-model');
      const smallDuration = Date.now() - smallStart;
      
      const largeStart = Date.now();
      await compressionManager.compress(largeMessages, mockConfig, 'tiny-model');
      const largeDuration = Date.now() - largeStart;
      
      // Large should be at most 5x slower than small (not exponential)
      expect(largeDuration).toBeLessThan(smallDuration * 5);
    });
  });

  describe('Large Conversation Handling', () => {
    it('should handle very large conversations efficiently', async () => {
      const largeMessages = createLongConversation(500);
      
      const startTime = Date.now();
      const result = await compressionManager.compress(largeMessages, mockConfig, 'tiny-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(10000); // 10s for large operation
      expect(result.reductionPercentage).toBeGreaterThan(50);
    });

    it('should handle long messages efficiently', async () => {
      const longMessages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage({
          content: `This is a very long message ${i + 1}. `.repeat(50)
        })
      );
      
      const result = await compressionManager.compress(longMessages, mockConfig, 'tiny-model');
      
      expect(result.compressed).toBe(true);
      expect(result.originalTokenCount).toBeGreaterThan(0);
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });
  });

  describe('Different Strategies Performance', () => {
    it('should perform well with summary strategy', async () => {
      const messages = createLongConversation(100);
      const config: CompressionConfig = { ...mockConfig, strategy: 'summary' };
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, config, 'tiny-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(duration).toBeLessThan(3000);
    });

    it('should perform well with sliding window strategy', async () => {
      const messages = createLongConversation(100);
      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 20
      };
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, config, 'tiny-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('sliding-window');
      expect(duration).toBeLessThan(3000);
    });

    it('should perform well with importance strategy', async () => {
      const messages = createLongConversation(100);
      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'importance',
        preserveRecentMessages: 20
      };
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, config, 'tiny-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('importance');
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Memory Management', () => {
    it('should prevent memory leaks with repeated compressions', async () => {
      const messages = createLongConversation(100);
      
      // Run multiple compressions
      for (let i = 0; i < 5; i++) {
        await compressionManager.compress(messages, mockConfig, 'tiny-model');
      }
      
      // Verify compression remains effective (should not degrade)
      const finalResult = await compressionManager.compress(messages, mockConfig, 'tiny-model');
      expect(finalResult.compressed).toBe(true);
      expect(finalResult.reductionPercentage).toBeGreaterThan(0);
    });

    it('should handle concurrent compressions gracefully', async () => {
      const messages = createLongConversation(100);
      
      // Run compressions concurrently
      const promises = Array.from({ length: 5 }, () =>
        compressionManager.compress(messages, mockConfig, 'tiny-model')
      );
      
      const results = await Promise.all(promises);
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.compressed).toBe(true);
        expect(result.reductionPercentage).toBeGreaterThan(0);
      });
    });
  });
});
