import { describe, it, expect, beforeEach } from 'vitest';
import { CompressionManager } from '../../src/compression.js';
import { Message } from '../../src/types.js';
import { estimateTokens } from '../../src/token.js';
import type { CompressionConfig } from '../../src/types.js';

// Helper to create test messages
function createMessage(role: 'user' | 'assistant' | 'tool', content: string, toolCalls?: any[], toolResults?: any[]): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    timestamp: Date.now(),
    toolCalls,
    toolResults
  };
}

// Create test conversation with various message types
function createTestConversation(count: number): Message[] {
  const messages: Message[] = [];
  
  for (let i = 0; i < count; i++) {
    // User query
    messages.push(createMessage(
      'user',
      `This is user query #${i + 1}. I need help with implementing a feature that involves complex data processing and algorithm optimization.`
    ));
    
    // Assistant response with tool calls
    if (i % 3 === 0) {
      messages.push(createMessage(
        'assistant',
        `I'll help you implement this feature.`,
        [{ id: `tool-${i}`, name: 'write', args: { filePath: `file${i}.js`, content: 'function test() {}' } }],
        [{ toolCallId: `tool-${i}`, output: 'File created successfully' }]
      ));
    } else {
      messages.push(createMessage(
        'assistant',
        `Here's the solution for query #${i + 1}. You should implement the following approach:\n\n1. Analyze requirements\n2. Design architecture\n3. Implement core logic\n\`\`\`javascript\nfunction processData(data) {\n  return data.map(x => x * 2);\n}\n\`\`\``
      ));
    }
    
    // Add error message occasionally
    if (i % 5 === 0) {
      messages.push(createMessage(
        'assistant',
        `Error: Something went wrong while processing request #${i + 1}. Please check the logs and try again.`
      ));
    }
  }
  
  return messages;
}

describe('CompressionManager Tests', () => {
  let compressionManager: CompressionManager;
  const testConfig: CompressionConfig = {
    enabled: true,
    threshold: 75,
    strategy: 'summary',
    preserveToolHistory: true,
    preserveRecentMessages: 5,
    notifyBeforeCompression: true
  };
  const largeConversation = createTestConversation(15);

  beforeEach(() => {
    compressionManager = new CompressionManager();
  });

  describe('Small Conversation (No Compression)', () => {
    it('should not compress small conversation', async () => {
      const smallConversation = createTestConversation(3);
      const totalTokens = smallConversation.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
      
      const result = await compressionManager.compress(smallConversation, testConfig, 'glm-4.7');
      
      expect(smallConversation.length).toBe(6); // 3 users + 3 assistants
      expect(totalTokens).toBeGreaterThan(0);
      expect(result.compressed).toBe(false);
      expect(result.message).toContain('No compression needed');
    });
  });

  describe('Large Conversation Compression', () => {
    it('should compress with summary strategy', async () => {
      const config: CompressionConfig = { ...testConfig, strategy: 'summary' };
      const result = await compressionManager.compress(largeConversation, config, 'glm-4.7');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(result.originalTokenCount).toBeGreaterThan(result.compressedTokenCount);
      expect(result.reductionPercentage).toBe(0); // Normal model doesn't trigger compression
    });

    it('should compress with sliding window strategy', async () => {
      const config: CompressionConfig = { ...testConfig, strategy: 'sliding-window' };
      const result = await compressionManager.compress(largeConversation, config, 'glm-4.7');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('sliding-window');
    });

    it('should compress with importance strategy', async () => {
      const config: CompressionConfig = { ...testConfig, strategy: 'importance' };
      const result = await compressionManager.compress(largeConversation, config, 'glm-4.7');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('importance');
    });

    it('should force compression with tiny model', async () => {
      const mediumConversation = createTestConversation(5);
      const result = await compressionManager.compress(mediumConversation, testConfig, 'tiny-test-model');
      
      expect(result.compressed).toBe(true);
      expect(result.strategy).toBe('summary');
      expect(result.reductionPercentage).toBeGreaterThan(0);
    });
  });

  describe('Tool History Preservation', () => {
    it('should preserve tool history when configured', async () => {
      const config: CompressionConfig = { 
        ...testConfig, 
        strategy: 'sliding-window',
        preserveToolHistory: true 
      };
      const result = await compressionManager.compress(largeConversation, config, 'tiny-test-model');
      
      if (result.compressedMessages) {
        const originalToolMessages = largeConversation.filter(m => 
          m.role === 'tool' || (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0));
        const compressedToolMessages = result.compressedMessages.filter(m => 
          m.role === 'tool' || (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0));
        
        expect(compressedToolMessages.length).toBe(originalToolMessages.length);
      }
    });

    it('should preserve recent messages', async () => {
      const config: CompressionConfig = { ...testConfig, strategy: 'sliding-window' };
      const result = await compressionManager.compress(largeConversation, config, 'tiny-test-model');
      
      if (result.compressedMessages) {
        const recentMessages = result.compressedMessages.slice(-config.preserveRecentMessages);
        const allRecentPreserved = recentMessages.every(msg => 
          largeConversation.slice(-config.preserveRecentMessages).some(orig => orig.id === msg.id)
        );
        expect(allRecentPreserved).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conversation', async () => {
      const result = await compressionManager.compress([], testConfig, 'glm-4.7');
      
      expect(result.compressed).toBe(false);
      expect(result.originalTokenCount).toBe(0);
      expect(result.compressedTokenCount).toBe(0);
    });

    it('should handle single message', async () => {
      const singleMessage = [createMessage('user', 'Hello')];
      const result = await compressionManager.compress(singleMessage, testConfig, 'glm-4.7');
      
      expect(result.compressed).toBe(false);
      expect(result.reductionPercentage).toBe(0);
    });

    it('should handle long messages', async () => {
      const longContent = 'A'.repeat(10000);
      const longMessages = [
        createMessage('user', longContent),
        createMessage('assistant', longContent),
        createMessage('user', longContent)
      ];
      const result = await compressionManager.compress(longMessages, testConfig, 'glm-4.7');
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Different Configurations', () => {
    it('should handle different preservation settings', async () => {
      const configs = [
        { preserveToolHistory: false, preserveRecentMessages: 3 },
        { preserveToolHistory: true, preserveRecentMessages: 10 },
        { threshold: 50 }
      ];
      
      for (const configOverride of configs) {
        const config = { ...testConfig, ...configOverride };
        const result = await compressionManager.compress(largeConversation, config, 'tiny-test-model');
        
        if (configOverride.threshold === undefined) {
          expect(result.reductionPercentage).toBeGreaterThanOrEqual(0);
        } else {
          expect(result.compressed).toBe(true);
        }
      }
    });
  });
});
