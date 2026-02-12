import { z } from 'zod';

// 消息类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// 工具执行结果
export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  metadata?: Record<string, any>;
}

// 工具定义
export interface Tool {
  id: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: any, context: ToolContext) => Promise<ToolExecuteResult>;
}

// 工具执行结果
export interface ToolExecuteResult {
  output: string;
  metadata?: Record<string, any>;
}

// 工具上下文
export interface ToolContext {
  sessionId: string;
  messageId: string;
  workingDir: string;
}

// 会话
export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  lastCompression?: CompressionResult;
}

// 压缩配置
export interface CompressionConfig {
  enabled: boolean;
  threshold: number; // 触发压缩的百分比阈值 (默认 75%)
  strategy: 'summary' | 'sliding-window' | 'importance';
  preserveToolHistory: boolean;
  preserveRecentMessages: number; // 保留最近的消息数量
  notifyBeforeCompression: boolean;
}

// 压缩结果
export interface CompressionResult {
  compressed: boolean;
  strategy: string;
  originalTokenCount: number;
  compressedTokenCount: number;
  reductionPercentage: number;
  summary?: string;
  message: string;
  compressedMessages?: Message[];
}

// Rate Limit配置
export interface RateLimitConfig {
  enabled: boolean;
  maxRequestsPerHour: number; // 每小时最大请求数
  maxRequestsPerMinute: number; // 每分钟最大请求数
  maxConcurrentRequests: number; // 最大并发请求数
  queueInterval: number; // 队列处理间隔（毫秒）
}

// 配置
export interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  workingDir: string;
  compression?: CompressionConfig;
  rateLimit?: RateLimitConfig;
}
