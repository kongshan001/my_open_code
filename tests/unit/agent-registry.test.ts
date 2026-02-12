import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentRegistry } from '../../src/agent-registry.js';
import { BaseAgent } from '../../src/agent-base.js';
import { AgentConfig, AgentStatus } from '../../src/agent-types.js';

class MockAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async execute(task: any): Promise<any> {
    return {
      success: true,
      output: 'Mock execution',
      duration: 100,
      timestamp: Date.now(),
      agentId: this.id,
    };
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let mockAgent: MockAgent;
  let config: AgentConfig;

  beforeEach(() => {
    registry = new AgentRegistry();
    config = {
      id: 'test-agent-1',
      name: 'Test Agent',
      role: 'developer',
      description: 'A test agent',
      systemPrompt: 'You are a test agent',
      tools: ['bash', 'read'],
      capabilities: [
        { id: 'test', name: 'Test Capability', description: 'Test', enabled: true },
      ],
      priority: 'medium',
      maxConcurrentTasks: 3,
      timeout: 30000,
    };
    mockAgent = new MockAgent(config);
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('should register a new agent', () => {
      registry.register(mockAgent);

      expect(registry.hasAgent('test-agent-1')).toBe(true);
      expect(registry.getAgent('test-agent-1')).toBe(mockAgent);
    });

    it('should throw error when registering duplicate agent', () => {
      registry.register(mockAgent);

      expect(() => {
        registry.register(mockAgent);
      }).toThrow('Agent with ID test-agent-1 already registered');
    });

    it('should maintain role index', () => {
      registry.register(mockAgent);

      const agentsByRole = registry.getAgentsByRole('developer');
      expect(agentsByRole).toHaveLength(1);
      expect(agentsByRole[0]).toBe(mockAgent);
    });
  });

