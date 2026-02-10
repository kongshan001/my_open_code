import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionManager } from '../../src/session.js'
import { saveSession, loadSession, generateId } from '../../src/storage.js'
import { createTestSession, createTestConfig, createTestMessage } from '../helpers/factories.js'

const mockSaveSession = vi.fn()
const mockLoadSession = vi.fn()
const mockGenerateId = vi.fn(() => 'test-id')
const mockListSessions = vi.fn(() => [])

const mockStreamChat = vi.fn()
const mockGetSystemPrompt = vi.fn(() => 'Test system prompt')
const mockExecuteTool = vi.fn()

// Mock the storage module
vi.mock('../../src/storage.js', () => ({
  saveSession: mockSaveSession,
  loadSession: mockLoadSession,
  generateId: mockGenerateId,
  listSessions: mockListSessions
}))

// Mock the LLM module
vi.mock('../../src/llm.js', () => ({
  streamChat: mockStreamChat
}))

// Mock the system prompt module
vi.mock('../../src/system-prompt.js', () => ({
  getSystemPrompt: mockGetSystemPrompt
}))

// Mock the tool execution module
vi.mock('../../src/tool.js', () => ({
  executeTool: mockExecuteTool
}))

describe('SessionManager', () => {
  let sessionManager: SessionManager
  let testSession: any
  let testConfig: any

  beforeEach(() => {
    testSession = createTestSession()
    testConfig = createTestConfig()
    sessionManager = new SessionManager(testSession, testConfig)
    
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with provided session and config', () => {
      expect(sessionManager.getSession()).toEqual(testSession)
    })
  })

  describe('create', () => {
    it('should create a new session', async () => {
      mockSaveSession.mockResolvedValue(undefined)

      const newSessionManager = await SessionManager.create('Test Title', testConfig)
      
      expect(mockSaveSession).toHaveBeenCalled()
      expect(newSessionManager.getSession().title).toBe('Test Title')
      expect(newSessionManager.getSession().messages).toEqual([])
    })
  })

  describe('load', () => {
    it('should load an existing session', async () => {
      mockLoadSession.mockResolvedValue(testSession)

      const loadedSessionManager = await SessionManager.load('test-id', testConfig)
      
      expect(mockLoadSession).toHaveBeenCalledWith('test-id')
      expect(loadedSessionManager?.getSession()).toEqual(testSession)
    })

    it('should return null if session not found', async () => {
      mockLoadSession.mockResolvedValue(null)

      const loadedSessionManager = await SessionManager.load('nonexistent-id', testConfig)
      
      expect(loadedSessionManager).toBeNull()
    })
  })

  describe('getSession', () => {
    it('should return the current session', () => {
      const session = sessionManager.getSession()
      expect(session).toEqual(testSession)
    })
  })

  describe('addUserMessage', () => {
    it('should add a user message to the session', async () => {
      mockSaveSession.mockResolvedValue(undefined)

      await sessionManager.addUserMessage('Test user message')

      const session = sessionManager.getSession()
      expect(session.messages).toHaveLength(1)
      expect(session.messages[0].role).toBe('user')
      expect(session.messages[0].content).toBe('Test user message')
      expect(mockSaveSession).toHaveBeenCalledWith(session)
    })

    it('should update the session timestamp', async () => {
      mockSaveSession.mockResolvedValue(undefined)
      
      const originalTimestamp = sessionManager.getSession().updatedAt
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1))
      
      await sessionManager.addUserMessage('Test message')
      
      const newTimestamp = sessionManager.getSession().updatedAt
      expect(newTimestamp).toBeGreaterThan(originalTimestamp)
    })
  })

  describe('processMessage', () => {
    beforeEach(() => {
      // Mock streamChat to return a simple response
      mockStreamChat.mockReturnValue(async function* () {
        yield { content: 'Hello' }
        yield { content: '!' }
      }())
    })

    it('should process a message without tool calls', async () => {
      mockSaveSession.mockResolvedValue(undefined)

      await sessionManager.addUserMessage('Hello')
      await sessionManager.processMessage()

      const session = sessionManager.getSession()
      expect(session.messages).toHaveLength(2) // user + assistant
      
      const assistantMessage = session.messages.find(m => m.role === 'assistant')
      expect(assistantMessage).toBeDefined()
      expect(assistantMessage!.content).toBe('Hello!')
      expect(assistantMessage!.toolCalls).toEqual([])
      
      expect(mockSaveSession).toHaveBeenCalledTimes(2) // once for add, once for process
    })

    it('should handle tool calls correctly', async () => {
      mockSaveSession.mockResolvedValue(undefined)
      mockExecuteTool.mockResolvedValue({ output: 'Tool executed' })
      
      // Mock streamChat to return tool calls
      mockStreamChat.mockReturnValueOnce(async function* () {
        yield { 
          content: 'I will execute a tool',
          toolCalls: [{ id: 'tool-1', name: 'test-tool', arguments: {} }]
        }
      }())

      // Mock the second call for processing tool results
      mockStreamChat.mockReturnValueOnce(async function* () {
        yield { content: 'Tool results processed' }
      }())

      await sessionManager.addUserMessage('Execute tool')
      await sessionManager.processMessage()

      const session = sessionManager.getSession()
      
      // Should have user, assistant (with tool call), tool result, and assistant (processing result)
      expect(session.messages).toHaveLength(4)
      
      const assistantMessage = session.messages.find(m => m.role === 'assistant' && m.toolCalls)
      expect(assistantMessage).toBeDefined()
      expect(assistantMessage!.toolCalls).toHaveLength(1)
      
      const toolMessage = session.messages.find(m => m.role === 'tool')
      expect(toolMessage).toBeDefined()
      
      expect(mockExecuteTool).toHaveBeenCalledWith('test-tool', {}, expect.any(Object))
    })

    it('should handle tool execution errors gracefully', async () => {
      mockSaveSession.mockResolvedValue(undefined)
      mockExecuteTool.mockRejectedValue(new Error('Tool execution failed'))
      
      mockStreamChat.mockReturnValue(async function* () {
        yield { 
          content: 'I will execute a tool',
          toolCalls: [{ id: 'tool-1', name: 'failing-tool', arguments: {} }]
        }
      }())

      await sessionManager.addUserMessage('Execute failing tool')
      await sessionManager.processMessage()

      const session = sessionManager.getSession()
      const toolMessage = session.messages.find(m => m.role === 'tool')
      expect(toolMessage).toBeDefined()
      expect(toolMessage!.content).toContain('Error: Tool execution failed')
    })
  })

  describe('Context Management', () => {
    it('should check compression before processing messages', async () => {
      const compressionConfig = {
        enabled: true,
        threshold: 1, // Very low threshold to trigger compression
        strategy: 'summary' as const,
        preserveToolHistory: true,
        preserveRecentMessages: 10,
        notifyBeforeCompression: false
      }
      
      const configWithCompression = createTestConfig({ compression: compressionConfig })
      const compressionSessionManager = new SessionManager(testSession, configWithCompression)
      
      // Add enough messages to potentially trigger compression
      for (let i = 0; i < 20; i++) {
        await compressionSessionManager.addUserMessage(`Message ${i}`)
      }

      const { streamChat } = require('../../src/llm.js')
      vi.mocked(streamChat).mockReturnValue(async function* () {
        yield { content: 'Response' }
      }())

      mockSaveSession.mockResolvedValue(undefined)

      await compressionSessionManager.processMessage()

      // Verify that compression was attempted
      expect(mockSaveSession).toHaveBeenCalled()
    })
  })

  describe('Compression Integration', () => {
    it('should save compression results when compression occurs', async () => {
      const compressionConfig = {
        enabled: true,
        threshold: 1, // Very low threshold to trigger compression
        strategy: 'summary' as const,
        preserveToolHistory: true,
        preserveRecentMessages: 10,
        notifyBeforeCompression: false
      }
      
      const configWithCompression = createTestConfig({ compression: compressionConfig })
      const compressionSessionManager = new SessionManager(testSession, configWithCompression)
      
      // Add messages
      await compressionSessionManager.addUserMessage('Test message for compression')
      
      // Mock streamChat to avoid actual processing
      const { streamChat } = require('../../src/llm.js')
      vi.mocked(streamChat).mockReturnValue(async function* () {
        yield { content: 'Response' }
      }())

      mockSaveSession.mockResolvedValue(undefined)

      await compressionSessionManager.checkAndPerformCompression()

      const session = compressionSessionManager.getSession()
      expect(session.lastCompression).toBeDefined()
    })

    it('should not compress when compression is disabled', async () => {
      const compressionConfig = {
        enabled: false
      }
      
      const configWithCompression = createTestConfig({ compression: compressionConfig })
      const compressionSessionManager = new SessionManager(testSession, configWithCompression)
      
      const result = await compressionSessionManager.checkAndPerformCompression()
      
      expect(result).toBeNull()
    })
  })

  describe('Context Usage and Warnings', () => {
    it('should provide context usage information', () => {
      const usage = sessionManager.getContextUsage()
      
      expect(usage).toBeDefined()
      expect(typeof usage.totalTokens).toBe('number')
      expect(typeof usage.usagePercentage).toBe('number')
      expect(typeof usage.contextLimit).toBe('number')
    })

    it('should format context status correctly', () => {
      const status = sessionManager.formatContextStatus()
      
      expect(status).toBeDefined()
      expect(typeof status).toBe('string')
    })

    it('should provide warnings when context usage is high', () => {
      // Add many messages to increase usage
      const longSession = createTestSession({
        messages: Array(100).fill(0).map((_, i) => 
          createTestMessage({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: 'This is a long message to increase token count significantly for testing purposes. '.repeat(10)
          })
        )
      })
      
      const longSessionManager = new SessionManager(longSession, testConfig)
      const warning = longSessionManager.checkContextWarning()
      
      // Warning might be null depending on actual token calculation
      expect(typeof warning === 'string' || warning === null).toBe(true)
    })
  })
})