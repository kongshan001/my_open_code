import { Agent, AgentConfig, AgentStatus, AgentMetrics, AgentCapability, AgentMessage, AgentExecutionResult, AgentRole } from './agent-types.js';
import { Tool, ToolContext } from './tool.js';
import { Task } from './web-types.js';

export abstract class BaseAgent implements Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus = 'idle';
  config: AgentConfig;
  metrics: AgentMetrics;
  protected messageQueue: Map<string, AgentMessage[]> = new Map();
  
  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.config = config;
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successRate: 100,
      lastActive: Date.now(),
    };
  }

  async initialize(): Promise<void> {
    console.log(`[${this.name}] Initializing agent...`);
    this.status = 'idle';
    this.metrics.lastActive = Date.now();
  }

  abstract execute(task: Task): Promise<AgentExecutionResult>;

  async sendMessage(message: AgentMessage): Promise<void> {
    if (!this.messageQueue.has(message.to)) {
      this.messageQueue.set(message.to, []);
    }
    this.messageQueue.get(message.to)!.push(message);
  }

  async receiveMessage(message: AgentMessage): Promise<void> {
    console.log(`[${this.name}] Received message from ${message.from}: ${message.type}`);
    
    if (message.taskData) {
      await this.execute(message.taskData);
    }
  }

  updateStatus(status: AgentStatus): void {
    this.status = status;
    console.log(`[${this.name}] Status updated to: ${status}`);
  }

  updateMetrics(result: AgentExecutionResult): void {
    if (result.success) {
      this.metrics.tasksCompleted++;
    } else {
      this.metrics.tasksFailed++;
    }
    
    this.metrics.totalExecutionTime += result.duration;
    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed;
    this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / totalTasks;
    
    if (totalTasks > 0) {
      this.metrics.successRate = (this.metrics.tasksCompleted / totalTasks) * 100;
    }
    
    this.metrics.lastActive = Date.now();
  }

  getCapabilities(): AgentCapability[] {
    return this.config.capabilities.filter(cap => cap.enabled);
  }

  isAvailable(): boolean {
    return this.status === 'idle';
  }

  protected generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected getToolContext(task: Task): ToolContext {
    return {
      sessionId: `agent-${this.id}`,
      messageId: this.generateMessageId(),
      workingDir: process.cwd(),
    };
  }

  protected createExecutionResult(
    success: boolean,
    output: string,
    startTime: number,
    error?: string
  ): AgentExecutionResult {
    return {
      success,
      output,
      error,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      agentId: this.id,
    };
  }
}