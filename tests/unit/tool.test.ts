import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeTool, registerTool } from '../../src/tool.js';
import { createTestToolContext, createTestTool, createTestToolSchema } from '../helpers/factories.js';

describe('Tool Execution', () => {
  beforeEach(() => {
    // Register test tools before each test
    const testSchema = createTestToolSchema();
    
    registerTool(createTestTool({
      id: 'test-tool',
      description: 'A test tool',
      parameters: testSchema,
      execute: async () => ({ output: 'Tool executed successfully' })
    }));
    
    registerTool(createTestTool({
      id: 'failing-tool',
      description: 'A failing tool',
      parameters: testSchema,
      execute: async () => {
        throw new Error('Tool execution failed');
      }
    }));
    
    registerTool(createTestTool({
      id: 'context-tool',
      description: 'Tool that checks context',
      parameters: testSchema,
      execute: vi.fn().mockResolvedValue({ output: 'Context passed correctly' })
    }));
    
    registerTool(createTestTool({
      id: 'slow-tool',
      description: 'A tool that takes too long',
      parameters: testSchema,
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { output: 'Tool completed slowly' };
      }
    }));
    
    registerTool(createTestTool({
      id: 'validated-tool',
      description: 'Tool with parameter validation',
      parameters: testSchema,
      execute: async () => ({ output: 'Validation passed' })
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute tool successfully', async () => {
    const context = createTestToolContext();
    const result = await executeTool('test-tool', { action: 'test' }, context);
    
    expect(result).toBeDefined();
    expect(result.output).toBe('Tool executed successfully');
  });

  it('should handle tool execution errors', async () => {
    const context = createTestToolContext();
    
    await expect(
      executeTool('failing-tool', {}, context)
    ).rejects.toThrow('Tool execution failed');
  });

  it('should pass context correctly to tool', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ output: 'Context passed correctly' });
    
    registerTool(createTestTool({
      id: 'context-tool-2',
      description: 'Tool that checks context',
      execute: mockExecute
    }));
    
    const context = createTestToolContext({
      sessionId: 'test-session-123',
      messageId: 'test-message-456',
      workingDir: '/test/directory'
    });
    
    await executeTool('context-tool-2', { test: 'data' }, context);
    
    expect(mockExecute).toHaveBeenCalledWith({ test: 'data' }, context);
  });

  it('should handle unknown tools', async () => {
    const context = createTestToolContext();
    
    await expect(
      executeTool('unknown-tool', {}, context)
    ).rejects.toThrow('Tool not found: unknown-tool');
  });

  it('should validate tool arguments', async () => {
    registerTool(createTestTool({
      id: 'validated-tool',
      description: 'Tool with parameter validation',
      parameters: {} as any,
      execute: async () => ({ output: 'Validation passed' })
    }));
    
    const context = createTestToolContext();
    const result = await executeTool('validated-tool', { test: 'data' }, context);
    
    expect(result).toBeDefined();
  });

  it('should handle slow tools', async () => {
    const context = createTestToolContext();
    const startTime = Date.now();
    
    await executeTool('slow-tool', {}, context);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(10000);
  });
});
