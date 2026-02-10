import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamChat } from '../../src/llm.js'
import { createTestConfig, createTestMessage } from '../helpers/factories.js'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  generateObject: vi.fn(),
  generateStructure: vi.fn()
}))

describe('LLM Integration Tests', () => {
  let testConfig: any

  beforeEach(() => {
    testConfig = createTestConfig()
    vi.clearAllMocks()
  })

  describe('streamChat', () => {
    it('should handle streaming responses correctly', async () => {
      // Mock the AI SDK streamText function
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Hello'
          yield ' '
          yield 'world'
          yield '!'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const systemPrompt = 'You are a helpful assistant.'
      const messages = [
        { role: 'user' as const, content: 'Say hello' }
      ]

      const stream = streamChat(messages, testConfig, systemPrompt)
      const responses = []

      for await (const response of stream) {
        responses.push(response)
      }

      expect(responses).toHaveLength(4)
      expect(responses[0].content).toBe('Hello')
      expect(responses[1].content).toBe(' ')
      expect(responses[2].content).toBe('world')
      expect(responses[3].content).toBe('!')
    })

    it('should handle tool calls in streaming responses', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'I will execute a tool for you.'
        })(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'test-tool',
            args: { action: 'execute' }
          }
        ]
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const systemPrompt = 'You are a helpful assistant.'
      const messages = [
        { role: 'user' as const, content: 'Execute a tool' }
      ]

      const stream = streamChat(messages, testConfig, systemPrompt)
      const responses = []

      for await (const response of stream) {
        responses.push(response)
      }

      expect(responses).toHaveLength(1)
      expect(responses[0].content).toBe('I will execute a tool for you.')
      expect(responses[0].toolCalls).toBeDefined()
      expect(responses[0].toolCalls).toHaveLength(1)
      expect(responses[0].toolCalls![0].name).toBe('test-tool')
    })

    it('should handle empty messages array', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Hello!'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const systemPrompt = 'You are a helpful assistant.'
      const messages: any[] = []

      const stream = streamChat(messages, testConfig, systemPrompt)
      const responses = []

      for await (const response of stream) {
        responses.push(response)
      }

      expect(responses).toHaveLength(1)
      expect(responses[0].content).toBe('Hello!')
    })

    it('should handle different model configurations', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Response from custom model'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const customConfig = createTestConfig({
        model: 'custom-model-name',
        baseUrl: 'https://custom-api.example.com'
      })

      const systemPrompt = 'You are a helpful assistant.'
      const messages = [
        { role: 'user' as const, content: 'Test custom model' }
      ]

      await streamChat(messages, customConfig, systemPrompt)

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'custom-model-name'
        })
      )
    })

    it('should handle streaming errors gracefully', async () => {
      const { streamText } = require('ai')
      
      vi.mocked(streamText).mockRejectedValue(new Error('API error'))

      const systemPrompt = 'You are a helpful assistant.'
      const messages = [
        { role: 'user' as const, content: 'Test error handling' }
      ]

      const stream = streamChat(messages, testConfig, systemPrompt)

      await expect(async () => {
        for await (const response of stream) {
          // This should throw an error
        }
      }).rejects.toThrow('API error')
    })

    it('should preserve message roles correctly', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Response to conversation'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const systemPrompt = 'You are a helpful assistant.'
      const messages = [
        { role: 'system' as const, content: 'System instruction' },
        { role: 'user' as const, content: 'User question' },
        { role: 'assistant' as const, content: 'Previous assistant response' },
        { role: 'user' as const, content: 'Follow-up question' }
      ]

      await streamChat(messages, testConfig, systemPrompt)

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
            expect.objectContaining({ role: 'assistant' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      )
    })

    it('should handle large context efficiently', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Response to large context'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      // Create a large conversation
      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        ...Array(100).fill(0).map((_, i) => ({
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `This is message number ${i} with substantial content to simulate a large conversation context. `.repeat(5)
        }))
      ]

      const startTime = Date.now()
      
      await streamChat(messages, testConfig, 'You are a helpful assistant.')
      
      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Should handle large context efficiently
      expect(processingTime).toBeLessThan(1000)
    })

    it('should handle multiple tool calls in single response', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'I will execute multiple tools for you.'
        })(),
        toolCalls: [
          {
            id: 'tool-1',
            name: 'read-file',
            args: { path: 'file1.txt' }
          },
          {
            id: 'tool-2',
            name: 'write-file',
            args: { path: 'file2.txt', content: 'New content' }
          },
          {
            id: 'tool-3',
            name: 'bash',
            args: { command: 'ls -la' }
          }
        ]
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const systemPrompt = 'You are a helpful assistant.'
      const messages = [
        { role: 'user' as const, content: 'Execute multiple tools' }
      ]

      const stream = streamChat(messages, testConfig, systemPrompt)
      const responses = []

      for await (const response of stream) {
        responses.push(response)
      }

      expect(responses).toHaveLength(1)
      expect(responses[0].toolCalls).toHaveLength(3)
      expect(responses[0].toolCalls![0].name).toBe('read-file')
      expect(responses[0].toolCalls![1].name).toBe('write-file')
      expect(responses[0].toolCalls![2].name).toBe('bash')
    })
  })

  describe('LLM Configuration', () => {
    it('should use correct API configuration', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Test response'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const customConfig = createTestConfig({
        baseUrl: 'https://custom-api.example.com/v1',
        model: 'custom-gpt-model'
      })

      await streamChat(
        [{ role: 'user' as const, content: 'Test' }],
        customConfig,
        'System prompt'
      )

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'custom-gpt-model'
        })
      )
    })

    it('should handle API key authentication', async () => {
      const { streamText } = require('ai')
      const mockStream = {
        textStream: (async function* () {
          yield 'Authenticated response'
        })(),
        toolCalls: undefined
      }
      
      vi.mocked(streamText).mockResolvedValue(mockStream)

      const configWithKey = createTestConfig({
        apiKey: 'test-api-key-12345'
      })

      await streamChat(
        [{ role: 'user' as const, content: 'Test auth' }],
        configWithKey,
        'System prompt'
      )

      // The actual API key handling should be done by the AI SDK
      expect(streamText).toHaveBeenCalled()
    })
  })

  describe('Error Scenarios', () => {
    it('should handle network timeouts', async () => {
      const { streamText } = require('ai')
      
      vi.mocked(streamText).mockRejectedValue(new Error('Request timeout'))

      await expect(
        async () => {
          for await (const response of streamChat(
            [{ role: 'user' as const, content: 'Test' }],
            testConfig,
            'System prompt'
          )) {
            // Should timeout
          }
        }
      ).rejects.toThrow('Request timeout')
    })

    it('should handle invalid API responses', async () => {
      const { streamText } = require('ai')
      
      vi.mocked(streamText).mockRejectedValue(new Error('Invalid API response'))

      await expect(
        async () => {
          for await (const response of streamChat(
            [{ role: 'user' as const, content: 'Test' }],
            testConfig,
            'System prompt'
          )) {
            // Should fail
          }
        }
      ).rejects.toThrow('Invalid API response')
    })

    it('should handle rate limiting', async () => {
      const { streamText } = require('ai')
      
      vi.mocked(streamText).mockRejectedValue(new Error('Rate limit exceeded'))

      await expect(
        async () => {
          for await (const response of streamChat(
            [{ role: 'user' as const, content: 'Test' }],
            testConfig,
            'System prompt'
          )) {
            // Should be rate limited
          }
        }
      ).rejects.toThrow('Rate limit exceeded')
    })
  })
})