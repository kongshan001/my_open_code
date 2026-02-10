import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveSession, loadSession, listSessions, generateId } from '../../src/storage.js'
import { createTestSession, createTestMessage } from '../helpers/factories.js'

// Mock fs module
const mockReadFileSync = vi.fn()
const mockWriteFileSync = vi.fn()
const mockExistsSync = vi.fn()
const mockMkdirSync = vi.fn()
const mockReaddirSync = vi.fn()

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync
}))

describe('Storage Module', () => {
  const testSessionDir = './data/sessions'

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mocks
    mockExistsSync.mockReturnValue(true)
    mockMkdirSync.mockImplementation()
    mockReaddirSync.mockReturnValue([])
    mockReadFileSync.mockReturnValue('{}')
    mockWriteFileSync.mockImplementation()
  })

  describe('generateId', () => {
    it('should generate a unique ID each time', () => {
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })

    it('should generate IDs with consistent format', () => {
      const id = generateId()
      
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('saveSession', () => {
    it('should save session to file system', async () => {
      const testSession = createTestSession({
        id: 'test-session-id',
        title: 'Test Session'
      })

      mockExistsSync.mockImplementation((path: string) => {
        if (path === testSessionDir) return true
        return false
      })

      await saveSession(testSession)

      expect(mockExistsSync).toHaveBeenCalledWith(testSessionDir)
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${testSessionDir}/test-session-id.json`,
        JSON.stringify(testSession, null, 2)
      )
    })

    it('should create session directory if it does not exist', async () => {
      const testSession = createTestSession()

      mockExistsSync.mockImplementation((path: string) => {
        if (path === testSessionDir) return false
        return false
      })

      await saveSession(testSession)

      expect(mockExistsSync).toHaveBeenCalledWith(testSessionDir)
      expect(mockMkdirSync).toHaveBeenCalledWith(testSessionDir, { recursive: true })
    })

    it('should handle session with messages', async () => {
      const testSession = createTestSession({
        messages: [
          createTestMessage({ role: 'user', content: 'Hello' }),
          createTestMessage({ role: 'assistant', content: 'Hi there!' })
        ]
      })

      await saveSession(testSession)

      const expectedJson = JSON.stringify(testSession, null, 2)
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-session-id.json'),
        expectedJson
      )
    })

    it('should handle session with compression results', async () => {
      const testSession = createTestSession({
        lastCompression: {
          compressed: true,
          strategy: 'summary',
          originalTokenCount: 1000,
          compressedTokenCount: 500,
          reductionPercentage: 50,
          message: 'Compressed successfully',
          summary: 'Test summary'
        }
      })

      await saveSession(testSession)

      const expectedJson = JSON.stringify(testSession, null, 2)
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expectedJson
      )
    })
  })

  describe('loadSession', () => {
    it('should load session from file system', async () => {
      const testSession = createTestSession({
        id: 'test-load-session',
        title: 'Load Test Session'
      })

      mockReadFileSync.mockReturnValue(JSON.stringify(testSession))

      const loadedSession = await loadSession('test-load-session')

      expect(mockReadFileSync).toHaveBeenCalledWith(`${testSessionDir}/test-load-session.json`, 'utf-8')
      expect(loadedSession).toEqual(testSession)
    })

    it('should return null if session file does not exist', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found')
      })

      const loadedSession = await loadSession('nonexistent-session')

      expect(loadedSession).toBeNull()
    })

    it('should return null if JSON is invalid', async () => {
      mockReadFileSync.mockReturnValue('invalid json')

      const loadedSession = await loadSession('invalid-session')

      expect(loadedSession).toBeNull()
    })

    it('should handle session with tool calls', async () => {
      const testSession = createTestSession({
        messages: [
          createTestMessage({
            role: 'assistant',
            content: 'I will use a tool',
            toolCalls: [
              { id: 'tool-1', name: 'test-tool', arguments: { action: 'run' } }
            ]
          }),
          createTestMessage({
            role: 'tool',
            content: 'Tool result',
            toolResults: [
              { toolCallId: 'tool-1', name: 'test-tool', output: 'Success' }
            ]
          })
        ]
      })

      mockFs.readFileSync.mockReturnValue(JSON.stringify(testSession))

      const loadedSession = await loadSession('tool-session')

      expect(loadedSession).toEqual(testSession)
      expect(loadedSession!.messages[0].toolCalls).toBeDefined()
      expect(loadedSession!.messages[1].toolResults).toBeDefined()
    })
  })

  describe('listSessions', () => {
    it('should return empty array when no session files exist', async () => {
      mockReaddirSync.mockReturnValue([])

      const sessions = await listSessions()

      expect(sessions).toEqual([])
      expect(mockReaddirSync).toHaveBeenCalledWith(testSessionDir)
    })

    it('should list session files correctly', async () => {
      const sessionFiles = ['session1.json', 'session2.json', 'not-a-session.txt']
      mockReaddirSync.mockReturnValue(sessionFiles)

      const session1 = createTestSession({
        id: 'session1',
        title: 'Session 1',
        updatedAt: Date.now() - 1000
      })

      const session2 = createTestSession({
        id: 'session2',
        title: 'Session 2',
        updatedAt: Date.now()
      })

      // Mock file reading
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('session1.json')) return JSON.stringify(session1)
        if (filePath.includes('session2.json')) return JSON.stringify(session2)
        return ''
      })

      const sessions = await listSessions()

      expect(sessions).toHaveLength(2)
      expect(sessions[0].id).toBe('session2') // Should be sorted by updated_at (newest first)
      expect(sessions[1].id).toBe('session1')
    })

    it('should skip invalid session files', async () => {
      const sessionFiles = ['valid-session.json', 'invalid-session.json', 'corrupt-session.json']
      mockReaddirSync.mockReturnValue(sessionFiles)

      const validSession = createTestSession({
        id: 'valid-session',
        title: 'Valid Session'
      })

      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('valid-session.json')) return JSON.stringify(validSession)
        if (filePath.includes('invalid-session.json')) return '{}'
        if (filePath.includes('corrupt-session.json')) throw new Error('Corrupt file')
        return ''
      })

      const sessions = await listSessions()

      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('valid-session')
    })

    it('should handle directory read errors gracefully', async () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Directory not found')
      })

      await expect(listSessions()).rejects.toThrow('Directory not found')
    })

    it('should return sessions sorted by update time (newest first)', async () => {
      const sessionFiles = ['old-session.json', 'new-session.json', 'middle-session.json']
      mockReaddirSync.mockReturnValue(sessionFiles)

      const oldSession = createTestSession({
        id: 'old-session',
        title: 'Old Session',
        updatedAt: Date.now() - 5000
      })

      const middleSession = createTestSession({
        id: 'middle-session',
        title: 'Middle Session',
        updatedAt: Date.now() - 2500
      })

      const newSession = createTestSession({
        id: 'new-session',
        title: 'New Session',
        updatedAt: Date.now()
      })

      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('old-session.json')) return JSON.stringify(oldSession)
        if (filePath.includes('middle-session.json')) return JSON.stringify(middleSession)
        if (filePath.includes('new-session.json')) return JSON.stringify(newSession)
        return ''
      })

      const sessions = await listSessions()

      expect(sessions).toHaveLength(3)
      expect(sessions[0].id).toBe('new-session')
      expect(sessions[1].id).toBe('middle-session')
      expect(sessions[2].id).toBe('old-session')
    })
  })

  describe('Storage Error Handling', () => {
    it('should handle file system permission errors', async () => {
      const testSession = createTestSession()

      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await expect(saveSession(testSession)).rejects.toThrow('Permission denied')
    })

    it('should handle disk full errors', async () => {
      const testSession = createTestSession()

      mockWriteFileSync.mockImplementation(() => {
        throw new Error('No space left on device')
      })

      await expect(saveSession(testSession)).rejects.toThrow('No space left on device')
    })

    it('should handle corrupted JSON files', async () => {
      mockReadFileSync.mockReturnValue('{ corrupted json }')

      const session = await loadSession('corrupted-session')

      expect(session).toBeNull()
    })
  })

  describe('Storage Performance', () => {
    it('should handle large sessions efficiently', async () => {
      // Create a session with many messages
      const largeSession = createTestSession({
        messages: Array(1000).fill(0).map((_, i) => 
          createTestMessage({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `This is message number ${i} with some content to make it longer. `.repeat(5)
          })
        )
      })

      const startTime = Date.now()
      await saveSession(largeSession)
      const saveTime = Date.now() - startTime

      expect(saveTime).toBeLessThan(1000) // Should complete within 1 second
      expect(mockWriteFileSync).toHaveBeenCalled()
    })

    it('should handle concurrent save operations', async () => {
      const sessions = Array(10).fill(0).map((_, i) => 
        createTestSession({
          id: `concurrent-session-${i}`,
          title: `Concurrent Session ${i}`
        })
      )

      const savePromises = sessions.map(session => saveSession(session))

      await Promise.all(savePromises)

      expect(mockWriteFileSync).toHaveBeenCalledTimes(10)
    })
  })
})