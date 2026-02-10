import { describe, it, expect, vi } from 'vitest';
import { compressConversation, CompressionManager } from '../../src/compression.js';
import { createTestMessage, createLongConversation } from '../helpers/factories.js';
import { getConfig } from '../../src/config.js';

// Mock config for testing
vi.mock('../../src/config.js');
const mockConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://test-api.com',
  model: 'glm-4.7',
  workingDir: '/test'
};
vi.mocked(getConfig).mockReturnValue(mockConfig);

// Mock implementation for testing
const mockStorage = {
  sessions: new Map(),
  saveSession: vi.fn().mockResolvedValue(),
  loadSession: vi.fn().mockResolvedValue(null),
};

describe('Comprehensive', () => {
  describe('CompressionManager', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize with default configuration', () => {
      const manager = new CompressionManager(mockConfig, mockStorage);
      
      expect(manager.getThreshold()).toBe(80);
      expect(manager.getStrategy()).toBe('summary');
      expect(manager.shouldPreserveToolHistory()).toBe(true);
      expect(manager.getPreserveRecentCount()).toBe(20);
    });

    it('should execute summary compression', async () => {
      const messages = createLongConversation(60);
      const session = {
        id: 'test-session',
        messages,
        updatedAt: Date.now()
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new CompressionManager(mockConfig, mockStorage);
      
      const result = await compression.compress(session.id);
      
      expect(result.compressed).toBe(true);
      expect(result.originalMessageCount).toBe(messages.length);
      expect(result.compressedMessageCount).toBeLessThan(messages.length);
      expect(result.reason).toBe('Context usage exceeded 80% threshold');
      expect(result.strategy).toBe('summary');
      
      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: session.id,
          messages: expect.arrayContaining(
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('compressed')
            })
          )
        })
      );
    });

    it('should execute sliding window compression', async () => {
      const messages = createLongConversation(50);
      const session = {
        id: 'test-session',
        messages,
        updatedAt: Date.now()
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new CompressionManager(mockConfig, mockStorage);
      compression.configure({
        strategy: 'sliding-window',
        windowSize: 20
      });
      
      const result = await compression.compress(session.id);
      
      expect(result.compressed).toBe(true);
      expect(result.originalMessageCount).toBe(50);
      expect(result.compressedMessageCount).toBe(20); // window size
      expect(result.reason).toBe('Context usage exceeded 80% threshold');
      expect(result.strategy).toBe('sliding-window');
    });

    it('should handle importance-based compression', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Important task' }),
        createTestMessage({ role: 'user', content: 'Regular message' }),
        createTestMessage({ role: 'user', content: 'Another task' }),
        createTestMessage({ role: 'assistant', content: 'Will help with tasks' }),
        createTestMessage({ role: 'assistant', content: 'Regular response' }),
      ];
      
      const session = { id: 'test-session', messages };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new CompressionManager(mockConfig, mockStorage);
      compression.configure({
        strategy: 'importance-based',
        importanceThreshold: 3,
        preserveToolHistory: false
      });
      
      const result = await compression.compress(session.id);
      
      expect(result.compressed).toBe(true);
      expect(result.compressedMessageCount).toBe(4); // 2 users + 2 important assists
      expect(result.reason).toBe('Context usage exceeded 80% threshold');
      expect(result.strategy).toBe('importance-based');
    });
  });

  describe('Compression Integration', () => {
    it('should integrate with session compression', async () => {
      // This would test the actual integration between session.ts and compression.ts
      // For now, we'll test the trigger mechanism
      
      const compression = new CompressionManager(mockConfig, mockStorage);
      
      // Test threshold checking
      const highUsageSession = {
        id: 'high-usage',
        messages: createLongConversation(100),
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(highUsageSession);
      
      const shouldCompress = compression.shouldCompress(highUsageSession.messages, mockConfig.model);
      expect(shouldCompress).toBe(true);
    });

    it('should maintain tool history during compression', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'List files' }),
        createTestMessage({ role: 'assistant', content: 'I\\'ll help list files' }),
        createTestMessage({ role: 'tool', content: 'ls executed successfully' }),
        createTestMessage({ role: 'user', content: 'What did you find?' }),
      ];
      
      const session = { id: 'test-session', messages };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new CompressionManager(mockConfig, mockStorage);
      compression.configure({
        strategy: 'sliding-window',
        windowSize: 10,
        preserveToolHistory: true
      });
      
      const result = await compression.compress(session.id);
      
      expect(result.compressed).toBe(true);
      expect(result.compressedMessageCount).toBeLessThan(4);
      
      // Check that tool message is preserved
      const updatedSession = vi.mocked(mockStorage.saveSession).mock.calls[0][0];
      const hasToolMessage = updatedSession.messages.some(
        msg => msg.role === 'tool' && msg.content.includes('ls executed successfully')
      );
      expect(hasToolMessage).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should provide performance metrics', async () => {
      const compression = new CompressionManager(mockConfig, mockStorage);
      
      const startTime = Date.now();
      await compression.compress(createTestMessage().id);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeGreaterThan(0);
      
      // Note: In a real implementation, we would store performance data
      // This test just verifies that compression completes in reasonable time
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });
  });
});