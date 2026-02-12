import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentOrchestrator, PriorityBasedRouting, LoadBalancingRouting } from '../../src/agent-orchestrator.js';
import { AgentRegistry } from '../../src/agent-registry.js';
import { BaseAgent } from '../../src/agent-base.js';
import { AgentConfig, AgentStatus } from '../../src/agent-types.js';
import { Task } from '../../src/web-types.js';

class MockAgent extends BaseAgent {
  executeSpy = vi.fn();
  failExecution = false;

  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(task: Task): Promise<any> {
    this.executeSpy(task);
    
    if (this.failExecution) {
      throw new Error('Failed');
    }
    
    return {
      success: true,
      output: 'Mock execution',
      duration: 100,
      timestamp: Date.now(),
      agentId: this.id,
    };
  }
}

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let registry: AgentRegistry;
  let agent1: MockAgent;
  let agent2: MockAgent;
  let agent3: MockAgent;

  const createConfig = (id: string, role: string, priority: string, status: AgentStatus = 'idle'): AgentConfig => ({
    id,
    name: `Agent ${id}`,
    role: role as any,
    description: 'A test agent',
    systemPrompt: 'You are a test agent',
    tools: ['bash', 'read'],
    capabilities: [{ id: 'test', name: 'Test', description: 'Test', enabled: true }],
    priority: priority as any,
    maxConcurrentTasks: 3,
    timeout: 30000,
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
    registry = new AgentRegistry();
    orchestrator = new AgentOrchestrator(registry, new PriorityBasedRouting());

    agent1 = new MockAgent(createConfig('agent-1', 'developer', 'high', 'idle'));
    agent2 = new MockAgent(createConfig('agent-2', 'developer', 'medium', 'idle'));
    agent3 = new MockAgent(createConfig('agent-3', 'tester', 'high', 'idle'));

    registry.register(agent1);
    registry.register(agent2);
    registry.register(agent3);
  });

  afterEach(() => {
    registry.clear();
    orchestrator.clearExecutionHistory();
  });

  describe('executeTask', () => {
    it('should execute task on selected agent', async () => {
      const task = createTask('task-1');
      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('agent-1');
      expect(agent1.executeSpy).toHaveBeenCalledWith(task);
    });

    it('should prefer high priority agent with priority-based routing', async () => {
      const task = createTask('task-1');
      await orchestrator.executeTask(task);

      expect(agent1.executeSpy).toHaveBeenCalled();
    });

    it('should use preferred agent if specified and available', async () => {
      const task = createTask('task-1');
      const result = await orchestrator.executeTask(task, 'agent-2');

      expect(result.agentId).toBe('agent-2');
      expect(agent2.executeSpy).toHaveBeenCalledWith(task);
      expect(agent1.executeSpy).not.toHaveBeenCalled();
    });

    it('should fallback to other agents if preferred agent is busy', async () => {
      agent1.updateStatus('busy');
      agent2.updateStatus('busy');

      const task = createTask('task-1');
      const result = await orchestrator.executeTask(task, 'agent-1');

      expect(result.agentId).toBe('agent-3');
      expect(agent3.executeSpy).toHaveBeenCalledWith(task);
    });

    it('should use preferred role if specified', async () => {
      const task = createTask('task-1');
      const result = await orchestrator.executeTask(task, undefined, 'tester');

      expect(result.agentId).toBe('agent-3');
      expect(agent3.executeSpy).toHaveBeenCalledWith(task);
    });

    it('should handle task execution error', async () => {
      agent1.failExecution = true;

      const task = createTask('task-1');
      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed');
      expect(agent1.status).toBe('error');
      
      agent1.failExecution = false;
    });

    it('should return error result when no agents available', async () => {
      agent1.updateStatus('busy');
      agent2.updateStatus('busy');
      agent3.updateStatus('busy');

      const task = createTask('task-1');
      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No available agents to execute task');
      expect(result.agentId).toBe('none');
    });

    it('should update agent status to busy during execution', async () => {
      const task = createTask('task-1');

      const promise = orchestrator.executeTask(task);
      expect(agent1.status).toBe('busy');

      await promise;
      expect(agent1.status).toBe('idle');
    });

    it('should record execution history', async () => {
      const task = createTask('task-1');
      await orchestrator.executeTask(task);

      const history = orchestrator.getExecutionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].agentId).toBe('agent-1');
    });
  });

  describe('executeParallelTasks', () => {
    it('should execute multiple tasks in parallel', async () => {
      const tasks = [createTask('task-1'), createTask('task-2'), createTask('task-3')];
      const results = await orchestrator.executeParallelTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should execute tasks on different agents when possible', async () => {
      const tasks = [createTask('task-1'), createTask('task-2'), createTask('task-3')];
      await orchestrator.executeParallelTasks(tasks);

      expect(agent1.executeSpy).toHaveBeenCalled();
      expect(agent2.executeSpy).toHaveBeenCalled();
      expect(agent3.executeSpy).toHaveBeenCalled();
    });

    it('should handle mixed success and failure', async () => {
      agent2.failExecution = true;

      const tasks = [createTask('task-1'), createTask('task-2'), createTask('task-3')];
      const results = await orchestrator.executeParallelTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      
      agent2.failExecution = false;
    });
  });

  describe('executeSequentialTasks', () => {
    it('should execute tasks sequentially', async () => {
      const tasks = [createTask('task-1'), createTask('task-2'), createTask('task-3')];
      const results = await orchestrator.executeSequentialTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop on failure if continueOnError is not set', async () => {
      agent1.failExecution = true;

      const tasks = [createTask('task-1'), createTask('task-2'), createTask('task-3')];
      const results = await orchestrator.executeSequentialTasks(tasks);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(agent2.executeSpy).not.toHaveBeenCalled();
      
      agent1.failExecution = false;
    });

    it('should continue on failure if continueOnError is set', async () => {
      agent1.failExecution = true;
      const task1 = createTask('task-1');
      task1.config.custom = { continueOnError: true };

      const tasks = [task1, createTask('task-2'), createTask('task-3')];
      const results = await orchestrator.executeSequentialTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      
      agent1.failExecution = false;
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message to all agents', async () => {
      const receiveSpy1 = vi.spyOn(agent1, 'receiveMessage');
      const receiveSpy2 = vi.spyOn(agent2, 'receiveMessage');
      const receiveSpy3 = vi.spyOn(agent3, 'receiveMessage');

      await orchestrator.broadcastMessage({
        from: 'orchestrator',
        to: 'all',
        content: 'Test broadcast',
      });

      expect(receiveSpy1).toHaveBeenCalled();
      expect(receiveSpy2).toHaveBeenCalled();
      expect(receiveSpy3).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send message from one agent to another', async () => {
      const receiveSpy = vi.spyOn(agent2, 'receiveMessage');

      await orchestrator.sendMessage(agent1, 'agent-2', 'Test message');

      expect(receiveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'agent-1',
          to: 'agent-2',
          content: 'Test message',
        })
      );
    });

    it('should throw error when target agent does not exist', async () => {
      await expect(
        orchestrator.sendMessage(agent1, 'non-existent', 'Test message')
      ).rejects.toThrow('Agent with ID non-existent not found');
    });
  });

  describe('setRoutingStrategy', () => {
    it('should change routing strategy', async () => {
      orchestrator.setRoutingStrategy(new LoadBalancingRouting());

      const tasks = [createTask('task-1'), createTask('task-2')];
      await orchestrator.executeParallelTasks(tasks);

      expect(agent1.executeSpy).toHaveBeenCalled();
      expect(agent2.executeSpy).toHaveBeenCalled();
    });
  });

  describe('getExecutionHistory', () => {
    it('should return all execution history', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');

      await orchestrator.executeTask(task1);
      await orchestrator.executeTask(task2);

      const history = orchestrator.getExecutionHistory();
      expect(history).toHaveLength(2);
    });

    it('should return copy of history', async () => {
      const task = createTask('task-1');
      await orchestrator.executeTask(task);

      const history = orchestrator.getExecutionHistory();
      history.push({} as any);

      expect(orchestrator.getExecutionHistory()).toHaveLength(1);
    });
  });

  describe('getExecutionHistoryByAgent', () => {
    it('should return execution history for specific agent', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      const task3 = createTask('task-3');

      await orchestrator.executeTask(task1);
      await orchestrator.executeTask(task2, 'agent-2');
      await orchestrator.executeTask(task3, 'agent-1');

      const agent1History = orchestrator.getExecutionHistoryByAgent('agent-1');
      const agent2History = orchestrator.getExecutionHistoryByAgent('agent-2');

      expect(agent1History).toHaveLength(2);
      expect(agent2History).toHaveLength(1);
    });

    it('should return empty array for agent with no history', () => {
      const history = orchestrator.getExecutionHistoryByAgent('agent-3');
      expect(history).toEqual([]);
    });
  });

  describe('clearExecutionHistory', () => {
    it('should clear all execution history', async () => {
      const task = createTask('task-1');
      await orchestrator.executeTask(task);

      orchestrator.clearExecutionHistory();

      expect(orchestrator.getExecutionHistory()).toHaveLength(0);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const task1 = createTask('task-1');
      const task2 = createTask('task-2');
      const task3 = createTask('task-3');

      agent2.failExecution = true;

      await orchestrator.executeTask(task1);
      await orchestrator.executeTask(task2, 'agent-2');
      await orchestrator.executeTask(task3);

      const metrics = orchestrator.getPerformanceMetrics();

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
      expect(metrics.agentPerformance['agent-1'].tasksCompleted).toBe(2);
      expect(metrics.agentPerformance['agent-2'].tasksCompleted).toBe(1);
      expect(metrics.agentPerformance['agent-1'].successRate).toBe(100);
      expect(metrics.agentPerformance['agent-2'].successRate).toBe(0);
      
      agent2.failExecution = false;
    });

    it('should return zero metrics when no tasks executed', () => {
      const metrics = orchestrator.getPerformanceMetrics();

      expect(metrics.totalTasks).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageExecutionTime).toBe(0);
    });
  });
});