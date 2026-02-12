import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TesterAgent } from '../../src/agents/tester-agent.js';
import { Task } from '../../src/web-types.js';

describe('TesterAgent', () => {
  let agent: TesterAgent;

  beforeEach(() => {
    agent = new TesterAgent();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(agent.id).toBe('agent-tester-1');
      expect(agent.name).toBe('QA Tester Agent');
      expect(agent.role).toBe('tester');
      expect(agent.status).toBe('idle');
    });

    it('should have correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      const capabilityNames = capabilities.map(c => c.name);

      expect(capabilityNames).toContain('Test Generation');
      expect(capabilityNames).toContain('Test Execution');
      expect(capabilityNames).toContain('Test Analysis');
      expect(capabilityNames).toContain('Coverage Analysis');
      expect(capabilityNames).toContain('Validation');
    });

    it('should allow custom config', () => {
      const customAgent = new TesterAgent({
        id: 'custom-tester',
        name: 'Custom Tester',
        priority: 'high',
      });

      expect(customAgent.id).toBe('custom-tester');
      expect(customAgent.name).toBe('Custom Tester');
      expect(customAgent.config.priority).toBe('high');
    });
  });

  describe('execute - script tests', () => {
    const createScriptTask = (script: string, language: 'bash' | 'node' | 'python'): Task => ({
      id: 'task-1',
      name: 'Test Task',
      description: 'Execute test',
      type: 'script',
      config: {
        script: {
          language,
          script,
          workingDir: process.cwd(),
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should execute bash test script successfully', async () => {
      const task = createScriptTask('echo "PASS: Test passed"', 'bash');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test Execution Summary');
      expect(result.output).toContain('Passed: 1');
    });

    it('should execute node test script', async () => {
      const task = createScriptTask('console.log("PASS")', 'node');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test Execution Summary');
    });

    it('should handle test script failure', async () => {
      const task = createScriptTask('echo "FAIL: Test failed" && exit 1', 'bash');
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Test Execution Summary');
    });

    it('should count pass and fail correctly', async () => {
      const task = createScriptTask(`
        echo "PASS: Test 1 passed"
        echo "PASS: Test 2 passed"
        echo "FAIL: Test 3 failed"
        echo "FAIL: Test 4 failed"
      `, 'bash');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Passed: 2');
      expect(result.output).toContain('Failed: 2');
    });

    it('should throw when script config is missing', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'script',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('Script configuration is missing');
    });
  });

  describe('execute - custom tests', () => {
    const createCustomTask = (functionStr: string, parameters: any): Task => ({
      id: 'task-1',
      name: 'Custom Test',
      description: 'Custom test',
      type: 'custom',
      config: {
        custom: {
          function: functionStr,
          parameters,
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should execute custom test function successfully', async () => {
      const testFn = `async function({ input }) {
        if (input === 'valid') {
          return { passed: true, message: 'Test passed' };
        }
        throw new Error('Invalid input');
      }`;

      const task = createCustomTask(testFn, { input: 'valid' });
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Status: PASSED');
    });

    it('should handle custom test failure', async () => {
      const testFn = `async function({ input }) {
        throw new Error('Test execution failed');
      }`;

      const task = createCustomTask(testFn, {});
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test execution failed');
    });

    it('should throw when custom config is missing', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'custom',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('Custom configuration is missing');
    });

    it('should throw when function is not provided', async () => {
      const task = createCustomTask('', {});

      await expect(agent.execute(task)).rejects.toThrow('must contain a function');
    });
  });

  describe('execute - API tests', () => {
    const createApiTask = (url: string, method: string = 'GET'): Task => ({
      id: 'task-1',
      name: 'API Test',
      description: 'API test',
      type: 'api',
      config: {
        api: {
          url,
          method: method as any,
          headers: { 'Content-Type': 'application/json' },
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should test API endpoint successfully', async () => {
      const task = createApiTask('https://httpbin.org/status/200');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Status: PASSED');
      expect(result.output).toContain('Actual Status: 200');
    });

    it('should handle API test failure with unexpected status', async () => {
      const task = createApiTask('https://httpbin.org/status/500');
      task.config.api!.expectedStatus = [200, 201];
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Status: FAILED');
    });

    it('should include response time in test results', async () => {
      const task = createApiTask('https://httpbin.org/delay/1');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Response Time:');
    });

    it('should include response snippet in results', async () => {
      const task = createApiTask('https://httpbin.org/get');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Response:');
    });

    it('should throw when api config is missing', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'api',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('API configuration is missing');
    });
  });

  describe('execute - unsupported task types', () => {
    it('should throw on unsupported task type', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'file',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('Unsupported task type for tester');
    });
  });

  describe('status management', () => {
    it('should set status to busy during execution', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'sleep 0.1',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const promise = agent.execute(task);
      expect(agent.status).toBe('busy');

      await promise;
    });

    it('should return to idle after successful execution', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'echo "test"',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await agent.execute(task);
      expect(agent.status).toBe('idle');
    });
  });

  describe('execution result', () => {
    it('should return properly formatted result on success', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'echo "PASS"',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await agent.execute(task);

      expect(result).toMatchObject({
        success: true,
        output: expect.stringContaining('Test Execution Summary'),
        agentId: 'agent-tester-1',
        duration: expect.any(Number),
        timestamp: expect.any(Number),
      });
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should include error on failure', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'exit 1',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await agent.execute(task);

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Test Execution Summary'),
        agentId: 'agent-tester-1',
      });
    });
  });
});