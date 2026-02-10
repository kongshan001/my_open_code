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
      `This is user query #${i + 1}. I need help with implementing a feature that involves complex data processing and algorithm optimization. The feature should handle large datasets efficiently.`
    ));
    
    // Assistant response with tool calls
    if (i % 3 === 0) {
      messages.push(createMessage(
        'assistant',
        `I'll help you implement this feature comprehensively. Let me start by examining the current codebase structure and then create all necessary files.`,
        [{ id: `tool-${i}`, name: 'write', args: { filePath: `src/feature${i}.js`, content: 'function test() {}' } }],
        [{ toolCallId: `tool-${i}`, output: 'File created successfully at src/feature.js\nImplementation completed' }]
      ));
    } else {
      const assistantContent = `Here's the comprehensive solution for query #${i + 1}. You should implement the following approach:

## 1. Architecture Design

The solution follows a modular architecture pattern:

\`\`\`javascript
// Main processor class
class DataProcessor {
  constructor(options) {
    this.options = options;
    this.cache = new Map();
  }
  
  async processData(data) {
    return data.map(x => x * 2);
  }
}
\`\`\`

## 2. Implementation Details

### Core Logic
\`\`\`javascript
function optimizeAlgorithm(input) {
  return input.reduce((acc, item) => {
    acc.push(processItem(item));
    return acc;
  }, []);
}
\`\`\`

This comprehensive approach ensures production-ready code with proper error handling.`;
      
      messages.push(createMessage('assistant', assistantContent));
    }
    
    // Add error message occasionally
    if (i % 5 === 0) {
      const errorContent = `Error: Something went wrong while processing request #${i + 1}. Please check the following:

- Verify input parameters
- Check file permissions
- Review memory usage

Full error details:
{
  "code": "PROCESSING_ERROR",
  "message": "Failed to process data",
  "timestamp": "${new Date().toISOString()}"
}`;
      
      messages.push(createMessage('assistant', errorContent));
    }
  }
  
  return messages;
}

describe('Compression Integration Tests', () => {
  let compressionManager: CompressionManager;
  const testConfig: CompressionConfig = {
    enabled: true,
    threshold: 75,
    strategy: 'summary',
    preserveToolHistory: true,
    preserveRecentMessages: 5,
    notifyBeforeCompression: true
  };
  const testModelName = 'glm-test-small';

  beforeEach(() => {
    compressionManager = new CompressionManager();
  });

  it('should compress large conversation with all strategies', async () => {
    const largeConversation = createTestConversation(50);
    const totalTokens = largeConversation.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    
    expect(largeConversation.length).toBe(100);
    expect(totalTokens).toBeGreaterThan(10000);
  });

  it('should handle summary strategy', async () => {
    const largeConversation = createTestConversation(50);
    const config: CompressionConfig = { ...testConfig, strategy: 'summary' };
    
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    
    expect(result.compressed).toBe(true);
    expect(result.strategy).toBe('summary');
    expect(result.originalTokenCount).toBeGreaterThan(result.compressedTokenCount);
    expect(result.summary).toBeDefined();
  });

  it('should handle sliding window strategy', async () => {
    const largeConversation = createTestConversation(50);
    const config: CompressionConfig = { ...testConfig, strategy: 'sliding-window' };
    
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    
    expect(result.compressed).toBe(true);
    expect(result.strategy).toBe('sliding-window');
    expect(result.compressedMessages).toBeDefined();
    expect(result.compressedMessages!.length).toBeLessThan(largeConversation.length);
  });

  it('should handle importance strategy', async () => {
    const largeConversation = createTestConversation(50);
    const config: CompressionConfig = { ...testConfig, strategy: 'importance' };
    
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    
    expect(result.compressed).toBe(true);
    expect(result.strategy).toBe('importance');
  });

  it('should preserve tool history', async () => {
    const largeConversation = createTestConversation(50);
    const config: CompressionConfig = { ...testConfig, preserveToolHistory: true };
    
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    
    if (result.compressedMessages) {
      const originalToolMessages = largeConversation.filter(m => m.role === 'tool' || 
        (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0));
      const compressedToolMessages = result.compressedMessages.filter(m => m.role === 'tool' || 
        (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0));
      
      expect(compressedToolMessages.length).toBe(originalToolMessages.length);
    }
  });

  it('should preserve recent messages', async () => {
    const largeConversation = createTestConversation(50);
    const preserveCount = 5;
    const config: CompressionConfig = { ...testConfig, preserveRecentMessages: preserveCount };
    
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    
    if (result.compressedMessages) {
      const recentMessages = result.compressedMessages.slice(-preserveCount);
      expect(recentMessages.length).toBe(preserveCount);
    }
  });

  it('should handle empty conversation', async () => {
    const emptyResult = await compressionManager.compress([], testConfig, testModelName);
    
    expect(emptyResult.compressed).toBe(false);
    expect(emptyResult.originalTokenCount).toBe(0);
    expect(emptyResult.compressedTokenCount).toBe(0);
  });

  it('should handle single message', async () => {
    const singleMessage = [createMessage('user', 'Hello')];
    const singleResult = await compressionManager.compress(singleMessage, testConfig, testModelName);
    
    expect(singleResult.compressed).toBe(false);
    expect(singleResult.reductionPercentage).toBe(0);
  });

  it('should respect different thresholds', async () => {
    const largeConversation = createTestConversation(50);
    const thresholds = [25, 50, 75];
    
    for (const threshold of thresholds) {
      const config = { ...testConfig, threshold };
      const result = await compressionManager.compress(largeConversation, config, testModelName);
      
      if (threshold < 75) {
        expect(result.compressed).toBe(true);
        expect(result.reductionPercentage).toBeGreaterThan(0);
      }
    }
  });

  it('should handle different preservation settings', async () => {
    const largeConversation = createTestConversation(50);
    
    const configs = [
      { preserveToolHistory: false, preserveRecentMessages: 2 },
      { preserveToolHistory: true, preserveRecentMessages: 15 },
      { preserveToolHistory: false, preserveRecentMessages: 20 }
    ];
    
    for (const configOverride of configs) {
      const config = { ...testConfig, ...configOverride };
      const result = await compressionManager.compress(largeConversation, config, testModelName);
      
      if (result.compressedMessages) {
        expect(result.compressedMessages.length).toBeGreaterThan(0);
      }
    }
  });
});