  describe('unregister', () => {
    it('should unregister an existing agent', () => {
      registry.register(mockAgent);
      registry.unregister('test-agent-1');

      expect(registry.hasAgent('test-agent-1')).toBe(false);
    });

    it('should throw error when unregistering non-existent agent', () => {
      expect(() => {
        registry.unregister('non-existent');
      }).toThrow('Agent with ID non-existent not found');
    });

    it('should remove from role index', () => {
      registry.register(mockAgent);
      registry.unregister('test-agent-1');

      const agentsByRole = registry.getAgentsByRole('developer');
      expect(agentsByRole).toHaveLength(0);
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', () => {
      registry.register(mockAgent);

      const agent = registry.getAgent('test-agent-1');
      expect(agent).toBe(mockAgent);
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAgentByName', () => {
    it('should return agent by name', () => {
      registry.register(mockAgent);

      const agent = registry.getAgentByName('Test Agent');
      expect(agent).toBe(mockAgent);
    });

    it('should return undefined for non-existent agent name', () => {
      const agent = registry.getAgentByName('Non Existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAgentsByRole', () => {
    it('should return all agents of a specific role', () => {
      const devAgent = new MockAgent({ ...config, id: 'dev-1', role: 'developer' });
      const testAgent = new MockAgent({ ...config, id: 'test-1', role: 'tester' });
      const devAgent2 = new MockAgent({ ...config, id: 'dev-2', role: 'developer' });

      registry.register(devAgent);
      registry.register(testAgent);
      registry.register(devAgent2);

      const devAgents = registry.getAgentsByRole('developer');
      expect(devAgents).toHaveLength(2);
      expect(devAgents.map(a => a.id)).toEqual(['dev-1', 'dev-2']);
    });

    it('should return empty array for non-existent role', () => {
      const agents = registry.getAgentsByRole('non-existent');
      expect(agents).toEqual([]);
    });
  });

  describe('getAvailableAgents', () => {
    it('should return all available agents', () => {
      const idleAgent = new MockAgent({ ...config, id: 'idle-1', status: 'idle' as AgentStatus });
      const busyAgent = new MockAgent({ ...config, id: 'busy-1', status: 'busy' as AgentStatus });

      registry.register(idleAgent);
      registry.register(busyAgent);

      const available = registry.getAvailableAgents();
      expect(available).toHaveLength(1);
      expect(available[0]).toBe(idleAgent);
    });

    it('should return empty array when no agents available', () => {
      const busyAgent = new MockAgent({ ...config, id: 'busy-1', status: 'busy' as AgentStatus });
      registry.register(busyAgent);

      const available = registry.getAvailableAgents();
      expect(available).toEqual([]);
    });
  });

  describe('getAvailableAgentsByRole', () => {
    it('should return available agents by role', () => {
      const idleDev = new MockAgent({ ...config, id: 'idle-dev', role: 'developer' });
      const busyDev = new MockAgent({ ...config, id: 'busy-dev', role: 'developer' });
      const idleTester = new MockAgent({ ...config, id: 'idle-tester', role: 'tester' });

      idleDev.status = 'idle';
      busyDev.status = 'busy';
      idleTester.status = 'idle';

      registry.register(idleDev);
      registry.register(busyDev);
      registry.register(idleTester);

      const availableDevs = registry.getAvailableAgentsByRole('developer');
      expect(availableDevs).toHaveLength(1);
      expect(availableDevs[0]).toBe(idleDev);
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      const agent1 = new MockAgent({ ...config, id: 'agent-1' });
      const agent2 = new MockAgent({ ...config, id: 'agent-2' });

      registry.register(agent1);
      registry.register(agent2);

      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(2);
      expect(allAgents.map(a => a.id)).toEqual(['agent-1', 'agent-2']);
    });

    it('should return empty array when no agents registered', () => {
      const allAgents = registry.getAllAgents();
      expect(allAgents).toEqual([]);
    });
  });

  describe('hasAgent', () => {
    it('should return true for registered agent', () => {
      registry.register(mockAgent);

      expect(registry.hasAgent('test-agent-1')).toBe(true);
    });

    it('should return false for non-registered agent', () => {
      expect(registry.hasAgent('non-existent')).toBe(false);
    });
  });

  describe('getAgentCount', () => {
    it('should return correct count of registered agents', () => {
      registry.register(mockAgent);
      registry.register(new MockAgent({ ...config, id: 'agent-2' }));

      expect(registry.getAgentCount()).toBe(2);
    });

    it('should return 0 when no agents registered', () => {
      expect(registry.getAgentCount()).toBe(0);
    });
  });

  describe('getAgentCountByRole', () => {
    it('should return correct count for specific role', () => {
      registry.register(new MockAgent({ ...config, id: 'dev-1', role: 'developer' }));
      registry.register(new MockAgent({ ...config, id: 'dev-2', role: 'developer' }));
      registry.register(new MockAgent({ ...config, id: 'test-1', role: 'tester' }));

      expect(registry.getAgentCountByRole('developer')).toBe(2);
      expect(registry.getAgentCountByRole('tester')).toBe(1);
    });

    it('should return 0 for non-existent role', () => {
      expect(registry.getAgentCountByRole('non-existent')).toBe(0);
    });
  });

  describe('getAvailableAgentCount', () => {
    it('should return count of available agents', () => {
      const idleAgent = new MockAgent({ ...config, id: 'idle-1' });
      const busyAgent = new MockAgent({ ...config, id: 'busy-1' });

      idleAgent.status = 'idle';
      busyAgent.status = 'busy';

      registry.register(idleAgent);
      registry.register(busyAgent);

      expect(registry.getAvailableAgentCount()).toBe(1);
    });
  });

  describe('initializeAll', () => {
    it('should initialize all registered agents', async () => {
      const initSpy = vi.spyOn(mockAgent, 'initialize');
      const agent2 = new MockAgent({ ...config, id: 'agent-2' });
      const initSpy2 = vi.spyOn(agent2, 'initialize');

      registry.register(mockAgent);
      registry.register(agent2);

      await registry.initializeAll();

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should clear all agents', () => {
      registry.register(mockAgent);
      registry.register(new MockAgent({ ...config, id: 'agent-2' }));

      registry.clear();

      expect(registry.getAgentCount()).toBe(0);
      expect(registry.getAgentsByRole('developer')).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status', () => {
      const idleDev = new MockAgent({ ...config, id: 'idle-dev', role: 'developer' });
      const busyDev = new MockAgent({ ...config, id: 'busy-dev', role: 'developer' });
      const errorAgent = new MockAgent({ ...config, id: 'error-1', role: 'tester' });
      const offlineAgent = new MockAgent({ ...config, id: 'offline-1', role: 'product' });

      idleDev.status = 'idle';
      busyDev.status = 'busy';
      errorAgent.status = 'error';
      offlineAgent.status = 'offline';

      registry.register(idleDev);
      registry.register(busyDev);
      registry.register(errorAgent);
      registry.register(offlineAgent);

      const status = registry.getStatus();

      expect(status.total).toBe(4);
      expect(status.available).toBe(1);
      expect(status.busy).toBe(1);
      expect(status.error).toBe(1);
      expect(status.offline).toBe(1);
      expect(status.byRole.developer).toBe(2);
      expect(status.byRole.tester).toBe(1);
      expect(status.byRole.product).toBe(1);
    });

    it('should return empty status when no agents', () => {
      const status = registry.getStatus();

      expect(status.total).toBe(0);
      expect(status.available).toBe(0);
      expect(status.busy).toBe(0);
      expect(status.error).toBe(0);
      expect(status.offline).toBe(0);
      expect(status.byRole).toEqual({});
    });
  });
});