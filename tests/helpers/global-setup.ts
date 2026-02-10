import { vi } from 'vitest'

// Global test setup and teardown

// Set up global test timeout
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 })

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

// Set up global error handlers
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in tests:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in tests:', error)
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})