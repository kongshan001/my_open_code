import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadConfig, getConfig } from '../../src/config.js'
import { mockDotenv, mockProcess } from '../helpers/mocks.js'

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(() => ({}))
}))

// Mock process
vi.stubGlobal('process', mockProcess)

describe('Config Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    mockProcess.env = {
      GLM_API_KEY: 'test-api-key',
      GLM_BASE_URL: 'https://api.test.com',
      GLM_MODEL: 'test-model',
      COMPRESSION_ENABLED: 'true',
      COMPRESSION_THRESHOLD: '75',
      COMPRESSION_STRATEGY: 'summary',
      PRESERVE_TOOL_HISTORY: 'true',
      PRESERVE_RECENT_MESSAGES: '10',
      NOTIFY_BEFORE_COMPRESSION: 'true'
    }
  })

  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      const config = loadConfig()
      
      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        model: 'test-model',
        workingDir: '/test/workdir',
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

    it('should use default values when environment variables are missing', () => {
      mockProcess.env = {
        GLM_API_KEY: 'test-api-key'
        // Other env vars missing
      }
      
      const config = loadConfig()
      
      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        model: 'glm-4.7',
        workingDir: '/test/workdir',
        compression: undefined
      })
    })

    it('should throw error when GLM_API_KEY is missing', () => {
      mockProcess.env = {}
      
      expect(() => loadConfig()).toThrow('GLM_API_KEY not found')
    })

    it('should load compression configuration when enabled', () => {
      mockProcess.env = {
        GLM_API_KEY: 'test-api-key',
        COMPRESSION_ENABLED: 'true',
        COMPRESSION_THRESHOLD: '80',
        COMPRESSION_STRATEGY: 'sliding-window',
        PRESERVE_TOOL_HISTORY: 'false',
        PRESERVE_RECENT_MESSAGES: '15',
        NOTIFY_BEFORE_COMPRESSION: 'false'
      }
      
      const config = loadConfig()
      
      expect(config.compression).toEqual({
        enabled: true,
        threshold: 80,
        strategy: 'sliding-window',
        preserveToolHistory: false,
        preserveRecentMessages: 15,
        notifyBeforeCompression: false
      })
    })

    it('should omit compression when disabled', () => {
      mockProcess.env = {
        GLM_API_KEY: 'test-api-key',
        COMPRESSION_ENABLED: 'false'
      }
      
      const config = loadConfig()
      
      expect(config.compression).toBeUndefined()
    })

    it('should handle numeric environment variables correctly', () => {
      mockProcess.env = {
        GLM_API_KEY: 'test-api-key',
        COMPRESSION_ENABLED: 'true',
        COMPRESSION_THRESHOLD: '85',
        PRESERVE_RECENT_MESSAGES: '20'
      }
      
      const config = loadConfig()
      
      expect(config.compression?.threshold).toBe(85)
      expect(config.compression?.preserveRecentMessages).toBe(20)
    })

    it('should handle boolean environment variables correctly', () => {
      mockProcess.env = {
        GLM_API_KEY: 'test-api-key',
        COMPRESSION_ENABLED: 'true',
        PRESERVE_TOOL_HISTORY: 'false',
        NOTIFY_BEFORE_COMPRESSION: 'false'
      }
      
      const config = loadConfig()
      
      expect(config.compression?.enabled).toBe(true)
      expect(config.compression?.preserveToolHistory).toBe(false)
      expect(config.compression?.notifyBeforeCompression).toBe(false)
    })

    it('should validate compression strategy', () => {
      mockProcess.env = {
        GLM_API_KEY: 'test-api-key',
        COMPRESSION_ENABLED: 'true',
        COMPRESSION_STRATEGY: 'importance'
      }
      
      const config = loadConfig()
      
      expect(config.compression?.strategy).toBe('importance')
    })

    it('should call dotenv.config', () => {
      loadConfig()
      expect(mockDotenv.config).toHaveBeenCalled()
    })
  })

  describe('getConfig', () => {
    it('should return the same result as loadConfig', () => {
      const loadedConfig = loadConfig()
      const config = getConfig()
      
      expect(config).toEqual(loadedConfig)
    })

    it('should return consistent results on multiple calls', () => {
      const config1 = getConfig()
      const config2 = getConfig()
      
      expect(config1).toEqual(config2)
    })
  })
})