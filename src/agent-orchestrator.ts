import { Agent, AgentMessage, AgentExecutionResult, AgentRole, AgentRoutingStrategy } from './agent-types.js';
import { Task } from './web-types.js';
import { AgentRegistry } from './agent-registry.js';

export class PriorityBasedRouting implements AgentRoutingStrategy {
  selectAgent(agents: Agent[], task: Task): Agent | null {
    if (agents.length === 0) return null;
    
    return agents.reduce((best, current) => {
      return current.config.priority >= best.config.priority ? current : best;
    });
  }
}

export class LoadBalancingRouting implements AgentRoutingStrategy {
  selectAgent(agents: Agent[], task: Task): Agent | null {
    if (agents.length === 0) return null;
    
    return agents.reduce((best, current) => {
      return current.metrics.tasksCompleted <= best.metrics.tasksCompleted 
        ? current 
        : best;
    });
  }
}

export class AgentOrchestrator {
  private registry: AgentRegistry;
  private routingStrategy: AgentRoutingStrategy;
  private taskQueue: Map<string, Task> = new Map();
  private executionHistory: AgentExecutionResult[] = [];

  constructor(registry: AgentRegistry, strategy: AgentRoutingStrategy = new PriorityBasedRouting()) {
    this.registry = registry;
    this.routingStrategy = strategy;
  }

  async executeTask(task: Task, preferredAgentId?: string, preferredRole?: AgentRole): Promise<AgentExecutionResult> {
    let agent: Agent | null = null;

    if (preferredAgentId) {
      agent = this.registry.getAgent(preferredAgentId) || null;
      if (agent && !agent.isAvailable()) {
        console.warn(`Preferred agent ${agent.name} is not available`);
        agent = null;
      }
    }

    if (!agent && preferredRole) {
      const availableAgents = this.registry.getAvailableAgentsByRole(preferredRole);
      agent = this.routingStrategy.selectAgent(availableAgents, task) || null;
    }

    if (!agent) {
      const availableAgents = this.registry.getAvailableAgents();
      agent = this.routingStrategy.selectAgent(availableAgents, task);
    }

    if (!agent) {
      return {
        success: false,
        output: '',
        error: 'No available agents to execute task',
        duration: 0,
        timestamp: Date.now(),
        agentId: 'none',
      };
    }

    agent.updateStatus('busy');
    console.log(`🚀 Orchestrating task ${task.id} to ${agent.name}`);

    try {
      const result = await agent.execute(task);
      agent.updateMetrics(result);
      this.executionHistory.push(result);
      agent.updateStatus('idle');
      return result;
    } catch (error: any) {
      const errorResult: AgentExecutionResult = {
        success: false,
        output: '',
        error: error.message,
        duration: 0,
        timestamp: Date.now(),
        agentId: agent.id,
      };
      agent.updateMetrics(errorResult);
      this.executionHistory.push(errorResult);
      agent.updateStatus('error');
      return errorResult;
    }
  }

  async executeParallelTasks(tasks: Task[]): Promise<AgentExecutionResult[]> {
    const promises = tasks.map(task => this.executeTask(task));
    return Promise.all(promises);
  }

  async executeSequentialTasks(tasks: Task[]): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];
    
    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);
      
      if (!result.success && !task.config.custom?.continueOnError) {
        break;
      }
    }
    
    return results;
  }

  async broadcastMessage(message: Omit<AgentMessage, 'id' | 'timestamp' | 'type'>): Promise<void> {
    const agents = this.registry.getAllAgents();
    const fullMessage: AgentMessage = {
      ...message,
      id: `broadcast-${Date.now()}`,
      type: 'broadcast',
      timestamp: Date.now(),
    };

    await Promise.all(
      agents.map(agent => agent.receiveMessage(fullMessage))
    );
  }

  async sendMessage(fromAgent: Agent, toAgentId: string, content: string, taskData?: Task): Promise<void> {
    const toAgent = this.registry.getAgent(toAgentId);
    if (!toAgent) {
      throw new Error(`Agent with ID ${toAgentId} not found`);
    }

    const message: AgentMessage = {
      id: `${fromAgent.id}-${toAgentId}-${Date.now()}`,
      from: fromAgent.id,
      to: toAgentId,
      type: 'request',
      content,
      timestamp: Date.now(),
      taskData,
    };

    await toAgent.receiveMessage(message);
  }

  setRoutingStrategy(strategy: AgentRoutingStrategy): void {
    this.routingStrategy = strategy;
  }

  getExecutionHistory(): AgentExecutionResult[] {
    return [...this.executionHistory];
  }

  getExecutionHistoryByAgent(agentId: string): AgentExecutionResult[] {
    return this.executionHistory.filter(r => r.agentId === agentId);
  }

  clearExecutionHistory(): void {
    this.executionHistory = [];
  }

  getPerformanceMetrics(): {
    totalTasks: number;
    successRate: number;
    averageExecutionTime: number;
    agentPerformance: Record<string, {
      tasksCompleted: number;
      successRate: number;
      averageExecutionTime: number;
    }>;
  } {
    const totalTasks = this.executionHistory.length;
    const successfulTasks = this.executionHistory.filter(r => r.success).length;
    const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;
    const totalTime = this.executionHistory.reduce((sum, r) => sum + r.duration, 0);
    const averageExecutionTime = totalTasks > 0 ? totalTime / totalTasks : 0;

    const agentPerformance: Record<string, any> = {};
    this.registry.getAllAgents().forEach(agent => {
      const history = this.getExecutionHistoryByAgent(agent.id);
      const agentTotalTasks = history.length;
      const agentSuccessfulTasks = history.filter(r => r.success).length;
      const agentTotalTime = history.reduce((sum, r) => sum + r.duration, 0);

      agentPerformance[agent.id] = {
        tasksCompleted: agentTotalTasks,
        successRate: agentTotalTasks > 0 ? (agentSuccessfulTasks / agentTotalTasks) * 100 : 0,
        averageExecutionTime: agentTotalTasks > 0 ? agentTotalTime / agentTotalTasks : 0,
      };
    });

    return {
      totalTasks,
      successRate,
      averageExecutionTime,
      agentPerformance,
    };
  }
}