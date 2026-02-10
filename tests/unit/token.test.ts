import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateContextUsage, estimateTokens, formatContextUsage, getContextWarning } from '../../src/token.js'
import { createTestMessage, createLongConversation } from '../helpers/factories.js'

describe('Token Utils', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for short text', () => {
      const text = 'Hello world'
      const tokens = estimateTokens(text)
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(10)
    })

    it('should estimate tokens for longer text', () => {
      const text = 'This is a longer piece of text with multiple sentences and words that should result in more tokens being estimated by the function.'
      const tokens = estimateTokens(text)
      expect(tokens).toBeGreaterThan(10)
    })

    it('should handle empty text', () => {
      const tokens = estimateTokens('')
      expect(tokens).toBe(0)
    })

    it('should handle whitespace-only text', () => {
      const tokens = estimateTokens('   \n\t   ')
      expect(tokens).toBe(0)
    })

    it('should estimate higher token count for text with code', () => {
      const codeText = `
        function calculateTokens(text: string): number {
          const words = text.split(/\\s+/);
          return Math.ceil(words.length * 1.3);
        }
      `
      const regularText = 'function calculate tokens text number words split return ceil length'
      
      const codeTokens = estimateTokens(codeText)
      const regularTokens = estimateTokens(regularText)
      
      expect(codeTokens).toBeGreaterThan(regularTokens)
    })
  })

  describe('calculateContextUsage', () => {
    it('should calculate usage for empty message array', () => {
      const usage = calculateContextUsage([], 'glm-4.7')
      expect(usage.totalTokens).toBe(0)
      expect(usage.usagePercentage).toBe(0)
      expect(usage.inputTokens).toBe(0)
      expect(usage.outputTokens).toBe(0)
    })

    it('should calculate usage for single message', () => {
      const messages = [createTestMessage({ content: 'Hello world' })]
      const usage = calculateContextUsage(messages, 'glm-4.7')
      
      expect(usage.totalTokens).toBeGreaterThan(0)
      expect(usage.usagePercentage).toBeGreaterThan(0)
      expect(usage.contextLimit).toBe(128000) // GLM-4.7 context limit
    })

    it('should calculate usage for multiple messages', () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'Hello' }),
        createTestMessage({ role: 'assistant', content: 'Hi there!' }),
        createTestMessage({ role: 'user', content: 'How are you?' })
      ]
      const usage = calculateContextUsage(messages, 'glm-4.7')
      
      expect(usage.totalTokens).toBeGreaterThan(0)
      expect(usage.usagePercentage).toBeGreaterThan(0)
    })

    it('should handle different model contexts correctly', () => {
      const messages = [createTestMessage()]
      
      const glmUsage = calculateContextUsage(messages, 'glm-4.7')
      const gpt4Usage = calculateContextUsage(messages, 'gpt-4')
      
      expect(glmUsage.contextLimit).toBe(128000)
      expect(gpt4Usage.contextLimit).toBe(8192)
    })

    it('should categorize tokens by message role correctly', () => {
      const messages = [
        createTestMessage({ role: 'user', content: 'User message here' }),
        createTestMessage({ role: 'assistant', content: 'Assistant response here' }),
        createTestMessage({ role: 'user', content: 'Another user message' })
      ]
      const usage = calculateContextUsage(messages, 'glm-4.7')
      
      expect(usage.inputTokens).toBeGreaterThan(0) // user messages
      expect(usage.outputTokens).toBeGreaterThan(0) // assistant messages
      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens)
    })

    it('should handle very long conversations', () => {
      const messages = createLongConversation(100)
      const usage = calculateContextUsage(messages, 'glm-4.7')
      
      expect(usage.totalTokens).toBeGreaterThan(1000)
      expect(usage.usagePercentage).toBeGreaterThan(0)
    })
  })

  describe('formatContextUsage', () => {
    it('should format usage for low usage', () => {
      const usage = {
        totalTokens: 100,
        usagePercentage: 0.1,
        contextLimit: 128000,
        inputTokens: 50,
        outputTokens: 50
      }
      
      const formatted = formatContextUsage(usage, false)
      expect(formatted).toContain('0.1%')
      expect(formatted).toContain('100')
      expect(formatted).toContain('128,000')
    })

    it('should format usage for high usage', () => {
      const usage = {
        totalTokens: 100000,
        usagePercentage: 78.1,
        contextLimit: 128000,
        inputTokens: 60000,
        outputTokens: 40000
      }
      
      const formatted = formatContextUsage(usage, false)
      expect(formatted).toContain('78.1%')
      expect(formatted).toContain('100,000')
      expect(formatted).toContain('128,000')
    })

    it('should show compressed indicator when requested', () => {
      const usage = {
        totalTokens: 50000,
        usagePercentage: 39.1,
        contextLimit: 128000,
        inputTokens: 30000,
        outputTokens: 20000
      }
      
      const formatted = formatContextUsage(usage, true)
      expect(formatted).toContain('📦')
      expect(formatted).toContain('compressed')
    })

    it('should format large numbers correctly', () => {
      const usage = {
        totalTokens: 1234567,
        usagePercentage: 50,
        contextLimit: 2000000,
        inputTokens: 600000,
        outputTokens: 634567
      }
      
      const formatted = formatContextUsage(usage, false)
      expect(formatted).toContain('1,234,567')
      expect(formatted).toContain('600,000')
      expect(formatted).toContain('634,567')
    })
  })

  describe('getContextWarning', () => {
    it('should return null for low usage', () => {
      const usage = {
        totalTokens: 1000,
        usagePercentage: 10,
        contextLimit: 128000,
        inputTokens: 500,
        outputTokens: 500
      }
      
      const warning = getContextWarning(usage)
      expect(warning).toBeNull()
    })

    it('should return warning for high usage (75%+)', () => {
      const usage = {
        totalTokens: 96000,
        usagePercentage: 75,
        contextLimit: 128000,
        inputTokens: 50000,
        outputTokens: 46000
      }
      
      const warning = getContextWarning(usage)
      expect(warning).toContain('⚠️')
      expect(warning).toContain('75%')
      expect(warning).toContain('high')
    })

    it('should return critical warning for very high usage (90%+)', () => {
      const usage = {
        totalTokens: 115200,
        usagePercentage: 90,
        contextLimit: 128000,
        inputTokens: 60000,
        outputTokens: 55200
      }
      
      const warning = getContextWarning(usage)
      expect(warning).toContain('🚨')
      expect(warning).toContain('90%')
      expect(warning).toContain('critical')
    })

    it('should return different warnings for different threshold levels', () => {
      const lowWarning = getContextWarning({
        totalTokens: 8000,
        usagePercentage: 50,
        contextLimit: 128000,
        inputTokens: 4000,
        outputTokens: 4000
      })
      
      const highWarning = getContextWarning({
        totalTokens: 96000,
        usagePercentage: 75,
        contextLimit: 128000,
        inputTokens: 50000,
        outputTokens: 46000
      })
      
      const criticalWarning = getContextWarning({
        totalTokens: 115200,
        usagePercentage: 90,
        contextLimit: 128000,
        inputTokens: 60000,
        outputTokens: 55200
      })
      
      expect(lowWarning).toBeNull()
      expect(highWarning).toContain('⚠️')
      expect(criticalWarning).toContain('🚨')
      expect(criticalWarning).not.toBe(highWarning)
    })
  })
})