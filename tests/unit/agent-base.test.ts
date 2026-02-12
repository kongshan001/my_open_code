import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../../src/agent-base.js';
import { AgentConfig, AgentStatus, AgentCapability, AgentMessage } from '../../src/agent-types.js';
import { Task } from '../../src/web-types.js';

class TestAgent extends BaseAgent {
  async execute(task: Task): Promise<any> {
    return {
      success: true,
      output: 'Test output',
      duration: 100,
      timestamp: Date.now(),
      agentId: this.id,
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: AgentConfig;

  const createConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
    id: 'test-agent-1',
    name: 'Test Agent',
    role: 'developer',
    description: 'A test agent',
    systemPrompt: 'You are a test agent',
    tools: ['bash', 'read'],
    capabilities: [
      { id: 'test-cap', name: 'Test Capability', description: 'A test capability', enabled: true },
      { id: 'disabled-cap', name: 'Disabled Capability', description: 'Disabled', enabled: false },
    ],
    priority: 'medium',
    maxConcurrentTasks: 3,
    timeout: 30000,
    ...overrides,
  });

  const createTask = (id: string): Task => ({
    id,
    name: `Task ${id}`,
    description: 'Test task',
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
  });

  beforeEach(() => {
    config = createConfig();
    agent = new TestAgent(config);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(agent.id).toBe('test-agent-1');
      expect(agent.name).toBe('Test Agent');
      expect(agent.role).toBe('developer');
      expect(agent.status).toBe('idle');
      expect(agent.config).toEqual(config);
    });

    it('should initialize metrics', () => {
      expect(agent.metrics).toEqual({
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successRate: 100,
        lastActive: expect.any(Number),
      });
    });

