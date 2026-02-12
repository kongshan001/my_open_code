import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeveloperAgent } from '../../src/agents/developer-agent.js';
import { Task } from '../../src/web-types.js';

describe('DeveloperAgent', () => {
  let agent: DeveloperAgent;

  beforeEach(() => {
    agent = new DeveloperAgent();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(agent.id).toBe('agent-developer-1');
      expect(agent.name).toBe('Developer Agent');
      expect(agent.role).toBe('developer');
      expect(agent.status).toBe('idle');
    });

    it('should have correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      const capabilityNames = capabilities.map(c => c.name);

      expect(capabilityNames).toContain('Code Generation');
      expect(capabilityNames).toContain('Debugging');
      expect(capabilityNames).toContain('Testing');
      expect(capabilityNames).toContain('Code Review');
      expect(capabilityNames).toContain('Documentation');
    });

    it('should allow custom config', () => {
      const customAgent = new DeveloperAgent({
        id: 'custom-dev',
        name: 'Custom Developer',
        priority: 'critical',
      });

      expect(customAgent.id).toBe('custom-dev');
      expect(customAgent.name).toBe('Custom Developer');
      expect(customAgent.config.priority).toBe('critical');
    });
  });

  describe('execute - script tasks', () => {
    const createScriptTask = (script: string, language: 'bash' | 'node'): Task => ({
      id: 'task-1',
      name: 'Script Task',
      description: 'Execute a script',
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

    it('should execute bash script successfully', async () => {
      const task = createScriptTask('echo "Hello, World!"', 'bash');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, World!');
      expect(result.agentId).toBe('agent-developer-1');
    });

    it('should execute node script successfully', async () => {
      const task = createScriptTask('console.log("Node execution")', 'node');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Node execution');
    });

    it('should handle bash script failure', async () => {
      const task = createScriptTask('exit 1', 'bash');
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should throw on unsupported language', async () => {
      const task = {
        ...createScriptTask('print("test")', 'bash'),
        config: {
          script: {
            language: 'python' as any,
            script: 'print("test")',
          },
        },
      };

      await expect(agent.execute(task)).rejects.toThrow();
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

  describe('execute - file operations', () => {
    const createFileTask = (operation: string, path: string, content?: string): Task => ({
      id: 'task-1',
      name: 'File Task',
      description: 'File operation',
      type: 'file',
      config: {
        file: {
          operation: operation as any,
          path,
          content,
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should read file successfully', async () => {
      const task = createFileTask('read', 'package.json');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('"name"');
    });

    it('should write file successfully', async () => {
      const testFile = `/tmp/test-file-${Date.now()}.txt`;
      const task = createFileTask('write', testFile, 'Test content');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);

      const fs = await import('fs/promises');
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Test content');

      await fs.unlink(testFile);
    });

    it('should throw on unsupported file operation', async () => {
      const task = createFileTask('delete', 'some-path');

      await expect(agent.execute(task)).rejects.toThrow('not implemented');
    });

    it('should throw when file config is missing', async () => {
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

      await expect(agent.execute(task)).rejects.toThrow('File configuration is missing');
    });
  });

  describe('execute - API calls', () => {
    const createApiTask = (url: string, method: string = 'GET'): Task => ({
      id: 'task-1',
      name: 'API Task',
      description: 'API call',
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

    it('should execute GET request successfully', async () => {
      const task = createApiTask('https://httpbin.org/get');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('httpbin.org');
    });

    it('should handle expected status codes', async () => {
      const task = createApiTask('https://httpbin.org/status/200');
      task.config.api!.expectedStatus = [200];
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
    });

    it('should handle unexpected status codes', async () => {
      const task = createApiTask('https://httpbin.org/status/404');
      task.config.api!.expectedStatus = [200];
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle network errors', async () => {
      const task = createApiTask('https://non-existent-domain-12345.com');
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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
        type: 'custom',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('Unsupported task type');
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
      expect(agent.status).toBe('idle');
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
            script: 'echo "test output"',
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
        output: expect.any(String),
        agentId: 'agent-developer-1',
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
            script: 'invalid-command-that-does-not-exist',
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
        error: expect.any(String),
        agentId: 'agent-developer-1',
      });
    });
  });
});