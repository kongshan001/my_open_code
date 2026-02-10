import { describe, it, expect } from 'vitest';
import { createTestMessage } from '../helpers/factories.js';

describe('Integration Tests', () => {
  describe('Compression Integration', () => {
    it('should trigger compression at threshold', async () => {
      const session = {
        id: 'integration-test',
        messages: [
          createTestMessage({ content: 'Test message 1' }),
          createTestMessage({ content: 'Test message 2' }),
          createTestMessage({ content: 'Test message 3' }),
          createTestMessage({ content: 'Test message 4' }),
        ],
        updatedAt: Date.now()
      };
      
      // Import the implementation
      const compression = (await import('../../src/compression.js')).CompressionManager;
      
      // Configure for testing
      compression.configure({
        threshold: 3, // Very low threshold for testing
        strategy: 'summary'
      });
      
      // Create mock session manager with compression
      const { SessionManager } = await import('../../src/session.js');
      
      vi.mock('../../src/config.js').mockReturnValue({
        apiKey: 'test-key',
        model: 'glm-4.7',
        workingDir: '/test',
      });
      
      vi.mock('../../src/storage.js').mockResolvedValue(session);
      
      const sessionManager = new SessionManager(session, {
        apiKey: 'test-key',
        baseUrl: 'https://test.api.com',
        model: 'glm-4.7',
        workingDir: '/test',
      });
      
      // Process a message to check if compression is triggered
      await sessionManager.addUserMessage('This should trigger compression');
      
      // Verify compression was called
      // In real implementation, this would result in the session being compressed
      expect(sessionManager.getSession().messages.length).toBeGreaterThan(0);
      expect(compression.shouldCompress).toHaveBeenCalled();
    });
  });

  describe('Tool Execution Integration', () => {
    it('should preserve tool history during compression', async () => {
      const messages = [
        createTestMessage({ content: 'List files' }),
        createTestMessage({
          role: 'assistant',
          content: 'I\\'ll list files.',
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
        createTestMessage({ content: 'Continue working with the files' }),
      ];
      
      // Mock storage
      const { SessionManager } = await import('../../src/session.js');
      
      vi.mock('../../src/config.js').mockReturnValue({
        apiKey: 'test-key',
        model: 'glm-4.7',
        workingDir: '/test',
      });
      
      vi.mock('../../src/storage.js').mockResolvedValue({
        id: 'tool-integration-test',
        messages,
        updatedAt: Date.now()
      });
      
      const sessionManager = new SessionManager(
        {
          id: 'tool-integration-test',
          messages,
          updatedAt: Date.now()
        },
        {
          apiKey: 'test-key',
          baseUrl: 'https://test.api.com',
          model: 'glm-4.7',
          workingDir: '/test',
        }
      );
      
      // Trigger compression
      const compression = (await import('../../src/compression.js')).CompressionManager;
      compression.configure({
        threshold: 2, // Low threshold
        strategy: 'sliding-window',
        windowSize: 10,
        preserveToolHistory: true,
      });
      
      // Process a message to trigger compression
      await sessionManager.addUserMessage('This should compress with tool history preserved');
      
      const updatedSession = sessionManager.getSession();
      
      // Verify tool history is preserved
      const hasToolCall = updatedSession.messages.some(msg => 
        msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0
      );
      expect(hasToolCall).toBe(true);
      
      // Verify tool result is preserved
      const hasToolResult = updatedSession.messages.some(msg => 
        msg.role === 'tool' && msg.toolResults && msg.toolResults.length > 0
      );
      expect(hasToolResult).toBe(true);
    });
  });

  describe('Rollback Capability', () => {
    it('should allow rollback of compression', async () => {
      const originalMessages = [
        createTestMessage({ content: 'Important message 1' }),
        createTestMessage({ content: 'Important message 2' }),
        createTestMessage({ content: 'Important message 3' }),
      ];
      
      const compressedMessages = [
        createTestMessage({ role: 'system', content: 'Compressed conversation summary' }),
        createTestMessage({ content: 'Important message 1' }),
        createTestMessage({ content: 'Important message 2' }),
      ];
      
      // Mock storage with two versions
      const { SessionManager } = await import('../../src/session.js');
      
      vi.mock('../../src/config.js').mockReturnValue({
        apiKey: 'test-key',
        model: 'glm-4.7',
        workingDir: '/test',
      });
      
      vi.mock('../../src/storage.js')
        .mockResolvedValueOnce({
          id: 'rollback-test',
          messages: originalMessages,
          updatedAt: Date.now()
        })
        .mockResolvedValueOnce({
          id: 'rollback-test',
          messages: compressedMessages,
          updatedAt: Date.now()
        });
        .mockResolvedValueOnce({
          id: 'rollback-test',
          messages: compressedMessages,
          updatedAt: Date.now(),
          metadata: {
            compression: {
              originalCount: originalMessages.length,
              compressedCount: compressedMessages.length,
              strategy: 'summary'
            }
          }
        });
      
      const sessionManager = new SessionManager(
        {
          id: 'rollback-test',
          messages: compressedMessages,
          updatedAt: Date.now(),
          metadata: {
            compression: {
              originalCount: originalMessages.length,
              compressedCount: compressedMessages.length,
              strategy: 'summary'
            }
          }
        },
        {
          apiKey: 'test-key',
          baseUrl: 'https://test.api.com',
          model: 'glm-4.7',
          workingDir: '/test',
        }
      );
      
      // Test rollback
      const { CompressionManager } = await import('../../src/compression.js');
      compression.rollback('rollback-test');
      
      const rolledBackSession = vi.mocked(mockStorage.loadSession).mockCalls[2][0];
      
      expect(rolledBackSession.messages).toEqual(originalMessages);
      expect(rolledBackSession.metadata?.compression).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle compression errors gracefully', async () => {
      const { SessionManager } = await import('../../src/session.js');
      
      vi.mock('../../src/config.js').mockReturnValue({
        apiKey: 'test-key',
        model: 'glm-4.7',
        workingDir: '/test',
      });
      
      vi.mock('../../src/storage.js').mockResolvedValue({
        id: 'error-test',
        messages: [createTestMessage({ content: 'test' })],
        updatedAt: Date.now()
      });
      
      const sessionManager = new SessionManager(
        {
          id: 'error-test',
          messages: [createTestMessage({ content: 'test' })],
          updatedAt: Date.now()
        },
        {
          apiKey: 'test-key',
          baseUrl: 'https://test.api.com',
          model: 'glm-4.7',
          workingDir: '/test',
        }
      );
      
      const compression = (await import('../../src/compression.js')).CompressionManager;
      
      // Mock storage error during compression
      vi.mock('../../src/storage.js').mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await compression.compress('error-test');
      
      // Should handle error gracefully
      expect(result.compressed).toBe(false);
      
      // Session should remain unchanged
      const sessionAfterError = sessionManager.getSession();
      expect(sessionAfterError.messages).toEqual([createTestMessage({ content: 'test' })]);
    });
  });
});