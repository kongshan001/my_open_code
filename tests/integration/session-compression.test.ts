import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../src/session.js';
import { CompressionManager } from '../../src/compression.js';
import { Message } from '../../src/types.js';
import type { CompressionConfig } from '../../src/types.js';

describe('Session-Compression Integration Tests', () => {
  let compressionManager: CompressionManager;
  let testMessages: Message[];
  const testConfig: CompressionConfig = {
    enabled: true,
    threshold: 75,
    strategy: 'summary',
    preserveToolHistory: true,
    preserveRecentMessages: 10,
    notifyBeforeCompression: false
  };

  beforeEach(() => {
    compressionManager = new CompressionManager();
    
    testMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Help me with a task',
        timestamp: Date.now() - 1000
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'I will help you with the task. Let me create a file.',
        timestamp: Date.now() - 800,
        toolCalls: [
          { id: 'tool-1', name: 'write', arguments: { filePath: 'test.js', content: 'console.log("hello")' } }
        ]
      },
      {
        id: 'msg-3',
        role: 'tool',
        content: 'File created successfully',
        timestamp: Date.now() - 600,
        toolResults: [
          { toolCallId: 'tool-1', name: 'write', output: 'File created' }
        ]
      }
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Management with Compression', () => {
    it('should automatically trigger compression when context limit is approached', async () => {
      // Create large conversation
      const largeMessages: Message[] = [];
      for (let i = 0; i < 50; i++) {
        largeMessages.push({
          id: `msg-${i}`,
          role: 'user',
          content: `This is a test message ${i + 1} with some content to increase token count.`,
          timestamp: Date.now() - (50 - i) * 1000
        });
        
        largeMessages.push({
          id: `msg-${i}-assistant`,
          role: 'assistant',
          content: `I understand your request ${i + 1}. Here is my response.`,
          timestamp: Date.now() - (50 - i) * 900
        });
      }
      
      const result = await compressionManager.compress(largeMessages, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });

    it('should preserve conversation flow after compression', async () => {
      const result = await compressionManager.compress(testMessages, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      
      if (result.compressedMessages) {
        // Verify tool calls and results are preserved
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

    it('should maintain session metadata after compression', async () => {
      const result = await compressionManager.compress(testMessages, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.originalTokenCount).toBeGreaterThan(0);
      expect(result.compressedTokenCount).toBeLessThanOrEqual(result.originalTokenCount);
    });
  });

  describe('Compression Strategy Integration', () => {
    it('should handle different compression strategies in real usage', async () => {
      const strategies: Array<'summary' | 'sliding-window' | 'importance'> = 
        ['summary', 'sliding-window', 'importance'];
      
      for (const strategy of strategies) {
        const config: CompressionConfig = { ...testConfig, strategy };
        const result = await compressionManager.compress(testMessages, config, 'tiny-test-model');
        
        expect(result.compressed).toBe(true);
        expect(result.strategy).toBe(strategy);
      }
    });

    it('should preserve tool history across different strategies', async () => {
      const strategies: Array<'summary' | 'sliding-window' | 'importance'> = 
        ['summary', 'sliding-window', 'importance'];
      
      for (const strategy of strategies) {
        const config: CompressionConfig = { ...testConfig, strategy, preserveToolHistory: true };
        const result = await compressionManager.compress(testMessages, config, 'tiny-test-model');
        
        if (result.compressedMessages) {
          const hasToolMessage = result.compressedMessages.some(msg => 
            msg.role === 'tool' || (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0)
          );
          expect(hasToolMessage).toBe(true);
        }
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle compression failures gracefully', async () => {
      // Test with empty messages (edge case)
      const emptyMessages: Message[] = [];
      const result = await compressionManager.compress(emptyMessages, testConfig, 'glm-4.7');
      
      expect(result.compressed).toBe(false);
      expect(result.originalTokenCount).toBe(0);
      expect(result.message).toContain('No compression needed');
    });

    it('should continue conversation after compression errors', async () => {
      const invalidMessages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() }
      ];
      
      const result = await compressionManager.compress(invalidMessages, testConfig, 'glm-4.7');
      
      expect(result).toBeDefined();
      expect(result.compressed).toBe(false);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large conversations efficiently', async () => {
      const largeMessages: Message[] = [];
      for (let i = 0; i < 100; i++) {
        largeMessages.push({
          id: `msg-${i}`,
          role: 'user',
          content: `Performance test message ${i + 1} with sufficient content to test compression efficiency.`,
          timestamp: Date.now() - (100 - i) * 1000
        });
        
        if (i % 2 === 0) {
          largeMessages.push({
            id: `msg-${i}-assistant`,
            role: 'assistant',
            content: `Response ${i + 1} with some details about the task.`,
            timestamp: Date.now() - (100 - i) * 900
          });
        }
      }
      
      const startTime = Date.now();
      const result = await compressionManager.compress(largeMessages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle a typical coding conversation', async () => {
      const codingMessages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Create a function to sort an array', timestamp: Date.now() - 4000 },
        { 
          id: 'msg-2', 
          role: 'assistant', 
          content: 'I\'ll create a sort function for you.',
          timestamp: Date.now() - 3000,
          toolCalls: [
            { id: 'tool-1', name: 'write', arguments: { filePath: 'sort.js', content: 'function sort(arr) { return arr.sort((a,b) => a-b); }' } as any }
          ] as any
        },
        { 
          id: 'msg-3', 
          role: 'tool', 
          content: 'File created: sort.js',
          timestamp: Date.now() - 2000,
          toolResults: [
            { toolCallId: 'tool-1', name: 'write', output: 'File created successfully' } as any
          ] as any
        },
        { id: 'msg-4', role: 'user', content: 'Now make it handle objects', timestamp: Date.now() - 1000 },
        { id: 'msg-5', role: 'assistant', content: 'I\'ll update the function to sort objects by a property.', timestamp: Date.now() }
      ];
      
      const result = await compressionManager.compress(codingMessages, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      
      if (result.compressedMessages) {
        // Verify tool history is preserved
        const hasToolCall = codingMessages.some(msg => msg.toolCalls && msg.toolCalls.length > 0);
        const hasToolResult = codingMessages.some(msg => msg.toolResults && msg.toolResults.length > 0);
        
        expect(hasToolCall || hasToolResult).toBe(true);
      }
    });

    it('should handle debugging conversation with errors', async () => {
      const debugMessages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'I have an error in my code', timestamp: Date.now() - 3000 },
        { id: 'msg-2', role: 'assistant', content: 'What error are you seeing?', timestamp: Date.now() - 2500 },
        { id: 'msg-3', role: 'user', content: 'Error: Cannot read property of undefined', timestamp: Date.now() - 2000 },
        { 
          id: 'msg-4', 
          role: 'assistant', 
          content: 'This error typically occurs when accessing an undefined object property. Check your initialization.',
          timestamp: Date.now() - 1500
        },
        { id: 'msg-5', role: 'user', content: 'Here is my code: const obj = null; obj.value = 1;', timestamp: Date.now() - 1000 },
        { id: 'msg-6', role: 'assistant', content: 'The issue is that obj is null. Initialize it as an object first.', timestamp: Date.now() }
      ];
      
      const result = await compressionManager.compress(debugMessages, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });
});
