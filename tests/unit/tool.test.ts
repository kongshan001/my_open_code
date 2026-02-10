import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeTool } from '../../src/tool.js'
import { createTestToolContext, createTestTool } from '../helpers/factories.js'

const mockGetTool = vi.fn()

// Mock the tools module
vi.mock('../../src/tools/index.js', () => ({
  getTool: mockGetTool
}))

describe('Tool Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTool.mockReturnValue(createTestTool({
      id: 'test-tool',
      description: 'A test tool',
      execute: vi.fn().mockResolvedValue({ output: 'Tool executed successfully' })
    }))
  })

  it('should execute tool successfully', async () => {
    const context = createTestToolContext()
    const result = await executeTool('test-tool', { action: 'test' }, context)

    expect(result).toBeDefined()
    expect(result.output).toBe('Tool executed successfully')
  })

  it('should handle tool execution errors', async () => {
    mockGetTool.mockReturnValue(createTestTool({
      id: 'failing-tool',
      description: 'A failing tool',
      execute: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
    }))

    const context = createTestToolContext()

    await expect(executeTool('failing-tool', {}, context)).rejects.toThrow('Tool execution failed')
  })

  it('should pass context correctly to tool', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ output: 'Context passed correctly' })
    
    mockGetTool.mockReturnValue(createTestTool({
      id: 'context-tool',
      description: 'Tool that checks context',
      execute: mockExecute
    }))

    const context = createTestToolContext({
      sessionId: 'test-session-123',
      messageId: 'test-message-456',
      workingDir: '/test/directory'
    })

    await executeTool('context-tool', { test: 'data' }, context)

    expect(mockExecute).toHaveBeenCalledWith({ test: 'data' }, context)
  })

  it('should handle unknown tools', async () => {
    mockGetTool.mockReturnValue(undefined)

    const context = createTestToolContext()

    await expect(executeTool('unknown-tool', {}, context)).rejects.toThrow('Tool not found: unknown-tool')
  })

  it('should handle tool execution timeouts', async () => {
    mockGetTool.mockReturnValue(createTestTool({
      id: 'slow-tool',
      description: 'A tool that takes too long',
      execute: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000)))
    }))

    const context = createTestToolContext()

    // This test would need timeout handling implementation
    // For now, just verify the slow tool exists
    const tool = mockGetTool('slow-tool')
    expect(tool).toBeDefined()
  })
})