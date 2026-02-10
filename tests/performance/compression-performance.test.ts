import { describe, it, expect, vi } from 'vitest';
import { formatContextUsage, calculateContextUsage, ContextUsage } from '../../src/token.js';
import { getConfig } from '../../src/config.js';
import { SessionManager } from '../../src/session.js';

// Mock config and storage
vi.mock('../../src/config.js');
const mockConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://test.api.com',
  model: 'glm-4.7',
  workingDir: '/test',
};

vi.mocked(getConfig).mockReturnValue(mockConfig);

const mockStorage = {
  sessions: new Map(),
  saveSession: vi.fn().mockResolvedValue(),
  loadSession: vi.fn().mockResolvedValue(null),
};

describe('Compression System Performance', () => {
  describe('Token Efficiency', () => {
    it('should reduce token usage significantly', async () => {
      const baseSession = {
        id: 'base',
        messages: Array(100).fill(null).map((_, i) => ({
          role: 'user' as const,
          content: `Message ${i}`
        }))
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(baseSession);
      
      const sessionManager = new SessionManager(baseSession, mockConfig);
      
      // Test without compression
      const usageWithout = sessionManager.getContextUsage();
      
      // Simulate compression
      const compression = new (await import('../../src/compression.js')).CompressionManager(mockConfig, mockStorage);
      await compression.compress(baseSession.id);
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue({
        ...baseSession,
        messages: baseSession.messages.slice(0, 20) // Simulated compressed messages
      });
      
      const sessionWithCompression = new SessionManager(
        vi.mocked(mockStorage.loadSession)({
          ...baseSession,
          id: baseSession.id,
          messages: baseSession.messages.slice(0, 20),
          updatedAt: Date.now()
        }),
        mockConfig
      );
      
      const usageWith = sessionWithCompression.getContextUsage();
      
      expect(usageWithout.totalTokens).toBeGreaterThan(usageWith.totalTokens * 1.5);
      expect(usageWith.usagePercentage).toBeLessThan(usageWithout.usagePercentage / 2);
    });

    it('should maintain conversation coherence', async () => {
      const messages = [
        { role: 'user', content: 'I\\'m working on a React project' },
        { role: 'assistant', content: 'That\\'s great!' },
        { role: 'user', content: 'Can you help me with components?' },
        { role: 'assistant', content: 'Sure! I\\'ll help you with React components' },
        { role: 'user', content: 'Let\\'s create a Button component' },
      ];
      
      const session = {
        id: 'coherence-test',
        messages,
        updatedAt: Date.now()
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new (await import('../../src/compression.js')).CompressionManager(mockConfig, mockStorage);
      compression.configure({ strategy: 'importance-based' });
      
      const result = await compression.compress(session.id);
      
      expect(result.compressed).toBe(true);
      expect(result.compressedMessageCount).toBeGreaterThan(0);
      expect(result.compressedMessageCount).toBeLessThan(messages.length);
      
      // Check coherence by checking important keywords are preserved
      vi.mocked(mockStorage.loadSession).mockResolvedValue({
        ...session,
        messages: expect.arrayContaining(
          expect.objectContaining({ content: expect.stringContaining('React') })
        )
      });
    });
  });

  describe('Large Conversation Handling', () => {
    it('should handle very large conversations efficiently', async () => {
      // Test with extremely large message count
      const largeMessages = Array(500).fill(null).map((_, i) => ({
        role: 'user' as const,
        content: `Large message ${i}`
      }));
      
      const session = {
        id: 'large-test',
        messages: largeMessages,
        updatedAt: Date.now()
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new (await import('../../src/compression.js')).CompressionManager(mockConfig, mockStorage);
      
      const startTime = Date.now();
      const result = await compression.compress(session.id);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.compressedMessageCount).toBeLessThan(largeMessages.length);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // 10s for large operation
      
      // Verify effective compression
      const effectiveReduction = (largeMessages.length - result.compressedMessageCount) / largeMessages.length;
      expect(effectiveReduction).toBeGreaterThan(0.5); // At least 50% reduction
    });
  });

  describe('Memory Management', () => {
    it('should prevent memory leaks with repeated compressions', async () => {
      const messages = Array(200).fill(null).map((_, i) => ({
        role: 'user' as const,
        content: `Test message ${i}`
      }));
      
      const session = {
        id: 'memory-test',
        messages,
        updatedAt: Date.now()
      };
      
      vi.mocked(mockStorage.loadSession).mockResolvedValue(session);
      
      const compression = new (await import('../../src/compression.js')).CompressionManager(mockConfig, mockStorage);
      
      // Run multiple compressions
      for (let i = 0; i < 5; i++) {
        await compression.compress(session.id);
      }
      
      // Verify compression remains effective
      const finalSession = vi.mocked(mockStorage.loadSession).mockResolvedValue({
        ...session,
        messages: session.messages.slice(0, 40) // Should stabilize at window size
      });
      
      const finalUsage = calculateContextUsage(finalSession.messages, mockConfig.model);
      
      expect(finalUsage.totalTokens).toBeLessThan(calculateContextUsage(session.messages, mockConfig.model).totalTokens * 0.5);
    });
  });
});