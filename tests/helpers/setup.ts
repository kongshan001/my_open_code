import { vi } from 'vitest'

// Mock console methods to reduce noise in tests
Object.defineProperty(console, 'log', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(console, 'warn', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(console, 'error', {
  value: vi.fn(),
  writable: true
})

// Mock process.cwd to return consistent path for tests
vi.stubEnv('PWD', '/test/workdir')

// Set default test environment variables
vi.stubEnv('GLM_API_KEY', 'test-api-key')
vi.stubEnv('GLM_BASE_URL', 'https://api.test.com')
vi.stubEnv('GLM_MODEL', 'test-model')
vi.stubEnv('COMPRESSION_ENABLED', 'true')
vi.stubEnv('COMPRESSION_THRESHOLD', '75')
vi.stubEnv('COMPRESSION_STRATEGY', 'summary')
vi.stubEnv('PRESERVE_TOOL_HISTORY', 'true')
vi.stubEnv('PRESERVE_RECENT_MESSAGES', '10')
vi.stubEnv('NOTIFY_BEFORE_COMPRESSION', 'true')