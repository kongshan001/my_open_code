import { Tool } from './types.js';
import { Task } from './web-types.js';

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';
export type AgentPriority = 'low' | 'medium' | 'high' | 'critical';
export type AgentRole = 'developer' | 'tester' | 'product' | 'operations' | 'custom';

export interface AgentRoutingStrategy {
  selectAgent(agents: Agent[], task: Task): Agent | null;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  successRate: number;
  lastActive: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  tools: string[];
  capabilities: AgentCapability[];
  priority: AgentPriority;
  maxConcurrentTasks: number;
  timeout: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast';
  content: string;
  timestamp: number;
  taskData?: Task;
  metadata?: Record<string, any>;
}

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  timestamp: number;
  agentId: string;
  artifacts?: any[];
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  config: AgentConfig;
  metrics: AgentMetrics;
  
  initialize(): Promise<void>;
  execute(task: Task): Promise<AgentExecutionResult>;
  sendMessage(message: AgentMessage): Promise<void>;
  receiveMessage(message: AgentMessage): Promise<void>;
  updateStatus(status: AgentStatus): void;
  updateMetrics(result: AgentExecutionResult): void;
  getCapabilities(): AgentCapability[];
  isAvailable(): boolean;
}