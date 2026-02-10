import { describe, it, expect, beforeEach } from 'vitest';
import { CompressionManager } from '../../src/compression.js';
import { createTestMessage } from '../helpers/factories.js';
import type { CompressionConfig } from '../../src/types.js';

describe('Compression Integration Tests', () => {
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

  describe('Tool History Preservation', () => {
    it('should preserve tool history during compression', async () => {
      const messages = [
        createTestMessage({ content: 'List files' }),
        createTestMessage({
          role: 'assistant',
          content: 'I\'ll list files.',
          toolCalls: [
            { id: 'tool-1', name: 'bash', arguments: { command: 'ls -la' } }
          ]
        }),
        createTestMessage({
          role: 'tool',
          content: 'File listing:',
          toolResults: [
            { toolCallId: 'tool-1', name: 'bash', output: 'package.json' }
          ]
        }),
        createTestMessage({ content: 'Continue working with files' }),
      ];

      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 2,
        preserveToolHistory: true
      };

      const result = await compressionManager.compress(messages, config, 'tiny-model');

      expect(result.compressed).toBe(true);

      if (result.compressedMessages) {
        const hasToolCall = result.compressedMessages.some(msg =>
          msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0
        );
        expect(hasToolCall).toBe(true);

        const hasToolResult = result.compressedMessages.some(msg =>
          msg.role === 'tool' && msg.toolResults && msg.toolResults.length > 0
        );
        expect(hasToolResult).toBe(true);
      }
    });

    it('should preserve recent messages when configured', async () => {
      const messages = [
        createTestMessage({ content: 'Old message 1' }),
        createTestMessage({ content: 'Old message 2' }),
        createTestMessage({ content: 'Old message 3' }),
        createTestMessage({ content: 'Recent message 1' }),
        createTestMessage({ content: 'Recent message 2' }),
      ];

      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 2,
        preserveToolHistory: false
      };

      const result = await compressionManager.compress(messages, config, 'tiny-model');

      expect(result.compressed).toBe(true);

      if (result.compressedMessages) {
        expect(result.compressedMessages.length).toBe(2);
        expect(result.compressedMessages[0].content).toBe('Recent message 1');
        expect(result.compressedMessages[1].content).toBe('Recent message 2');
      }
    });
  });

  describe('Different Compression Strategies', () => {
    it('should use summary strategy', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage({ content: `Message ${i + 1}` })
      );

      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'summary'
      };

      const result = await compressionManager.compress(messages, config, 'tiny-model');

      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(result.summary).toBeDefined();
    });

    it('should use sliding window strategy', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage({ content: `Message ${i + 1}` })
      );

      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'sliding-window',
        preserveRecentMessages: 10
      };

      const result = await compressionManager.compress(messages, config, 'tiny-model');

      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('sliding-window');
    });

    it('should use importance strategy', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Important task with code' }),
        createTestMessage({ role: 'assistant', content: '```const x = 1;```' }),
        createTestMessage({ role: 'user', content: 'Another message' }),
        createTestMessage({ role: 'assistant', content: 'Regular response' }),
      ];

      const config: CompressionConfig = {
        ...mockConfig,
        strategy: 'importance',
        preserveRecentMessages: 2
      };

      const result = await compressionManager.compress(messages, config, 'tiny-model');

      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('importance');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conversation', async () => {
      const messages: any[] = [];

      const result = await compressionManager.compress(messages, mockConfig, 'glm-4.7');

      expect(result.compressed).toBe(false);
      expect(result.originalTokenCount).toBe(0);
      expect(result.compressedTokenCount).toBe(0);
    });

    it('should handle single message', async () => {
      const messages = [createTestMessage({ content: 'Single message' })];

      const result = await compressionManager.compress(messages, mockConfig, 'glm-4.7');

      expect(result.compressed).toBe(false);
      expect(result.originalTokenCount).toBeGreaterThan(0);
    });

    it('should handle conversation with only user messages', async () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createTestMessage({ role: 'user', content: `User message ${i + 1}` })
      );

      const result = await compressionManager.compress(messages, mockConfig, 'tiny-model');

      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });
  });

  describe('Compression Thresholds', () => {
    it('should respect custom threshold', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage({ content: `Message ${i + 1}` })
      );

      const config: CompressionConfig = {
        ...mockConfig,
        threshold: 50
      };

      const result = await compressionManager.compress(messages, config, 'tiny-model');

      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });

    it('should not compress when below threshold', async () => {
      const messages = Array.from({ length: 5 }, (_, i) =>
        createTestMessage({ content: `Message ${i + 1}` })
      );

      const config: CompressionConfig = {
        ...mockConfig,
        threshold: 90
      };

      const result = await compressionManager.compress(messages, config, 'glm-4.7');

      expect(result.compressed).toBe(false);
      expect(result.message).toContain('No compression needed');
    });
  });
});
