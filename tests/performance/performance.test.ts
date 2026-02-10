import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionManager } from '../../src/session.js'
import { CompressionManager } from '../../src/compression.js'
import { 
  createTestSession, 
  createTestConfig, 
  createLongConversation,
  createLargeSession,
  createLargeMessage
} from '../helpers/factories.js'

// Mock external dependencies for performance testing
vi.mock('../../src/storage.js', () => ({
  saveSession: vi.fn(() => Promise.resolve()),
  loadSession: vi.fn(),
  generateId: vi.fn(() => 'test-id'),
  listSessions: vi.fn(() => [])
}))

vi.mock('../../src/llm.js', () => ({
  streamChat: vi.fn(() => async function* () {
    yield { content: 'Performance test response' }
  }())
}))

vi.mock('../../src/system-prompt.js', () => ({
  getSystemPrompt: vi.fn(() => 'Performance test system prompt')
}))

vi.mock('../../src/tool.js', () => ({
  executeTool: vi.fn(() => Promise.resolve({ output: 'Performance test tool result' }))
}))

describe('Performance Tests', () => {
  let compressionManager: CompressionManager
  let testConfig: any

  beforeEach(() => {
    compressionManager = new CompressionManager()
    testConfig = createTestConfig({
      compression: {
        enabled: true,
        threshold: 50, // Lower threshold for performance testing
        strategy: 'summary',
        preserveToolHistory: true,
        preserveRecentMessages: 20,
        notifyBeforeCompression: false
      }
    })
    vi.clearAllMocks()
  })

  describe('Compression Performance', () => {
    it('should compress large conversations efficiently', async () => {
      const largeConversation = createLongConversation(100)
      const startTime = Date.now()
      
      const result = await compressionManager.compress(
        largeConversation,
        testConfig.compression,
        'test-model'
      )
      
      const endTime = Date.now()
      const compressionTime = endTime - startTime
      
      expect(compressionTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.originalTokenCount).toBeGreaterThan(0)
      
      if (result.compressed) {
        expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount)
        expect(result.reductionPercentage).toBeGreaterThan(0)
      }
    })

    it('should handle very large sessions under time constraints', async () => {
      const veryLargeSession = createLargeSession(500, 2000) // 500 messages, 2000 chars each
      const startTime = Date.now()
      
      const result = await compressionManager.compress(
        veryLargeSession.messages,
        testConfig.compression,
        'test-model'
      )
      
      const endTime = Date.now()
      const processingTime = endTime - startTime
      
      expect(processingTime).toBeLessThan(10000) // Should complete within 10 seconds
      expect(result).toBeDefined()
    })

    it('should maintain performance with different compression strategies', async () => {
      const strategies = ['summary', 'sliding-window', 'importance'] as const
      const largeConversation = createLongConversation(100)
      
      for (const strategy of strategies) {
        const config = {
          ...testConfig.compression,
          strategy
        }
        
        const startTime = Date.now()
        
        const result = await compressionManager.compress(
          largeConversation,
          config,
          'test-model'
        )
        
        const endTime = Date.now()
        const strategyTime = endTime - startTime
        
        expect(strategyTime).toBeLessThan(3000) // Each strategy should complete within 3 seconds
        expect(result.strategy).toBe(strategy)
      }
    })

    it('should scale linearly with message count for summary strategy', async () => {
      const messageCounts = [50, 100, 200]
      const times: number[] = []
      
      for (const count of messageCounts) {
        const conversation = createLongConversation(count)
        
        const startTime = Date.now()
        await compressionManager.compress(
          conversation,
          { ...testConfig.compression, strategy: 'summary' },
          'test-model'
        )
        const endTime = Date.now()
        
        times.push(endTime - startTime)
      }
      
      // Should scale approximately linearly (allowing for some variance)
      const scalingFactor = times[2] / times[0] // 200 messages vs 50 messages
      expect(scalingFactor).toBeLessThan(5) // Should be less than 5x slower for 4x more messages
    })

    it('should handle memory efficiently during compression', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      const largeConversation = createLongConversation(200)
      
      await compressionManager.compress(
        largeConversation,
        testConfig.compression,
        'test-model'
      )
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Session Management Performance', () => {
    it('should handle rapid message additions efficiently', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      
      const startTime = Date.now()
      const messageCount = 100
      
      for (let i = 0; i < messageCount; i++) {
        await sessionManager.addUserMessage(`Performance test message ${i}`)
      }
      
      const endTime = Date.now()
      const addTime = endTime - startTime
      
      expect(addTime).toBeLessThan(2000) // Should add 100 messages within 2 seconds
      expect(sessionManager.getSession().messages.length).toBe(messageCount)
    })

    it('should handle message processing under load', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      
      // Add initial messages
      for (let i = 0; i < 10; i++) {
        await sessionManager.addUserMessage(`Message ${i}`)
      }
      
      const startTime = Date.now()
      
      // Process messages rapidly
      for (let i = 0; i < 10; i++) {
        await sessionManager.processMessage()
      }
      
      const endTime = Date.now()
      const processingTime = endTime - startTime
      
      expect(processingTime).toBeLessThan(5000) // Should process 10 messages within 5 seconds
    })

    it('should maintain performance with compression enabled', async () => {
      const session = createTestSession()
      const configWithCompression = createTestConfig({
        compression: {
          ...testConfig.compression,
          threshold: 20 // Low threshold to trigger compression frequently
        }
      })
      const sessionManager = new SessionManager(session, configWithCompression)
      
      const startTime = Date.now()
      
      // Add enough messages to trigger multiple compressions
      for (let i = 0; i < 50; i++) {
        await sessionManager.addUserMessage(`Performance test message ${i}`)
        await sessionManager.processMessage()
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      expect(totalTime).toBeLessThan(15000) // Should complete within 15 seconds
      expect(sessionManager.getSession().lastCompression).toBeDefined()
    })

    it('should handle concurrent operations efficiently', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      
      const startTime = Date.now()
      
      // Add messages concurrently
      const addPromises = Array(20).fill(0).map((_, i) => 
        sessionManager.addUserMessage(`Concurrent message ${i}`)
      )
      
      await Promise.all(addPromises)
      
      const endTime = Date.now()
      const concurrentTime = endTime - startTime
      
      expect(concurrentTime).toBeLessThan(3000) // Should complete within 3 seconds
      expect(sessionManager.getSession().messages.length).toBe(20)
    })
  })

  describe('Memory Performance', () => {
    it('should not leak memory during repeated compressions', async () => {
      const conversation = createLongConversation(50)
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform multiple compressions
      for (let i = 0; i < 10; i++) {
        await compressionManager.compress(
          conversation,
          testConfig.compression,
          'test-model'
        )
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory
      
      // Memory growth should be minimal (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024)
    })

    it('should handle large individual messages efficiently', async () => {
      const largeMessage = createLargeMessage(10000) // 10KB message
      const session = createTestSession({ messages: [largeMessage] })
      const sessionManager = new SessionManager(session, testConfig)
      
      const startTime = Date.now()
      const usage = sessionManager.getContextUsage()
      const endTime = Date.now()
      
      expect(endTime - startTime).toBeLessThan(1000) // Should calculate usage within 1 second
      expect(usage.totalTokens).toBeGreaterThan(0)
    })

    it('should maintain stable memory usage with growing sessions', async () => {
      const memorySnapshots: number[] = []
      
      for (let i = 0; i < 5; i++) {
        const session = createLargeSession(i * 50, 1000)
        const sessionManager = new SessionManager(session, testConfig)
        
        await sessionManager.checkAndPerformCompression()
        
        if (global.gc) {
          global.gc()
        }
        
        memorySnapshots.push(process.memoryUsage().heapUsed)
      }
      
      // Memory growth should be reasonable
      const memoryGrowth = memorySnapshots[4] - memorySnapshots[0]
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024) // Less than 20MB growth
    })
  })

  describe('Throughput Performance', () => {
    it('should achieve high message processing throughput', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      const messageCount = 100
      
      const startTime = Date.now()
      
      for (let i = 0; i < messageCount; i++) {
        await sessionManager.addUserMessage(`Throughput test ${i}`)
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      const throughput = messageCount / (totalTime / 1000) // messages per second
      
      expect(throughput).toBeGreaterThan(10) // Should process at least 10 messages per second
    })

    it('should achieve high compression throughput', async () => {
      const conversations = Array(10).fill(0).map(() => createLongConversation(50))
      
      const startTime = Date.now()
      
      const compressionPromises = conversations.map(conv =>
        compressionManager.compress(
          conv,
          testConfig.compression,
          'test-model'
        )
      )
      
      await Promise.all(compressionPromises)
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      const throughput = conversations.length / (totalTime / 1000) // compressions per second
      
      expect(throughput).toBeGreaterThan(1) // Should achieve at least 1 compression per second
    })

    it('should maintain throughput under sustained load', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      const batchSize = 20
      const batches = 5
      
      const batchTimes: number[] = []
      
      for (let batch = 0; batch < batches; batch++) {
        const startTime = Date.now()
        
        for (let i = 0; i < batchSize; i++) {
          await sessionManager.addUserMessage(`Sustained load ${batch}-${i}`)
          await sessionManager.processMessage()
        }
        
        const endTime = Date.now()
        batchTimes.push(endTime - startTime)
      }
      
      // Performance should not degrade significantly over time
      const firstBatchTime = batchTimes[0]
      const lastBatchTime = batchTimes[batchTimes.length - 1]
      const degradationFactor = lastBatchTime / firstBatchTime
      
      expect(degradationFactor).toBeLessThan(2) // Last batch should not be more than 2x slower
    })
  })

  describe('Stress Tests', () => {
    it('should handle extreme message counts without crashing', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      const extremeMessageCount = 1000
      
      const startTime = Date.now()
      
      for (let i = 0; i < extremeMessageCount; i++) {
        await sessionManager.addUserMessage(`Stress test message ${i}`)
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      expect(totalTime).toBeLessThan(30000) // Should complete within 30 seconds
      expect(sessionManager.getSession().messages.length).toBe(extremeMessageCount)
    })

    it('should handle rapid compression cycles', async () => {
      const conversation = createLongConversation(100)
      const rapidCycles = 20
      
      const startTime = Date.now()
      
      for (let i = 0; i < rapidCycles; i++) {
        await compressionManager.compress(
          conversation,
          testConfig.compression,
          'test-model'
        )
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      const averageCycleTime = totalTime / rapidCycles
      
      expect(averageCycleTime).toBeLessThan(500) // Each compression should average less than 500ms
    })

    it('should maintain performance with mixed workloads', async () => {
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      
      const startTime = Date.now()
      
      // Mixed workload: add messages, process, compress
      for (let i = 0; i < 50; i++) {
        await sessionManager.addUserMessage(`Mixed workload ${i}`)
        
        if (i % 5 === 0) {
          await sessionManager.processMessage()
        }
        
        if (i % 10 === 0) {
          await sessionManager.checkAndPerformCompression()
        }
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      expect(totalTime).toBeLessThan(10000) // Should complete within 10 seconds
    })
  })

  describe('Benchmark Tests', () => {
    it('should meet baseline performance benchmarks', async () => {
      const benchmarks = {
        messageAdd: 50, // 50ms per message addition
        messageProcess: 200, // 200ms per message processing
        compression: 1000, // 1000ms per compression
        contextUsage: 10 // 10ms for context usage calculation
      }
      
      const session = createTestSession()
      const sessionManager = new SessionManager(session, testConfig)
      const conversation = createLongConversation(50)
      
      // Benchmark message addition
      const addStartTime = Date.now()
      await sessionManager.addUserMessage('Benchmark test message')
      const addTime = Date.now() - addStartTime
      expect(addTime).toBeLessThan(benchmarks.messageAdd)
      
      // Benchmark message processing
      const processStartTime = Date.now()
      await sessionManager.processMessage()
      const processTime = Date.now() - processStartTime
      expect(processTime).toBeLessThan(benchmarks.messageProcess)
      
      // Benchmark compression
      const compressionStartTime = Date.now()
      await compressionManager.compress(
        conversation,
        testConfig.compression,
        'test-model'
      )
      const compressionTime = Date.now() - compressionStartTime
      expect(compressionTime).toBeLessThan(benchmarks.compression)
      
      // Benchmark context usage calculation
      const usageStartTime = Date.now()
      sessionManager.getContextUsage()
      const usageTime = Date.now() - usageStartTime
      expect(usageTime).toBeLessThan(benchmarks.contextUsage)
    })
  })
})