    it('should initialize empty message queue', () => {
      expect(agent['messageQueue']).toBeInstanceOf(Map);
    });
  });

  describe('initialize', () => {
    it('should set status to idle', async () => {
      agent.updateStatus('busy');
      await agent.initialize();

      expect(agent.status).toBe('idle');
    });

    it('should update lastActive timestamp', async () => {
      const before = agent.metrics.lastActive;
      await new Promise(resolve => setTimeout(resolve, 10));
      await agent.initialize();

      expect(agent.metrics.lastActive).toBeGreaterThan(before);
    });
  });

  describe('execute', () => {
    it('should set status to busy during execution', async () => {
      const task = createTask('task-1');
      
      agent.status = 'idle';
      const promise = agent.execute(task);

      expect(agent.status).toBe('idle');
      await promise;
      expect(agent.status).toBe('idle');
    });

    it('should return execution result', async () => {
      const task = createTask('task-1');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test output');
      expect(result.agentId).toBe('test-agent-1');
      expect(result.duration).toBe(100);
      expect(result.timestamp).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution errors', async () => {
      class FailingAgent extends TestAgent {
        async execute(task: Task): Promise<any> {
          throw new Error('Execution failed');
        }
      }

      const failingAgent = new FailingAgent(config);
      const task = createTask('task-1');
      const result = await failingAgent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should return to idle status after successful execution', async () => {
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

    it('should stay idle if initialize is not called', async () => {
      const newAgent = new TestAgent(config);
      const task = createTask('task-1');
      await newAgent.execute(task);

      expect(newAgent.status).toBe('idle');
    });
  });

    it('should return execution result', async () => {
      const task = createTask('task-1');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test output');
      expect(result.agentId).toBe('test-agent-1');
      expect(result.duration).toBe(100);
      expect(result.timestamp).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution errors', async () => {
      class FailingAgent extends TestAgent {
        async execute(task: Task): Promise<any> {
          throw new Error('Execution failed');
        }
      }

      const failingAgent = new FailingAgent(config);
      const task = createTask('task-1');
      const result = await failingAgent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should return to idle status after successful execution', async () => {
      const task = createTask('task-1');
      await agent.execute(task);

      expect(agent.status).toBe('idle');
    });

    it('should stay busy if initialize is not called', async () => {
      const newAgent = new TestAgent(config);
      const task = createTask('task-1');
      await newAgent.execute(task);

      expect(newAgent.status).toBe('busy');
    });
  });

  describe('sendMessage', () => {
    it('should add message to queue for target agent', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Test message',
        timestamp: Date.now(),
      };

      await agent.sendMessage(message);

      expect(agent['messageQueue'].has('agent-2')).toBe(true);
      const queue = agent['messageQueue'].get('agent-2');
      expect(queue).toHaveLength(1);
      expect(queue![0]).toBe(message);
    });

    it('should create queue if not exists', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Test message',
        timestamp: Date.now(),
      };

      await agent.sendMessage(message);

      expect(agent['messageQueue'].has('agent-2')).toBe(true);
    });

    it('should append to existing queue', async () => {
      const message1: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Message 1',
        timestamp: Date.now(),
      };

      const message2: AgentMessage = {
        id: 'msg-2',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Message 2',
        timestamp: Date.now(),
      };

      await agent.sendMessage(message1);
      await agent.sendMessage(message2);

      const queue = agent['messageQueue'].get('agent-2');
      expect(queue).toHaveLength(2);
      expect(queue![0]).toBe(message1);
      expect(queue![1]).toBe(message2);
    });
  });

  describe('receiveMessage', () => {
    it('should log message receipt', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Test message',
        timestamp: Date.now(),
      };

      await agent.receiveMessage(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        `[Test Agent] Received message from agent-1: request`
      );
    });

    it('should execute task if message contains task data', async () => {
      const task = createTask('task-1');
      const executeSpy = vi.spyOn(agent as any, 'execute');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Execute task',
        timestamp: Date.now(),
        taskData: task,
      };

      await agent.receiveMessage(message);

      expect(executeSpy).toHaveBeenCalledWith(task);
    });

    it('should not execute if no task data', async () => {
      const executeSpy = vi.spyOn(agent as any, 'execute');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        content: 'Just a message',
        timestamp: Date.now(),
      };

      await agent.receiveMessage(message);

      expect(executeSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update agent status', () => {
      agent.updateStatus('busy');

      expect(agent.status).toBe('busy');
    });

    it('should log status update', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      agent.updateStatus('busy');

      expect(consoleSpy).toHaveBeenCalledWith('[Test Agent] Status updated to: busy');
    });
  });

  describe('updateMetrics', () => {
    it('should increment tasks completed on success', () => {
      const result = {
        success: true,
        output: 'Success',
        duration: 100,
        timestamp: Date.now(),
        agentId: 'test-agent-1',
      };

      agent.updateMetrics(result);

      expect(agent.metrics.tasksCompleted).toBe(1);
      expect(agent.metrics.tasksFailed).toBe(0);
    });

    it('should increment tasks failed on failure', () => {
      const result = {
        success: false,
        output: '',
        error: 'Error',
        duration: 100,
        timestamp: Date.now(),
        agentId: 'test-agent-1',
      };

      agent.updateMetrics(result);

      expect(agent.metrics.tasksCompleted).toBe(0);
      expect(agent.metrics.tasksFailed).toBe(1);
    });

    it('should update total execution time', () => {
      const result = {
        success: true,
        output: 'Success',
        duration: 100,
        timestamp: Date.now(),
        agentId: 'test-agent-1',
      };

      agent.updateMetrics(result);

      expect(agent.metrics.totalExecutionTime).toBe(100);
    });

    it('should calculate average execution time', () => {
      const result1 = {
        success: true,
        output: 'Success',
        duration: 100,
        timestamp: Date.now(),
        agentId: 'test-agent-1',
      };

      const result2 = {
        success: true,
        output: 'Success',
        duration: 200,
        timestamp: Date.now(),
        agentId: 'test-agent-1',
      };

      agent.updateMetrics(result1);
      agent.updateMetrics(result2);

      expect(agent.metrics.averageExecutionTime).toBe(150);
    });

    it('should calculate success rate', () => {
      const result1 = { success: true, output: 'Success', duration: 100, timestamp: Date.now(), agentId: 'test-agent-1' };
      const result2 = { success: true, output: 'Success', duration: 100, timestamp: Date.now(), agentId: 'test-agent-1' };
      const result3 = { success: false, output: '', error: 'Error', duration: 100, timestamp: Date.now(), agentId: 'test-agent-1' };

      agent.updateMetrics(result1);
      agent.updateMetrics(result2);
      agent.updateMetrics(result3);

      expect(agent.metrics.successRate).toBeCloseTo(66.67, 1);
    });

    it('should update lastActive timestamp', async () => {
      const before = agent.metrics.lastActive;
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = {
        success: true,
        output: 'Success',
        duration: 100,
        timestamp: Date.now(),
        agentId: 'test-agent-1',
      };

      agent.updateMetrics(result);

      expect(agent.metrics.lastActive).toBeGreaterThan(before);
    });
  });

  describe('getCapabilities', () => {
    it('should return only enabled capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].id).toBe('test-cap');
    });

    it('should return empty array when all capabilities disabled', () => {
      const config = createConfig({
        capabilities: [
          { id: 'cap1', name: 'Cap 1', description: 'Cap 1', enabled: false },
          { id: 'cap2', name: 'Cap 2', description: 'Cap 2', enabled: false },
        ],
      });

      const agent = new TestAgent(config);
      const capabilities = agent.getCapabilities();

      expect(capabilities).toHaveLength(0);
    });
  });

  describe('isAvailable', () => {
    it('should return true when status is idle', () => {
      agent.updateStatus('idle');

      expect(agent.isAvailable()).toBe(true);
    });

    it('should return false when status is busy', () => {
      agent.updateStatus('busy');

      expect(agent.isAvailable()).toBe(false);
    });

    it('should return false when status is error', () => {
      agent.updateStatus('error');

      expect(agent.isAvailable()).toBe(false);
    });

    it('should return false when status is offline', () => {
      agent.updateStatus('offline');

      expect(agent.isAvailable()).toBe(false);
    });
  });

  describe('protected methods', () => {
    it('should generate unique message IDs', () => {
      const id1 = agent['generateMessageId']();
      const id2 = agent['generateMessageId']();

      expect(id1).toMatch(/^msg-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should create tool context', () => {
      const task = createTask('task-1');
      const context = agent['getToolContext'](task);

      expect(context).toEqual({
        sessionId: 'agent-test-agent-1',
        messageId: expect.stringMatching(/^msg-\d+-[a-z0-9]+$/),
        workingDir: process.cwd(),
      });
    });

    it('should create execution result', () => {
      const startTime = Date.now();
      const result = agent['createExecutionResult'](true, 'Output', startTime, undefined);

      expect(result).toEqual({
        success: true,
        output: 'Output',
        error: undefined,
        duration: expect.any(Number),
        timestamp: expect.any(Number),
        agentId: 'test-agent-1',
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});