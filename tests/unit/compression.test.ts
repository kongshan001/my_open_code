import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  CompressionManager,
  SummaryCompressionStrategy,
  SlidingWindowCompressionStrategy,
  ImportanceCompressionStrategy,
  EnhancedSummaryCompressionStrategy
} from '../../src/compression.js'
import { createTestMessage, createTestConfig, createCompressionTestScenarios } from '../helpers/factories.js'

describe('Compression Module', () => {
  let compressionManager: CompressionManager
  let testConfig: any

  beforeEach(() => {
    compressionManager = new CompressionManager()
    testConfig = createTestConfig({
      compression: {
        enabled: true,
        threshold: 75,
        strategy: 'summary',
        preserveToolHistory: true,
        preserveRecentMessages: 10,
        notifyBeforeCompression: true
      }
    })
  })

  describe('SummaryCompressionStrategy', () => {
    let strategy: SummaryCompressionStrategy

    beforeEach(() => {
      strategy = new SummaryCompressionStrategy()
    })

    it('should not compress short conversations', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Hello' }),
        createTestMessage({ role: 'assistant', content: 'Hi there!' })
      ]

      const result = await strategy.compress(messages, 10, true)

      expect(result.compressedMessages).toEqual(messages)
      expect(result.summary).toContain('No compression needed')
    })

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
      ]

      const result = await strategy.compress(messages, 10, true)

      expect(result.compressedMessages.length).toBeLessThan(messages.length)
      expect(result.compressedMessages[0].role).toBe('assistant')
      expect(result.compressedMessages[0].content).toContain('[Conversation Summary]')
      expect(result.summary).toBeTruthy()
    })

    it('should preserve tool history when requested', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Execute tool' }),
        createTestMessage({ 
          role: 'assistant', 
          content: 'Executing tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} }]
        }),
        createTestMessage({ 
          role: 'tool', 
          content: 'Tool result',
          toolResults: [{ toolCallId: 'tool-1', name: 'test-tool', output: 'Result' }]
        }),
        ...Array(20).fill(0).map((_, i) => 
          createTestMessage({ 
            role: i % 2 === 0 ? 'user' : 'assistant', 
            content: `Message ${i}` 
          })
        )
      ]

      const result = await strategy.compress(messages, 10, true)

      const toolMessages = result.compressedMessages.filter(m => 
        m.role === 'tool' || (m.role === 'assistant' && m.toolCalls)
      )
      expect(toolMessages.length).toBeGreaterThan(0)
    })
  })

  describe('SlidingWindowCompressionStrategy', () => {
    let strategy: SlidingWindowCompressionStrategy

    beforeEach(() => {
      strategy = new SlidingWindowCompressionStrategy()
    })

    it('should preserve recent messages within window size', async () => {
      const messages = Array(15).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i}`,
          timestamp: Date.now() + i * 1000
        })
      )

      const result = await strategy.compress(messages, 10, true)

      expect(result.compressedMessages.length).toBe(10)
      
      // Check that the last 10 messages are preserved
      const recentMessages = messages.slice(-10)
      expect(result.compressedMessages).toEqual(expect.arrayContaining(recentMessages))
    })

    it('should preserve tool history when requested', async () => {
      const messages = [
        createTestMessage({ 
          role: 'assistant', 
          content: 'Using tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} }]
        }),
        ...Array(15).fill(0).map((_, i) => 
          createTestMessage({ 
            role: i % 2 === 0 ? 'user' : 'assistant', 
            content: `Message ${i}` 
          })
        )
      ]

      const result = await strategy.compress(messages, 10, true)

      const toolMessages = result.compressedMessages.filter(m => 
        m.role === 'assistant' && m.toolCalls
      )
      expect(toolMessages.length).toBe(1)
    })

    it('should return appropriate summary', async () => {
      const messages = Array(15).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i}` 
        })
      )

      const result = await strategy.compress(messages, 10, true)

      expect(result.summary).toContain('Sliding window compression')
      expect(result.summary).toContain('removed')
      expect(result.summary).toContain('10 recent messages')
    })
  })

  describe('ImportanceCompressionStrategy', () => {
    let strategy: ImportanceCompressionStrategy

    beforeEach(() => {
      strategy = new ImportanceCompressionStrategy()
    })

    it('should prioritize tool-related messages', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Simple question' }),
        createTestMessage({ 
          role: 'assistant', 
          content: 'Using important tool',
          toolCalls: [{ id: 'tool-1', name: 'important-tool', arguments: {} }]
        }),
        createTestMessage({ 
          role: 'tool', 
          content: 'Important tool result' 
        }),
        createTestMessage({ role: 'user', content: 'Another simple question' }),
        createTestMessage({ role: 'assistant', content: 'Simple answer' })
      ]

      const result = await strategy.compress(messages, 2, true)

      const toolMessages = result.compressedMessages.filter(m => 
        m.role === 'tool' || (m.role === 'assistant' && m.toolCalls)
      )
      expect(toolMessages.length).toBe(2)
    })

    it('should prioritize user messages', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Important user question 1' }),
        createTestMessage({ role: 'assistant', content: 'Answer 1' }),
        createTestMessage({ role: 'user', content: 'Important user question 2' }),
        createTestMessage({ role: 'assistant', content: 'Answer 2' }),
        createTestMessage({ role: 'user', content: 'Important user question 3' })
      ]

      const result = await strategy.compress(messages, 2, true)

      const userMessages = result.compressedMessages.filter(m => m.role === 'user')
      expect(userMessages.length).toBeGreaterThanOrEqual(2)
    })

    it('should preserve recent messages', async () => {
      const messages = Array(10).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i}`,
          timestamp: Date.now() + i * 1000
        })
      )

      const result = await strategy.compress(messages, 5, true)

      // Check that all recent messages are preserved
      const recentMessages = messages.slice(-5)
      recentMessages.forEach(msg => {
        expect(result.compressedMessages).toContainEqual(msg)
      })
    })
  })

  describe('EnhancedSummaryCompressionStrategy', () => {
    let strategy: EnhancedSummaryCompressionStrategy

    beforeEach(() => {
      strategy = new EnhancedSummaryCompressionStrategy()
    })

    it('should generate comprehensive summary with statistics', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Help me with code' }),
        createTestMessage({ role: 'assistant', content: 'Here is some code ```javascript console.log("test"); ```' }),
        createTestMessage({ role: 'user', content: 'I got an error' }),
        createTestMessage({ 
          role: 'assistant', 
          content: 'Let me help',
          toolCalls: [{ id: 'tool-1', name: 'debug-tool', arguments: {} }]
        })
      ]

      const result = await strategy.compress(messages, 2, true)

      expect(result.summary).toContain('📊 **Statistics:**')
      expect(result.summary).toContain('User queries: 2')
      expect(result.summary).toContain('Assistant responses: 2')
      expect(result.summary).toContain('Tool executions: 1')
      expect(result.summary).toContain('💻 **Code Context:**')
      expect(result.summary).toContain('⚠️ **Errors Encountered:**')
      expect(result.summary).toContain('🔧 **Tools Used:**')
    })

    it('should extract topics correctly', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Can you implement a new feature?' }),
        createTestMessage({ role: 'assistant', content: 'I can help implement that' }),
        createTestMessage({ role: 'user', content: 'Let me test this implementation' }),
        createTestMessage({ role: 'user', content: 'Can you fix this bug?' })
      ]

      const result = await strategy.compress(messages, 1, true)

      expect(result.summary).toContain('🏷️ **Main Topics:**')
      expect(result.summary).toContain('implement')
      expect(result.summary).toContain('test')
    })

    it('should handle empty conversations gracefully', async () => {
      const messages: any[] = []

      const result = await strategy.compress(messages, 10, true)

      expect(result.compressedMessages).toEqual([])
      expect(result.summary).toContain('No compression needed')
    })
  })

  describe('CompressionManager', () => {
    it('should not compress when usage is below threshold', async () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Hello' }),
        createTestMessage({ role: 'assistant', content: 'Hi!' })
      ]

      const result = await compressionManager.compress(messages, testConfig.compression, 'glm-4.7')

      expect(result.compressed).toBe(false)
      expect(result.strategy).toBe('none')
      expect(result.reductionPercentage).toBe(0)
      expect(result.message).toContain('below threshold')
    })

    it('should compress when usage is above threshold', async () => {
      const messages = Array(50).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `This is a longer message ${i} with more content to ensure we have enough tokens to trigger compression in our test scenario.` 
        })
      )

      const result = await compressionManager.compress(messages, testConfig.compression, 'test-tiny-model')

      expect(result.compressed).toBe(true)
      expect(result.strategy).toBe('summary')
      expect(result.reductionPercentage).toBeGreaterThan(0)
      expect(result.compressedMessages).toBeDefined()
    })

    it('should use the correct strategy based on config', async () => {
      const slidingWindowConfig = {
        ...testConfig.compression,
        strategy: 'sliding-window' as const
      }
      
      const messages = Array(30).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i}` 
        })
      )

      const result = await compressionManager.compress(messages, slidingWindowConfig, 'test-tiny-model')

      expect(result.strategy).toBe('sliding-window')
      expect(result.compressed).toBe(true)
    })

    it('should handle importance strategy', async () => {
      const importanceConfig = {
        ...testConfig.compression,
        strategy: 'importance' as const
      }
      
      const messages = Array(30).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i}` 
        })
      )

      const result = await compressionManager.compress(messages, importanceConfig, 'test-tiny-model')

      expect(result.strategy).toBe('importance')
      expect(result.compressed).toBe(true)
    })

    it('should throw error for unknown strategy', async () => {
      const invalidConfig = {
        ...testConfig.compression,
        strategy: 'unknown' as any
      }
      
      const messages = [createTestMessage()]

      await expect(
        compressionManager.compress(messages, invalidConfig, 'glm-4.7')
      ).rejects.toThrow('Unknown compression strategy: unknown')
    })

    it('should provide compression preview', async () => {
      const messages = Array(30).fill(0).map((_, i) => 
        createTestMessage({ 
          role: i % 2 === 0 ? 'user' : 'assistant', 
          content: `Message ${i}` 
        })
      )

      const result = await compressionManager.previewCompression(messages, testConfig.compression, 'test-tiny-model')

      expect(result.preview).toBe(true)
      expect(result.compressed).toBeDefined()
      expect(result.compressedMessages).toBeDefined()
    })

    it('should provide compression statistics', () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'User message' }),
        createTestMessage({ role: 'assistant', content: 'Assistant response ```console.log("test");```' }),
        createTestMessage({ 
          role: 'assistant', 
          content: 'Using tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} }]
        }),
        createTestMessage({ 
          role: 'tool', 
          content: 'Tool result with Error: something went wrong' 
        })
      ]

      const stats = compressionManager.getCompressionStats(messages)

      expect(stats.totalMessages).toBe(4)
      expect(stats.userMessages).toBe(1)
      expect(stats.assistantMessages).toBe(2)
      expect(stats.toolMessages).toBe(1)
      expect(stats.codeBlocks).toBe(1)
      expect(stats.errors).toBe(1)
      expect(stats.estimatedTokens).toBeGreaterThan(0)
    })
  })

  describe('Compression Integration Tests', () => {
    it('should handle different scenarios correctly', async () => {
      const scenarios = createCompressionTestScenarios()
      
      for (const [name, session] of Object.entries(scenarios)) {
        const result = await compressionManager.compress(
          session.messages, 
          testConfig.compression, 
          'test-tiny-model'
        )
        
        expect(result).toBeDefined()
        expect(result.strategy).toBe('summary')
        expect(typeof result.compressed).toBe('boolean')
        expect(typeof result.originalTokenCount).toBe('number')
        expect(typeof result.compressedTokenCount).toBe('number')
        expect(typeof result.reductionPercentage).toBe('number')
        expect(result.message).toBeTruthy()
      }
    })
  })
})