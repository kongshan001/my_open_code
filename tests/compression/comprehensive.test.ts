import { describe, it, expect, beforeEach } from 'vitest';
import { CompressionManager } from '../../src/compression.js';
import { createTestMessage, createLongConversation } from '../helpers/factories.js';
import type { Config, CompressionConfig } from '../../src/types.js';

// Mock config for testing
const mockConfig: Config = {
  apiKey: 'test-api-key',
  baseUrl: 'https://test-api.com',
  model: 'glm-4.7',
  workingDir: '/test'
};

const mockCompressionConfig: CompressionConfig = {
  enabled: true,
  threshold: 80,
  strategy: 'summary',
  preserveToolHistory: true,
  preserveRecentMessages: 20,
  notifyBeforeCompression: false
};

describe('Comprehensive Compression Tests', () => {
  let compressionManager: CompressionManager;

  beforeEach(() => {
    compressionManager = new CompressionManager();
  });

  describe('CompressionManager', () => {
    it('should execute summary compression', async () => {
      const messages = createLongConversation(60);
      
      const result = await compressionManager.compress(messages, mockCompressionConfig, mockConfig.model);
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(result.originalTokenCount).toBeGreaterThan(0);
      expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(result.compressedMessages).toBeDefined();
    });

    it('should execute sliding window compression', async () => {
      const messages = createLongConversation(50);
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 20
      };
      
      const result = await compressionManager.compress(messages, config, mockConfig.model);
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('sliding-window');
      expect(result.originalTokenCount).toBeGreaterThan(result.compressedTokenCount);
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });

    it('should handle importance-based compression', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Important task' }),
        createTestMessage({ role: 'user', content: 'Regular message' }),
        createTestMessage({ role: 'user', content: 'Another task' }),
        createTestMessage({ role: 'assistant', content: 'Will help with tasks' }),
        createTestMessage({ role: 'assistant', content: 'Regular response' }),
      ];
      
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        strategy: 'importance',
        preserveRecentMessages: 2,
        preserveToolHistory: false
      };
      
      const result = await compressionManager.compress(messages, config, 'tiny-model');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('importance');
      expect(result.reductionPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should not compress short conversations', async () => {
      const messages = createLongConversation(5);
      
      const result = await compressionManager.compress(messages, mockCompressionConfig, mockConfig.model);
      
      expect(result.compressed).toBe(false);
      expect(result.strategy).toBe('none');
      expect(result.reductionPercentage).toBe(0);
      expect(result.message).toContain('No compression needed');
    });

    it('should handle empty conversation', async () => {
      const messages: any[] = [];
      
      const result = await compressionManager.compress(messages, mockCompressionConfig, mockConfig.model);
      
      expect(result.compressed).toBe(false);
      expect(result.originalTokenCount).toBe(0);
      expect(result.compressedTokenCount).toBe(0);
    });
  });

  describe('Tool History Preservation', () => {
    it('should preserve tool messages when configured', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'List files' }),
        createTestMessage({ role: 'assistant', content: 'I\'ll help list files' }),
        createTestMessage({ role: 'tool', content: 'ls executed successfully' }),
        createTestMessage({ role: 'user', content: 'What did you find?' }),
      ];
      
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 2,
        preserveToolHistory: true
      };
      
      const result = await compressionManager.compress(messages, config, 'tiny-model');
      
      expect(result.compressed).toBe(true);
      
      if (result.compressedMessages) {
        const hasToolMessage = result.compressedMessages.some(
          msg => msg.role === 'tool' && msg.content.includes('ls executed successfully')
        );
        expect(hasToolMessage).toBe(true);
      }
    });

    it('should not preserve tool messages when disabled', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'List files' }),
        createTestMessage({ role: 'assistant', content: 'I\'ll help list files' }),
        createTestMessage({ role: 'tool', content: 'ls executed successfully' }),
        createTestMessage({ role: 'user', content: 'What did you find?' }),
      ];
      
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 2,
        preserveToolHistory: false
      };
      
      const result = await compressionManager.compress(messages, config, 'tiny-model');
      
      expect(result.compressed).toBe(true);
      
      if (result.compressedMessages) {
        const hasToolMessage = result.compressedMessages.some(
          msg => msg.role === 'tool' && msg.content.includes('ls executed successfully')
        );
        expect(hasToolMessage).toBe(false);
      }
    });
  });

  describe('Performance', () => {
    it('should complete compression in reasonable time', async () => {
      const messages = createLongConversation(100);
      
      const startTime = Date.now();
      await compressionManager.compress(messages, mockCompressionConfig, mockConfig.model);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });
  });
});
