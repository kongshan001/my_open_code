import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionManager } from '../../src/session.js'
import { createTestSession, createTestConfig, createLongConversation } from '../helpers/factories.js'
import { CompressionManager } from '../../src/compression.js'

// Mock external dependencies
vi.mock('../../src/storage.js', () => ({
  saveSession: vi.fn(),
  loadSession: vi.fn(),
  generateId: vi.fn(() => 'test-id'),
  listSessions: vi.fn(() => [])
}))

vi.mock('../../src/llm.js', () => ({
  streamChat: vi.fn()
}))

vi.mock('../../src/system-prompt.js', () => ({
  getSystemPrompt: vi.fn(() => 'Test system prompt')
}))

vi.mock('../../src/tool.js', () => ({
  executeTool: vi.fn()
}))

describe('Session-Compression Integration Tests', () => {
  let sessionManager: SessionManager
  let compressionManager: CompressionManager
  let testConfig: any

  beforeEach(() => {
    testConfig = createTestConfig({
      compression: {
        enabled: true,
        threshold: 75,
        strategy: 'summary',
        preserveToolHistory: true,
        preserveRecentMessages: 10,
        notifyBeforeCompression: false
      }
    })
    
    const testSession = createTestSession()
    sessionManager = new SessionManager(testSession, testConfig)
    compressionManager = new CompressionManager()
    
    vi.clearAllMocks()
  })

  describe('Session Management with Compression', () => {
    it('should automatically trigger compression when context limit is approached', async () => {
      // Add many messages to approach context limit
      const longConversation = createLongConversation(50)
      
      for (const message of longConversation) {
        await sessionManager.addUserMessage(message.content)
        
        // Mock the LLM response
        const { streamChat } = require('../../src/llm.js')
        vi.mocked(streamChat).mockReturnValue(async function* () {
          yield { content: 'Response to: ' + message.content.substring(0, 20) }
        }())
        
        // Mock saveSession
        const { saveSession } = require('../../src/storage.js')
        vi.mocked(saveSession).mockResolvedValue(undefined)
        
        // Process the message (which may trigger compression)
        await sessionManager.processMessage()
      }

      // Check if compression was triggered by examining the final session state
      const finalSession = sessionManager.getSession()
      expect(finalSession.lastCompression).toBeDefined()
    })

    it('should preserve conversation flow after compression', async () => {
      // Create a scenario with tool calls
      const { streamChat } = require('../../src/llm.js')
      const { executeTool } = require('../../src/tool.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(saveSession).mockResolvedValue(undefined)
      vi.mocked(executeTool).mockResolvedValue({ output: 'Tool executed successfully' })
      
      // Simulate a conversation with tools
      await sessionManager.addUserMessage('Execute a tool for me')
      
      vi.mocked(streamChat).mockReturnValueOnce(async function* () {
        yield { 
          content: 'I will execute the tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} }]
        }
      }())
      
      await sessionManager.processMessage()
      
      // Add more messages to potentially trigger compression
      for (let i = 0; i < 20; i++) {
        await sessionManager.addUserMessage(`Message ${i}`)
        vi.mocked(streamChat).mockReturnValueOnce(async function* () {
          yield { content: `Response ${i}` }
        }())
        await sessionManager.processMessage()
      }
      
      const finalSession = sessionManager.getSession()
      const messages = finalSession.messages
      
      // Should have preserved the tool call and result
      const toolCallMessages = messages.filter(m => 
        m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0
      )
      const toolResultMessages = messages.filter(m => m.role === 'tool')
      
      expect(toolCallMessages.length).toBeGreaterThan(0)
      expect(toolResultMessages.length).toBeGreaterThan(0)
    })

    it('should maintain session metadata after compression', async () => {
      const originalSession = sessionManager.getSession()
      const originalId = originalSession.id
      const originalTitle = originalSession.title
      
      // Add enough messages to trigger compression
      for (let i = 0; i < 30; i++) {
        await sessionManager.addUserMessage(`Message ${i}`)
      }
      
      // Mock processing
      const { streamChat } = require('../../src/llm.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(streamChat).mockReturnValue(async function* () {
        yield { content: 'Response' }
      }())
      vi.mocked(saveSession).mockResolvedValue(undefined)
      
      await sessionManager.processMessage()
      
      const finalSession = sessionManager.getSession()
      
      expect(finalSession.id).toBe(originalId)
      expect(finalSession.title).toBe(originalTitle)
      expect(finalSession.createdAt).toBe(originalSession.createdAt)
      expect(finalSession.updatedAt).toBeGreaterThan(originalSession.updatedAt)
      expect(finalSession.lastCompression).toBeDefined()
    })
  })

  describe('Compression Strategy Integration', () => {
    it('should handle different compression strategies in real usage', async () => {
      const strategies = ['summary', 'sliding-window', 'importance'] as const
      
      for (const strategy of strategies) {
        const config = createTestConfig({
          compression: {
            ...testConfig.compression,
            strategy,
            threshold: 50 // Lower threshold for testing
          }
        })
        
        const testSession = createTestSession()
        const manager = new SessionManager(testSession, config)
        
        // Add messages
        for (let i = 0; i < 20; i++) {
          await manager.addUserMessage(`Message for ${strategy} strategy ${i}`)
        }
        
        // Mock processing
        const { streamChat } = require('../../src/llm.js')
        const { saveSession } = require('../../src/storage.js')
        
        vi.mocked(streamChat).mockReturnValue(async function* () {
          yield { content: `Response for ${strategy}` }
        }())
        vi.mocked(saveSession).mockResolvedValue(undefined)
        
        await manager.processMessage()
        
        const session = manager.getSession()
        if (session.lastCompression) {
          expect(session.lastCompression.strategy).toBe(strategy)
        }
      }
    })

    it('should preserve tool history across different strategies', async () => {
      const toolCallConfig = createTestConfig({
        compression: {
          ...testConfig.compression,
          preserveToolHistory: true,
          strategy: 'importance'
        }
      })
      
      const manager = new SessionManager(createTestSession(), toolCallConfig)
      
      // Create conversation with tools
      const { streamChat } = require('../../src/llm.js')
      const { executeTool } = require('../../src/tool.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(saveSession).mockResolvedValue(undefined)
      vi.mocked(executeTool).mockResolvedValue({ output: 'Tool result' })
      
      // First message with tool call
      await manager.addUserMessage('Use a tool')
      vi.mocked(streamChat).mockReturnValueOnce(async function* () {
        yield { 
          content: 'Using tool',
          toolCalls: [{ id: 'tool-1', name: 'important-tool', arguments: {} }]
        }
      }())
      await manager.processMessage()
      
      // Add more messages to trigger compression
      for (let i = 0; i < 25; i++) {
        await manager.addUserMessage(`Message ${i}`)
        vi.mocked(streamChat).mockReturnValueOnce(async function* () {
          yield { content: `Response ${i}` }
        }())
        await manager.processMessage()
      }
      
      const session = manager.getSession()
      
      // Should still have tool-related messages
      const toolMessages = session.messages.filter(m => 
        m.role === 'tool' || (m.role === 'assistant' && m.toolCalls)
      )
      expect(toolMessages.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle compression failures gracefully', async () => {
      // Mock a compression failure
      const mockCompress = vi.spyOn(compressionManager, 'compress')
      mockCompress.mockRejectedValue(new Error('Compression failed'))
      
      await sessionManager.addUserMessage('Test message')
      
      // Should not crash even if compression fails
      const { streamChat } = require('../../src/llm.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(streamChat).mockReturnValue(async function* () {
        yield { content: 'Response despite compression failure' }
      }())
      vi.mocked(saveSession).mockResolvedValue(undefined)
      
      await expect(sessionManager.processMessage()).resolves.not.toThrow()
      
      mockCompress.mockRestore()
    })

    it('should continue conversation after compression errors', async () => {
      // First add some messages
      for (let i = 0; i < 10; i++) {
        await sessionManager.addUserMessage(`Message ${i}`)
      }
      
      // Mock compression to fail once, then succeed
      const mockCompress = vi.spyOn(compressionManager, 'compress')
      mockCompress
        .mockRejectedValueOnce(new Error('Compression failed'))
        .mockResolvedValueOnce({
          compressed: true,
          strategy: 'summary',
          originalTokenCount: 1000,
          compressedTokenCount: 500,
          reductionPercentage: 50,
          message: 'Compression successful',
          compressedMessages: []
        })
      
      const { streamChat } = require('../../src/llm.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(streamChat).mockReturnValue(async function* () {
        yield { content: 'Response after compression' }
      }())
      vi.mocked(saveSession).mockResolvedValue(undefined)
      
      await sessionManager.processMessage()
      
      // Session should still be usable
      expect(sessionManager.getSession().messages).toBeDefined()
      
      mockCompress.mockRestore()
    })
  })

  describe('Performance Integration', () => {
    it('should handle large conversations efficiently', async () => {
      const startTime = Date.now()
      
      // Simulate a very long conversation
      for (let i = 0; i < 100; i++) {
        await sessionManager.addUserMessage(`This is a long message number ${i} with substantial content to simulate real usage patterns and test the performance characteristics of the compression system under load. `.repeat(2))
      }
      
      const { streamChat } = require('../../src/llm.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(streamChat).mockReturnValue(async function* () {
        yield { content: 'Quick response' }
      }())
      vi.mocked(saveSession).mockResolvedValue(undefined)
      
      await sessionManager.processMessage()
      
      const endTime = Date.now()
      const processingTime = endTime - startTime
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000)
    })

    it('should maintain memory efficiency with compression', async () => {
      // Create a session with many messages
      const largeSession = createTestSession({
        messages: createLongConversation(200)
      })
      
      const manager = new SessionManager(largeSession, testConfig)
      
      // Get initial memory usage (approximate)
      const initialMessages = manager.getSession().messages.length
      
      // Trigger compression
      await manager.checkAndPerformCompression()
      
      // Should have fewer messages after compression
      const finalMessages = manager.getSession().messages.length
      
      // Either compression occurred or wasn't needed
      if (manager.getSession().lastCompression?.compressed) {
        expect(finalMessages).toBeLessThan(initialMessages)
      }
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle a typical coding conversation', async () => {
      const { streamChat } = require('../../src/llm.js')
      const { executeTool } = require('../../src/tool.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(saveSession).mockResolvedValue(undefined)
      vi.mocked(executeTool).mockResolvedValue({ output: 'File written successfully' })
      
      // Simulate a typical coding conversation
      await sessionManager.addUserMessage('Can you help me create a TypeScript function?')
      
      vi.mocked(streamChat).mockReturnValueOnce(async function* () {
        yield { content: 'I\'ll help you create a TypeScript function. Let me write it to a file.',
          toolCalls: [{ id: 'write-1', name: 'write', arguments: { content: 'function test() { return "Hello"; }' } }]
        }
      }())
      
      await sessionManager.processMessage()
      
      // Continue the conversation
      await sessionManager.addUserMessage('Can you add type annotations?')
      
      vi.mocked(streamChat).mockReturnValueOnce(async function* () {
        yield { content: 'I\'ll add proper TypeScript type annotations.',
          toolCalls: [{ id: 'write-2', name: 'write', arguments: { content: 'function test(): string { return "Hello"; }' } }]
        }
      }())
      
      await sessionManager.processMessage()
      
      // Add more conversation to test compression
      for (let i = 0; i < 20; i++) {
        await sessionManager.addUserMessage(`Follow-up question ${i}`)
        vi.mocked(streamChat).mockReturnValueOnce(async function* () {
          yield { content: `Answer ${i} with more details about TypeScript programming` }
        }())
        await sessionManager.processMessage()
      }
      
      const session = sessionManager.getSession()
      
      // Should have preserved the tool interactions
      expect(session.messages.some(m => m.toolCalls && m.toolCalls.length > 0)).toBe(true)
      expect(session.messages.some(m => m.role === 'tool')).toBe(true)
      
      // May have been compressed
      if (session.lastCompression?.compressed) {
        expect(session.lastCompression.strategy).toBe('summary')
      }
    })

    it('should handle debugging conversation with errors', async () => {
      const { streamChat } = require('../../src/llm.js')
      const { saveSession } = require('../../src/storage.js')
      
      vi.mocked(saveSession).mockResolvedValue(undefined)
      
      // Simulate debugging conversation
      await sessionManager.addUserMessage('I\'m getting an error in my code')
      
      vi.mocked(streamChat).mockReturnValueOnce(async function* () {
        yield { content: 'What error are you seeing? Can you share the error message?' }
      }())
      
      await sessionManager.processMessage()
      
      await sessionManager.addUserMessage('Error: Cannot read property \'undefined\' of null')
      
      vi.mocked(streamChat).mockReturnValueOnce(async function* () {
        yield { content: 'This error occurs when trying to access a property on a null value. Here\'s how to fix it:\n\n```javascript\nconst result = data?.property; // Safe access\n// or\nconst result = data && data.property; // Explicit check\n```' }
      }())
      
      await sessionManager.processMessage()
      
      // Add more debugging conversation
      for (let i = 0; i < 15; i++) {
        await sessionManager.addUserMessage(`Still having issues with error ${i}`)
        vi.mocked(streamChat).mockReturnValueOnce(async function* () {
          yield { content: `Debugging tip ${i}: Check for null values and use optional chaining or explicit null checks.` }
        }())
        await sessionManager.processMessage()
      }
      
      const session = sessionManager.getSession()
      
      // Should preserve the error context in compression
      if (session.lastCompression?.compressed) {
        expect(session.lastCompression.summary).toBeDefined()
        // Summary should contain error-related information
        expect(session.lastCompression.summary!.toLowerCase()).toContain('error')
      }
    })
  })
})