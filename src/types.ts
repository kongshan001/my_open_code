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
}

// 配置
export interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  workingDir: string;
}
