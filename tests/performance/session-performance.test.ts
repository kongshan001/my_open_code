import { describe, it, expect, beforeEach } from 'vitest';
import { CompressionManager } from '../../src/compression.js';
import { Message } from '../../src/types.js';
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

// Create long content message
function createLongMessage(index: number, role: 'user' | 'assistant', toolCalls?: any[], toolResults?: any[]): Message {
  let content = '';
  
  if (role === 'user') {
    content = `I need help with task #${index + 1}. This is a complex problem that requires a comprehensive solution.

The requirements are:
1. Implement a scalable architecture
2. Ensure high performance
3. Add comprehensive error handling
4. Include unit tests
5. Document everything properly
6. Consider security implications
7. Optimize for production use
8. Make it maintainable for future developers

Please provide detailed code examples, explanations, and best practices for each step. The solution should be production-ready and follow industry standards.`;
  } else {
    content = `I'll help you implement task #${index + 1} with a comprehensive solution.

## Architecture Design

For this high-traffic, scalable system, I recommend a microservices architecture:

\`\`\`typescript
// Main service interface
interface ServiceInterface {
  initialize(): Promise<void>;
  process(data: RequestData): Promise<ResponseData>;
  cleanup(): Promise<void>;
}
\`\`\`

## Implementation Details

### Performance Optimization

\`\`\`typescript
// Optimized data processing
class DataProcessor implements ServiceInterface {
  private cache: Map<string, any>;
  
  async process(data: RequestData): Promise<ResponseData> {
    const cached = this.cache.get(data.key);
    if (cached) return cached;
    
    const result = await this.transform(data);
    this.cache.set(data.key, result);
    return result;
  }
}
\`\`\`

This comprehensive solution addresses all your requirements for a production-ready, scalable system.`;
  }
  
  return createMessage(role, content, toolCalls, toolResults);
}

describe('Session Performance Tests', () => {
  let compressionManager: CompressionManager;
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
  });

  describe('Message Processing Performance', () => {
    it('should process messages under load efficiently', async () => {
      const messages: Message[] = [];
      
      // Create 50 pairs of messages
      for (let i = 0; i < 50; i++) {
        messages.push(createLongMessage(i, 'user'));
        
        if (i % 3 === 0) {
          messages.push(
            createLongMessage(
              i,
              'assistant',
              [{ id: `tool-${i}`, name: 'write', args: { filePath: `src/service${i}.ts`, content: 'code' } }],
              [{ toolCallId: `tool-${i}`, output: 'File created successfully' }]
            )
          );
        } else {
          messages.push(createLongMessage(i, 'assistant'));
        }
      }
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in <5s
    });

    it('should handle message processing under load', async () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMessage('user', `Test message ${i + 1}`)
      );
      
      const startTime = Date.now();
      await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Compression Performance', () => {
    it('should maintain performance with compression enabled', async () => {
      const messages = Array.from({ length: 150 }, (_, i) =>
        createMessage('user', `Performance test message ${i + 1}`)
      );
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000);
    });

    it('should perform compression efficiently with tool history', async () => {
      const messages: Message[] = [];
      
      for (let i = 0; i < 50; i++) {
        messages.push(createMessage('user', `Query ${i + 1}`));
        
        if (i % 3 === 0) {
          messages.push(
            createMessage(
              'assistant',
              `Response ${i + 1}`,
              [{ id: `tool-${i}`, name: 'bash', args: { command: `test ${i}` } }],
              [{ toolCallId: `tool-${i}`, output: `Output ${i}` }]
            )
          );
        }
      }
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Throughput Performance', () => {
    it('should maintain throughput under sustained load', async () => {
      const messages = Array.from({ length: 200 }, (_, i) =>
        createMessage('user', `Throughput test ${i + 1}`)
      );
      
      const startTime = Date.now();
      await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      // Should process at least 100 messages per second
      const throughput = messages.length / (duration / 1000);
      expect(throughput).toBeGreaterThan(100);
    });

    it('should handle concurrent compression requests', async () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMessage('user', `Concurrent test ${i + 1}`)
      );
      
      const startTime = Date.now();
      
      // Run 5 concurrent compressions
      const promises = Array.from({ length: 5 }, () =>
        compressionManager.compress(messages, testConfig, 'tiny-test-model')
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      results.forEach(result => {
        expect(result.compressed).toBe(true);
      });
      
      expect(duration).toBeLessThan(15000); // 5 concurrent ops in <15s
    });
  });

  describe('Stress Tests', () => {
    it('should maintain performance with mixed workloads', async () => {
      const messages: Message[] = [];
      
      for (let i = 0; i < 100; i++) {
        messages.push(createMessage('user', `Mixed test ${i + 1}`));
        
        if (i % 5 === 0) {
          messages.push(createMessage('assistant', `Code response ${i + 1}`));
        } else if (i % 3 === 0) {
          messages.push(
            createMessage(
              'assistant',
              `Tool response ${i + 1}`,
              [{ id: `tool-mix-${i}`, name: 'bash', args: { command: `cmd${i}` } }],
              [{ toolCallId: `tool-mix-${i}`, output: `Result ${i}` }]
            )
          );
        }
      }
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(duration).toBeLessThan(10000);
    });

    it('should handle very large message sets', async () => {
      const messages = Array.from({ length: 500 }, (_, i) =>
        createMessage('user', `Large set test ${i + 1}`)
      );
      
      const startTime = Date.now();
      const result = await compressionManager.compress(messages, testConfig, 'tiny-test-model');
      const duration = Date.now() - startTime;
      
      expect(result.compressed).toBe(true);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(duration).toBeLessThan(20000);
    });
  });
});
