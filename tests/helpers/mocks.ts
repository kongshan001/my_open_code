import { vi } from 'vitest'

/**
 * Mock implementations for external dependencies
 */

// Mock readline for tests
export const mockReadline = {
  createInterface: vi.fn(() => ({
    question: vi.fn((prompt: string, callback: (answer: string) => void) => {
      callback('test answer')
    }),
    close: vi.fn()
  }))
}

// Mock file system operations
export const mockFs = {
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({})),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({
    isDirectory: () => false,
    isFile: () => true,
    size: 1024
  }))
}

// Mock process methods
export const mockProcess = {
  cwd: vi.fn(() => '/test/workdir'),
  env: {
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
}

// Mock AI SDK
export const mockAI = {
  generateText: vi.fn(),
  streamText: vi.fn(),
  generateObject: vi.fn(),
  generateStructure: vi.fn()
}

// Mock Zod
export const mockZod = {
  string: vi.fn(() => ({
    min: vi.fn().mockReturnThis(),
    max: vi.fn().mockReturnThis(),
    optional: vi.fn().mockReturnThis(),
    parse: vi.fn((val: any) => val)
  })),
  number: vi.fn(() => ({
    min: vi.fn().mockReturnThis(),
    max: vi.fn().mockReturnThis(),
    optional: vi.fn().mockReturnThis(),
    parse: vi.fn((val: any) => val)
  })),
  boolean: vi.fn(() => ({
    optional: vi.fn().mockReturnThis(),
    parse: vi.fn((val: any) => val)
  })),
  object: vi.fn(() => ({
    parse: vi.fn((val: any) => val)
  })),
  array: vi.fn(() => ({
    min: vi.fn().mockReturnThis(),
    parse: vi.fn((val: any) => val)
  })),
  union: vi.fn(() => ({
    parse: vi.fn((val: any) => val)
  })),
  literal: vi.fn(() => ({
    parse: vi.fn((val: any) => val)
  })),
  optional: vi.fn(() => ({
    parse: vi.fn((val: any) => val)
  })),
  default: vi.fn(() => ({
    parse: vi.fn((val: any) => val)
  }))
}

// Mock dotenv
export const mockDotenv = {
  config: vi.fn(() => ({}))
}