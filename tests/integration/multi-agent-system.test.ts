import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiAgentSystem } from '../../src/multi-agent-system.js';
import { DeveloperAgent } from '../../src/agents/developer-agent.js';
import { TesterAgent } from '../../src/agents/tester-agent.js';
import { ProductAgent } from '../../src/agents/product-agent.js';
import { OperationsAgent } from '../../src/agents/operations-agent.js';
import { Task } from '../../src/web-types.js';

describe('MultiAgent System Integration', () => {
  let system: MultiAgentSystem;

  beforeEach(async () => {
    system = new MultiAgentSystem();
    await system.initialize();
  });

  afterEach(() => {
    system.getRegistry().clear();
    system.getOrchestrator().clearExecutionHistory();
  });

  describe('System Initialization', () => {
    it('should initialize with default agents', async () => {
      const status = system.getSystemStatus();

      expect(status.agents.length).toBeGreaterThan(0);
      expect(status.registry.total).toBeGreaterThan(0);
    });

    it('should register different agent types', () => {
      const status = system.getSystemStatus();
      const roles = new Set(status.agents.map((a: any) => a.role));

      expect(roles.has('developer')).toBe(true);
      expect(roles.has('tester')).toBe(true);
      expect(roles.has('product')).toBe(true);
      expect(roles.has('operations')).toBe(true);
    });

    it('should have agents available initially', () => {
      const status = system.getSystemStatus();

      expect(status.registry.available).toBeGreaterThan(0);
      expect(status.registry.busy).toBe(0);
    });
  });

  describe('Task Execution - Developer Agent', () => {
    it('should execute development task successfully', async () => {
      const task: Task = {
        id: 'dev-task-1',
        name: 'Run Build',
        description: 'Build the project',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'echo "Build successful"',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await system.executeTask(task, undefined, 'developer');

      if (!result.success) {
        console.log('Result:', result);
        console.log('Error:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.agentId).toContain('agent-developer');
      expect(result.output).toContain('Build successful');
    });

    it('should route to correct developer agent', async () => {
      const task: Task = {
        id: 'dev-task-2',
        name: 'Code Review',
        description: 'Review code',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'echo "Code reviewed"',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await system.executeTask(task, 'agent-developer-2');

      expect(result.agentId).toBe('agent-developer-2');
    });
  });

  describe('Task Execution - Tester Agent', () => {
    it('should execute testing task successfully', async () => {
      const task: Task = {
        id: 'test-task-1',
        name: 'Run Tests',
        description: 'Run unit tests',
        type: 'script',
        config: {
          script: {
            language: 'bash',
            script: 'echo "PASS: Test 1"',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await system.executeTask(task, undefined, 'tester');

      expect(result.success).toBe(true);
      expect(result.agentId).toContain('agent-tester');
      expect(result.output).toContain('Test Execution Summary');
    });
  });

  describe('Task Execution - Product Agent', () => {
    it('should execute product task successfully', async () => {
      const task: Task = {
        id: 'product-task-1',
        name: 'Create User Story',
        description: 'Create user story for feature',
        type: 'custom',
        config: {
          custom: {
            taskType: 'user-story',
            title: 'User Registration',
            role: 'user',
            want: 'to register an account',
            benefit: 'I can use the application',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await system.executeTask(task, undefined, 'product');

      expect(result.success).toBe(true);
      expect(result.agentId).toContain('agent-product');
      expect(result.output).toContain('User Story');
    });
  });

  describe('Task Execution - Operations Agent', () => {
    it('should execute operations task successfully', async () => {
      const task: Task = {
        id: 'ops-task-1',
        name: 'Deploy Service',
        description: 'Deploy service to production',
        type: 'custom',
        config: {
          custom: {
            opsType: 'deploy',
            serviceName: 'my-service',
            version: 'v1.0.0',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await system.executeTask(task, undefined, 'operations');

      expect(result.success).toBe(true);
      expect(result.agentId).toContain('agent-operations');
      expect(result.output).toContain('Deployment Summary');
    });

    it('should record deployed services', async () => {
      const task: Task = {
        id: 'ops-task-2',
        name: 'Deploy Service',
        description: 'Deploy service',
        type: 'custom',
        config: {
          custom: {
            opsType: 'deploy',
            serviceName: 'test-service',
            version: 'v1.0.0',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await system.executeTask(task, undefined, 'operations');

      const opsAgent = system.getRegistry().getAgentByRole('operations')![0] as OperationsAgent;
      const services = opsAgent.getDeployedServices();

      expect(services.length).toBeGreaterThan(0);
      expect(services.some((s: any) => s.serviceName === 'test-service')).toBe(true);
    });
  });

  describe('Parallel Task Execution', () => {
    it('should execute multiple tasks in parallel', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          description: 'Task 1',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "Task 1"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
        {
          id: 'task-2',
          name: 'Task 2',
          description: 'Task 2',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "Task 2"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
        {
          id: 'task-3',
          name: 'Task 3',
          description: 'Task 3',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "Task 3"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
      ];

      const results = await system.executeParallelTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle mixed success and failure in parallel', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          name: 'Success',
          description: 'Success',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "OK"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
        {
          id: 'task-2',
          name: 'Failure',
          description: 'Failure',
          type: 'script',
          config: { script: { language: 'bash', script: 'exit 1' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
      ];

      const results = await system.executeParallelTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Sequential Task Execution', () => {
    it('should execute tasks sequentially', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          name: 'First',
          description: 'First',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "First"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
        {
          id: 'task-2',
          name: 'Second',
          description: 'Second',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "Second"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
      ];

      const results = await system.executeSequentialTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop on failure by default', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          name: 'Fail',
          description: 'Fail',
          type: 'script',
          config: { script: { language: 'bash', script: 'exit 1' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
        {
          id: 'task-2',
          name: 'Never Runs',
          description: 'Never Runs',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "Should not run"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
      ];

      const results = await system.executeSequentialTasks(tasks);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('should continue on failure when configured', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          name: 'Fail',
          description: 'Fail',
          type: 'script',
          config: { script: { language: 'bash', script: 'exit 1' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
          metadata: { continueOnError: true },
        },
        {
          id: 'task-2',
          name: 'Success',
          description: 'Success',
          type: 'script',
          config: { script: { language: 'bash', script: 'echo "Success"' } },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'test',
        },
      ];

      const results = await system.executeSequentialTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Agent Communication', () => {
    it('should broadcast message to all agents', async () => {
      const before = await system.executeTask({
        id: 'task-1',
        name: 'Test',
        description: 'Test',
        type: 'script',
        config: { script: { language: 'bash', script: 'echo "test"' } },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      });

      await system.getOrchestrator().broadcastMessage({
        from: 'orchestrator',
        to: 'all',
        content: 'Broadcast message',
      });

      expect(before.success).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track execution metrics', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Test',
        description: 'Test',
        type: 'script',
        config: { script: { language: 'bash', script: 'echo "test"' } },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await system.executeTask(task);

      const performance = system.getSystemStatus().performance;

      expect(performance.totalTasks).toBe(1);
      expect(performance.successRate).toBe(100);
    });

    it('should calculate correct success rate', async () => {
      const successTask: Task = {
        id: 'task-1',
        name: 'Success',
        description: 'Success',
        type: 'script',
        config: { script: { language: 'bash', script: 'echo "OK"' } },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const failTask: Task = {
        id: 'task-2',
        name: 'Fail',
        description: 'Fail',
        type: 'script',
        config: { script: { language: 'bash', script: 'exit 1' } },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await system.executeTask(successTask);
      await system.executeTask(failTask);

      const performance = system.getSystemStatus().performance;

      expect(performance.totalTasks).toBe(2);
      expect(performance.successRate).toBe(50);
    });
  });

  describe('Workflow Integration - Complete Feature Development', () => {
    it('should execute complete feature workflow', async () => {
      const workflow: Task[] = [
        {
          id: 'req-analysis',
          name: 'Requirements Analysis',
          description: 'Analyze requirements',
          type: 'custom',
          config: {
            custom: {
              taskType: 'user-story',
              title: 'Feature X',
              role: 'user',
              want: 'to use feature X',
              benefit: 'I can accomplish Y',
            },
          },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'product',
        },
        {
          id: 'development',
          name: 'Implementation',
          description: 'Implement feature',
          type: 'script',
          config: {
            script: {
              language: 'bash',
              script: 'echo "Feature implemented"',
            },
          },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'developer',
        },
        {
          id: 'testing',
          name: 'Testing',
          description: 'Test feature',
          type: 'script',
          config: {
            script: {
              language: 'bash',
              script: 'echo "PASS: Feature tested"',
            },
          },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'tester',
        },
        {
          id: 'deployment',
          name: 'Deployment',
          description: 'Deploy feature',
          type: 'custom',
          config: {
            custom: {
              opsType: 'deploy',
              serviceName: 'feature-x',
              version: 'v1.0.0',
            },
          },
          validation: { enabled: false },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'operations',
        },
      ];

      const results = await system.executeSequentialTasks(workflow);

      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);

      expect(results[0].agentId).toContain('agent-product');
      expect(results[1].agentId).toContain('agent-developer');
      expect(results[2].agentId).toContain('agent-tester');
      expect(results[3].agentId).toContain('agent-operations');
    });
  });

  describe('System Status', () => {
    it('should provide comprehensive system status', async () => {
      const status = system.getSystemStatus();

      expect(status).toHaveProperty('registry');
      expect(status).toHaveProperty('performance');
      expect(status).toHaveProperty('agents');

      expect(status.registry).toHaveProperty('total');
      expect(status.registry).toHaveProperty('available');
      expect(status.registry).toHaveProperty('byRole');

      expect(status.performance).toHaveProperty('totalTasks');
      expect(status.performance).toHaveProperty('successRate');
      expect(status.performance).toHaveProperty('agentPerformance');

      expect(Array.isArray(status.agents)).toBe(true);
    });
  });
});