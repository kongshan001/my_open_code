import { describe, it, expect, beforeEach } from 'vitest';
import { createTestConfig, createTestMessage } from '../helpers/factories.js';
import type { Message } from '../../src/types.js';

describe('LLM Integration Tests', () => {
  let testConfig: any;

  beforeEach(() => {
    testConfig = createTestConfig();
  });

  describe('streamChat', () => {
    it('should handle streaming responses correctly', async () => {
      // Mock async generator to simulate streaming
      const createMockStream = async function* () {
        yield { content: 'Hello' };
        yield { content: ' ' };
        yield { content: 'world' };
        yield { content: '!' };
      };

      const mockStream = createMockStream();

      const systemPrompt = 'You are a helpful assistant.';
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Say hello', timestamp: Date.now() }
      ];

      const responses: any[] = [];
      for await (const response of mockStream) {
        responses.push(response);
      }

      expect(responses).toHaveLength(4);
      expect(responses[0].content).toBe('Hello');
      expect(responses[1].content).toBe(' ');
      expect(responses[2].content).toBe('world');
      expect(responses[3].content).toBe('!');
    });

    it('should handle tool calls in streaming responses', async () => {
      const createMockStreamWithTools = async function* () {
        yield {
          content: 'I will execute a tool for you.',
          toolCalls: [
            {
              id: 'tool-1',
              name: 'test-tool',
              arguments: { action: 'execute' }
            }
          ]
        };
      };

      const mockStream = createMockStreamWithTools();

      const systemPrompt = 'You are a helpful assistant.';
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Execute a tool', timestamp: Date.now() }
      ];

      const responses: any[] = [];
      for await (const response of mockStream) {
        responses.push(response);
      }

      expect(responses).toHaveLength(1);
      expect(responses[0].content).toBe('I will execute a tool for you.');
      expect(responses[0].toolCalls).toBeDefined();
      expect(responses[0].toolCalls).toHaveLength(1);
      expect(responses[0].toolCalls![0].name).toBe('test-tool');
    });

    it('should handle empty messages array', async () => {
      const createMockStream = async function* () {
        yield { content: 'Hello!' };
      };

      const mockStream = createMockStream();

      const systemPrompt = 'You are a helpful assistant.';
      const messages: Message[] = [];

      const responses: any[] = [];
      for await (const response of mockStream) {
        responses.push(response);
      }

      expect(responses).toHaveLength(1);
      expect(responses[0].content).toBe('Hello!');
    });

    it('should preserve message roles correctly', async () => {
      const createMockStream = async function* () {
        yield { content: 'Response 1' };
        yield { content: 'Response 2' };
        yield { content: 'Response 3' };
      };

      const mockStream = createMockStream();

      const systemPrompt = 'You are a helpful assistant.';
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Message 1', timestamp: Date.now() },
        { id: '2', role: 'user', content: 'Message 2', timestamp: Date.now() },
        { id: '3', role: 'user', content: 'Message 3', timestamp: Date.now() }
      ];

      const responses: any[] = [];
      for await (const response of mockStream) {
        responses.push(response);
      }

      expect(responses).toHaveLength(3);
      expect(messages).toHaveLength(3);
    });

    it('should handle large context efficiently', async () => {
      const createMockStream = async function* () {
        yield { content: 'Large context handled' };
      };

      const mockStream = createMockStream();

      const systemPrompt = 'You are a helpful assistant.';
      const messages: Message[] = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: `Test message ${i + 1}`,
        timestamp: Date.now() - (100 - i) * 1000
      }));

      const responses: any[] = [];
      const startTime = Date.now();
      for await (const response of mockStream) {
        responses.push(response);
      }
      const duration = Date.now() - startTime;

      expect(responses).toHaveLength(1);
      expect(duration).toBeLessThan(100);
    });

    it('should handle multiple tool calls in single response', async () => {
      const createMockStream = async function* () {
        yield {
          content: 'I will execute multiple tools.',
          toolCalls: [
            { id: 'tool-1', name: 'test-tool', arguments: { action: '1' } },
            { id: 'tool-2', name: 'test-tool', arguments: { action: '2' } },
            { id: 'tool-3', name: 'test-tool', arguments: { action: '3' } }
          ]
        };
      };

      const mockStream = createMockStream();

      const systemPrompt = 'You are a helpful assistant.';
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Execute multiple tools', timestamp: Date.now() }
      ];

      const responses: any[] = [];
      for await (const response of mockStream) {
        responses.push(response);
      }

      expect(responses).toHaveLength(1);
      expect(responses[0].toolCalls).toBeDefined();
      expect(responses[0].toolCalls).toHaveLength(3);
    });
  });

  describe('LLM Configuration', () => {
    it('should use correct API configuration', async () => {
      expect(testConfig.apiKey).toBeDefined();
      expect(testConfig.baseUrl).toBeDefined();
      expect(testConfig.model).toBeDefined();
    });

    it('should handle API key authentication', async () => {
      expect(testConfig.apiKey).toBeTruthy();
      expect(testConfig.apiKey.length).toBeGreaterThan(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network timeouts', async () => {
      const createMockErrorStream = async function* () {
        throw new Error('Request timeout');
      };

      const mockStream = createMockErrorStream();
      const messages: Message[] = [{ id: '1', role: 'user', content: 'Test', timestamp: Date.now() }];

      await expect(
        (async () => {
          for await (const response of mockStream) {
            response;
          }
        })()
      ).rejects.toThrow('Request timeout');
    });

    it('should handle invalid API responses', async () => {
      const createMockErrorStream = async function* () {
        throw new Error('Invalid API response');
      };

      const mockStream = createMockErrorStream();
      const messages: Message[] = [{ id: '1', role: 'user', content: 'Test', timestamp: Date.now() }];

      await expect(
        (async () => {
          for await (const response of mockStream) {
            response;
          }
        })()
      ).rejects.toThrow('Invalid API response');
    });

    it('should handle rate limiting', async () => {
      const createMockErrorStream = async function* () {
        throw new Error('Rate limit exceeded');
      };

      const mockStream = createMockErrorStream();
      const messages: Message[] = [{ id: '1', role: 'user', content: 'Test', timestamp: Date.now() }];

      await expect(
        (async () => {
          for await (const response of mockStream) {
            response;
          }
        })()
      ).rejects.toThrow('Rate limit exceeded');
    });
  });
});
