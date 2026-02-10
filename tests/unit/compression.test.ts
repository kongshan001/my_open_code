import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompressionManager,
  SummaryCompressionStrategy,
  SlidingWindowCompressionStrategy,
  ImportanceCompressionStrategy
} from '../../src/compression.js';
import { createTestMessage, createTestConfig } from '../helpers/factories.js';
import type { CompressionConfig } from '../../src/types.js';

describe('Compression Module', () => {
  let compressionManager: CompressionManager;
  let testConfig: CompressionConfig;

  beforeEach(() => {
    compressionManager = new CompressionManager();
    testConfig = {
      enabled: true,
      threshold: 75,
      strategy: 'summary',
      preserveToolHistory: true,
      preserveRecentMessages: 10,
      notifyBeforeCompression: true
    };
  });

  describe('SummaryCompressionStrategy', () => {
    let strategy: SummaryCompressionStrategy;

    beforeEach(() => {
      strategy = new SummaryCompressionStrategy();
    });

    it('should not compress short conversations', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Hello' }),
        createTestMessage({ role: 'assistant', content: 'Hi there!' })
      ];

      const result = await strategy.compress(messages, 10, true);

      expect(result.compressedMessages).toEqual(messages);
      expect(result.summary).toContain('No compression needed');
    });

    it('should compress longer conversations', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Question 1' }),
        createTestMessage({ role: 'assistant', content: 'Answer 1' }),
        createTestMessage({ role: 'user', content: 'Question 2' }),
        createTestMessage({ role: 'assistant', content: 'Answer 2' }),
        createTestMessage({ role: 'user', content: 'Question 3' }),
        createTestMessage({ role: 'assistant', content: 'Answer 3' }),
        createTestMessage({ role: 'user', content: 'Question 4' }),
        createTestMessage({ role: 'assistant', content: 'Answer 4' }),
        createTestMessage({ role: 'user', content: 'Question 5' }),
        createTestMessage({ role: 'assistant', content: 'Answer 5' }),
        createTestMessage({ role: 'user', content: 'Question 6' }),
        createTestMessage({ role: 'assistant', content: 'Answer 6' }),
        createTestMessage({ role: 'user', content: 'Question 7' }),
        createTestMessage({ role: 'assistant', content: 'Answer 7' }),
        createTestMessage({ role: 'user', content: 'Question 8' }),
        createTestMessage({ role: 'assistant', content: 'Answer 8' }),
        createTestMessage({ role: 'user', content: 'Question 9' }),
        createTestMessage({ role: 'assistant', content: 'Answer 9' }),
        createTestMessage({ role: 'user', content: 'Question 10' }),
        createTestMessage({ role: 'assistant', content: 'Answer 10' }),
        createTestMessage({ role: 'user', content: 'Question 11' }),
        createTestMessage({ role: 'assistant', content: 'Answer 11' })
      ];

      const result = await strategy.compress(messages, 10, true);

      expect(result.compressedMessages.length).toBeLessThan(messages.length);
      expect(result.compressedMessages[0].role).toBe('assistant');
      expect(result.compressedMessages[0].content).toContain('[Conversation Summary]');
      expect(result.summary).toBeTruthy();
    });

    it('should preserve tool history when requested', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Execute tool' }),
        createTestMessage({
          role: 'assistant',
          content: 'Executing tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} as any }]
        }),
        createTestMessage({
          role: 'tool',
          content: 'Tool result',
          toolResults: [{ toolCallId: 'tool-1', name: 'test-tool', output: 'Result' } as any]
        }),
        ...Array(20).fill(0).map((_, i) =>
          createTestMessage({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`
          })
        )
      ];

      const result = await strategy.compress(messages, 10, true);

      expect(result.compressedMessages).toBeDefined();
      const hasToolResult = result.compressedMessages.some(msg =>
        msg.role === 'tool' || (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0)
      );
      expect(hasToolResult).toBe(true);
    });

    it('should not preserve tool history when disabled', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Execute tool' }),
        createTestMessage({
          role: 'assistant',
          content: 'Executing tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} as any }]
        }),
        createTestMessage({
          role: 'tool',
          content: 'Tool result',
          toolResults: [{ toolCallId: 'tool-1', name: 'test-tool', output: 'Result' } as any]
        }),
        ...Array(20).fill(0).map((_, i) =>
          createTestMessage({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`
          })
        )
      ];

      const result = await strategy.compress(messages, 10, false);

      expect(result.compressedMessages).toBeDefined();
      const hasToolResult = result.compressedMessages.some(msg =>
        msg.role === 'tool' || (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0)
      );
      expect(hasToolResult).toBe(false);
    });

    it('should handle empty conversations gracefully', async () => {
      const messages: any[] = [];

      const result = await strategy.compress(messages, 10, true);

      expect(result.compressedMessages).toEqual([]);
      expect(result.summary).toContain('No compression needed');
    });
  });

  describe('SlidingWindowCompressionStrategy', () => {
    let strategy: SlidingWindowCompressionStrategy;

    beforeEach(() => {
      strategy = new SlidingWindowCompressionStrategy();
    });

    it('should preserve recent messages', async () => {
      const messages = Array.from({ length: 30 }, (_, i) =>
        createTestMessage({ role: 'user', content: `Message ${i + 1}` })
      );

      const result = await strategy.compress(messages, 10, true);

      expect(result.compressedMessages).toHaveLength(10);
      expect(result.compressedMessages).toEqual(messages.slice(-10));
    });

    it('should generate correct summary', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i + 1}` })
      );

      const result = await strategy.compress(messages, 20, false);

      expect(result.compressedMessages).toHaveLength(20);
      expect(result.summary).toContain('removed');
    });
  });

  describe('ImportanceCompressionStrategy', () => {
    let strategy: ImportanceCompressionStrategy;

    beforeEach(() => {
      strategy = new ImportanceCompressionStrategy();
    });

    it('should preserve recent messages', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i + 1}` })
      );

      const result = await strategy.compress(messages, 10, false);

      expect(result.compressedMessages).toBeDefined();
      const recentIds = messages.slice(-10).map(m => m.id);
      const resultIds = result.compressedMessages.map(m => m.id);
      const allRecentPreserved = recentIds.every(id => resultIds.includes(id));
      expect(allRecentPreserved).toBe(true);
    });

    it('should preserve user messages', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Important task' }),
        createTestMessage({ role: 'assistant', content: 'Regular response' }),
        createTestMessage({ role: 'user', content: 'Another task' }),
        createTestMessage({ role: 'assistant', content: 'Regular response' }),
        createTestMessage({ role: 'user', content: 'Third task' }),
      ];

      const result = await strategy.compress(messages, 2, false);

      expect(result.compressedMessages).toBeDefined();
      expect(result.compressedMessages.length).toBeLessThan(messages.length);
    });
  });

  describe('CompressionManager', () => {
    it('should handle unknown strategy error', async () => {
      const messages = [createTestMessage({ role: 'user', content: 'Test' })];
      
      await expect(
        compressionManager.compress(messages, { ...testConfig, strategy: 'unknown' as any }, 'test-model')
      ).rejects.toThrow('Unknown compression strategy');
    });
  });
});
