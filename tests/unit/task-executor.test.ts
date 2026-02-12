import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskExecutor } from '../../src/task-executor.js';
import { Task, ScriptConfig, ApiConfig, FileConfig } from '../../src/web-types.js';

describe('TaskExecutor', () => {
  let executor: TaskExecutor;

  beforeEach(() => {
    executor = new TaskExecutor();
  });

  afterEach(() => {
  });

  const createTask = (
    type: 'script' | 'api' | 'file' | 'custom',
    config: any
  ): Task => ({
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Task',
    description: 'A test task',
    type,
    config,
    validation: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'test',
  });

  describe('execute', () => {
    it('should execute script task successfully', async () => {
      const scriptConfig: ScriptConfig = {
        language: 'bash',
        script: 'echo "Hello, World!"',
      };

      const task = createTask('script', { script: scriptConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('Hello, World!');
      expect(execution.duration).toBeGreaterThan(0);
      expect(execution.progress).toBe(100);
    });

    it('should handle script execution error', async () => {
      const scriptConfig: ScriptConfig = {
        language: 'bash',
        script: 'exit 1',
      };

      const task = createTask('script', { script: scriptConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.error).toBeDefined();
      expect(execution.error).toContain('exit code 1');
    });

    it('should execute node script successfully', async () => {
      const scriptConfig: ScriptConfig = {
        language: 'node',
        script: 'console.log("Node execution successful")',
      };

      const task = createTask('script', { script: scriptConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('Node execution successful');
    });

    it('should throw on unsupported script language', async () => {
      const scriptConfig: ScriptConfig = {
        language: 'python' as any,
        script: 'print("test")',
      };

      const task = createTask('script', { script: scriptConfig });

      await expect(executor.execute(task)).rejects.toThrow('not yet supported');
    });

    it('should execute API task successfully', async () => {
      const apiConfig: ApiConfig = {
        url: 'https://httpbin.org/get',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      };

      const task = createTask('api', { api: apiConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('httpbin.org');
    });

    it('should validate expected status codes', async () => {
      const apiConfig: ApiConfig = {
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        expectedStatus: [200],
      };

      const task = createTask('api', { api: apiConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
    });

    it('should fail on unexpected status code', async () => {
      const apiConfig: ApiConfig = {
        url: 'https://httpbin.org/status/500',
        method: 'GET',
        expectedStatus: [200, 201],
      };

      const task = createTask('api', { api: apiConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.error).toBeDefined();
      expect(execution.error).toContain('500');
    });

    it('should execute file read operation', async () => {
      const fileConfig: FileConfig = {
        operation: 'read',
        path: 'package.json',
      };

      const task = createTask('file', { file: fileConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('"name"');
    });

    it('should execute file write operation', async () => {
      const testFile = `/tmp/test-file-${Date.now()}.txt`;
      const fileConfig: FileConfig = {
        operation: 'write',
        path: testFile,
        content: 'Test content',
      };

      const task = createTask('file', { file: fileConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('File written to');

      const fs = await import('fs/promises');
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Test content');

      await fs.unlink(testFile);
    });

    it('should execute file delete operation', async () => {
      const fs = await import('fs/promises');
      const testFile = `/tmp/test-file-${Date.now()}.txt`;
      await fs.writeFile(testFile, 'test');

      const fileConfig: FileConfig = {
        operation: 'delete',
        path: testFile,
      };

      const task = createTask('file', { file: fileConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('File deleted');

      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should execute file list operation', async () => {
      const fileConfig: FileConfig = {
        operation: 'list',
        path: process.cwd(),
      };

      const task = createTask('file', { file: fileConfig });
      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toBeDefined();
    });

    it('should throw on unsupported file operation', async () => {
      const fileConfig: FileConfig = {
        operation: 'copy' as any,
        path: 'test',
        targetPath: 'test2',
      };

      const task = createTask('file', { file: fileConfig });

      await expect(executor.execute(task)).rejects.toThrow('not yet supported');
    });

    it('should execute custom function successfully', async () => {
      const customFunction = `async function({ param1, param2 }) {
        return {
          result: param1 + param2,
          timestamp: Date.now()
        };
      }`;

      const task = createTask('custom', {
        custom: {
          function: customFunction,
          parameters: { param1: 10, param2: 20 },
        },
      });

      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.output).toContain('30');
      expect(execution.output).toContain('result');
    });

    it('should throw when custom function is not a function', async () => {
      const task = createTask('custom', {
        custom: {
          function: 'not a function',
          parameters: {},
        },
      });

      await expect(executor.execute(task)).rejects.toThrow('must define a function');
    });

    it('should handle custom function error', async () => {
      const customFunction = `async function() {
        throw new Error('Custom error');
      }`;

      const task = createTask('custom', {
        custom: {
          function: customFunction,
          parameters: {},
        },
      });

      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('Custom error');
    });

    it('should handle unsupported task type', async () => {
      const task = createTask('invalid' as any, {});

      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('Unsupported task type');
    });
  });

  describe('validation', () => {
    it('should validate success criteria', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "Test passed"',
        },
      });

      task.validation.enabled = true;
      task.validation.successCriteria = ['Test passed'];

      const execution = await executor.execute(task);

      expect(execution.validation).toBeDefined();
      expect(execution.validation?.passed).toBe(true);
      expect(execution.validation?.criteriaResults).toHaveLength(1);
      expect(execution.validation?.criteriaResults[0].passed).toBe(true);
    });

    it('should detect error patterns', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "Error occurred"',
        },
      });

      task.validation.enabled = true;
      task.validation.errorPatterns = ['Error'];

      const execution = await executor.execute(task);

      expect(execution.validation).toBeDefined();
      expect(execution.validation?.passed).toBe(false);
      expect(execution.validation?.errorMatches).toContain('Error');
    });

    it('should complete validation when passed', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "All good"',
        },
      });

      task.validation.enabled = true;
      task.validation.successCriteria = ['All good'];

      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
    });

    it('should complete even when validation fails but manual review is required', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "Needs review"',
        },
      });

      task.validation.enabled = true;
      task.validation.successCriteria = ['Passed'];
      task.validation.requireManualReview = true;

      const execution = await executor.execute(task);

      expect(execution.status).toBe('completed');
      expect(execution.validation?.passed).toBe(false);
    });

    it('should fail when validation fails without manual review', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "Failed"',
        },
      });

      task.validation.enabled = true;
      task.validation.successCriteria = ['Passed'];
      task.validation.requireManualReview = false;

      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.validation?.passed).toBe(false);
    });
  });

  describe('execution tracking', () => {
    it('should generate unique execution ID', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "test"',
        },
      });

      const execution = await executor.execute(task);

      expect(execution.id).toMatch(/^exec-\d+-[a-z0-9]+$/);
    });

    it('should track start and end time', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "test"',
        },
      });

      const beforeStart = Date.now();
      const execution = await executor.execute(task);
      const afterEnd = Date.now();

      expect(execution.startTime).toBeGreaterThanOrEqual(beforeStart);
      expect(execution.endTime).toBeGreaterThanOrEqual(execution.startTime);
      expect(execution.endTime).toBeLessThanOrEqual(afterEnd);
      expect(execution.duration).toBe(execution.endTime - execution.startTime);
    });

    it('should set retry count to 0 initially', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "test"',
        },
      });

      const execution = await executor.execute(task);

      expect(execution.retryCount).toBe(0);
    });
  });

  describe('getExecution', () => {
    it('should return execution by ID', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'echo "test"',
        },
      });

      const execution = await executor.execute(task);
      const retrieved = executor.getExecution(execution.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(execution.id);
      expect(retrieved?.status).toBe(execution.status);
    });

    it('should return undefined for non-existent execution', () => {
      const retrieved = executor.getExecution('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllExecutions', () => {
    it('should return all executions', async () => {
      const task1 = createTask('script', {
        script: { language: 'bash', script: 'echo "test1"' },
      });
      const task2 = createTask('script', {
        script: { language: 'bash', script: 'echo "test2"' },
      });

      await executor.execute(task1);
      await executor.execute(task2);

      const allExecutions = executor.getAllExecutions();

      expect(allExecutions).toHaveLength(2);
    });

    it('should return empty array when no executions', () => {
      const allExecutions = executor.getAllExecutions();

      expect(allExecutions).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should capture execution error', async () => {
      const task = createTask('script', {
        script: {
          language: 'bash',
          script: 'invalid-command-that-does-not-exist',
        },
      });

      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.error).toBeDefined();
      expect(execution.output).toBeDefined();
    });

    it('should handle missing configuration', async () => {
      const task = createTask('script', {});

      const execution = await executor.execute(task);

      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('configuration is missing');
    });
  });
});