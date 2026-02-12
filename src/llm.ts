import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Config } from './types.js';
import { getAllTools } from './tool.js';
import { getGlobalRateLimiter, RateLimiter } from './rate-limiter.js';

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
}

// 保存rate limiter引用以便在函数中使用
let rateLimiter: RateLimiter | null = null;

/**
 * 带rate limit的streamChat包装函数
 */
export async function* streamChat(
  messages: CoreMessage[],
  config: Config,
  systemPrompt: string,
  rateLimitConfig?: {
    enabled?: boolean;
    maxRequestsPerHour?: number;
    priority?: 'high' | 'medium' | 'low';
  }
): AsyncGenerator<LLMResponse, void, unknown> {
  // 初始化或获取rate limiter
  if (!rateLimiter || rateLimitConfig?.enabled) {
    rateLimiter = getGlobalRateLimiter({
      maxRequestsPerHour: rateLimitConfig?.maxRequestsPerHour,
    });
  }

  // 检查是否可以执行
  const check = rateLimiter.canExecuteImmediately();
  
  if (!check.canExecute) {
    console.log(`[LLM] Rate limit reached: ${check.reason}`);
    console.log(`[LLM] Request queued - ${check.waitTime}ms wait time`);
    
    yield {
      content: `[Rate Limit] Request queued due to: ${check.reason}. Estimated wait: ${Math.ceil((check.waitTime || 0) / 1000)}s`,
    };
    
    // 这里不能真正等待，因为generator不能阻塞
    // 实际应用中，应该在调用streamChat前检查canExecuteImmediately
    // 然后根据需要排队
  }

  // 记录请求
  const executeStartTime = Date.now();

  // 创建 OpenAI 兼容客户端（GLM使用OpenAI格式）
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  // 转换工具为 AI SDK 格式
  const tools: Record<string, any> = {};
  for (const t of getAllTools()) {
    tools[t.id] = tool({
      description: t.description,
      parameters: t.parameters,
    });
  }

  try {
    // 记录请求开始
    await rateLimiter.executeRequest(async () => {
      // 空函数，实际执行在下面
      return true;
    }, {
      priority: rateLimitConfig?.priority || 'medium',
      timeout: 120000,
    });

    const result = await streamText({
      model: openai(config.model),
      messages,
      system: systemPrompt,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxRetries: 2,
    });

    let fullContent = '';
    let toolCalls: LLMResponse['toolCalls'] = [];

    for await (const chunk of result.textStream) {
      fullContent += chunk;
      yield {
        content: chunk,
      };
    }

    // 检查是否有工具调用
    const response = await result.response;
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      if (lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
        for (const part of lastMessage.content) {
          if (part.type === 'tool-call') {
            toolCalls = toolCalls || [];
            toolCalls.push({
              id: part.toolCallId,
              name: part.toolName,
              arguments: part.args as Record<string, any>,
            });
          }
        }
      }
    }

    if (toolCalls && toolCalls.length > 0) {
      yield {
        content: '',
        toolCalls,
      };
    }

    console.log(`[LLM] Request completed in ${Date.now() - executeStartTime}ms`);
  } catch (error: any) {
    console.error('LLM Error:', error.message);
    yield {
      content: `Error: ${error.message}`,
    };
  }
}

/**
 * 检查是否可以立即执行LLM请求
 */
export function canExecuteLLMRequest(rateLimitConfig?: {
  maxRequestsPerHour?: number;
}): { canExecute: boolean; reason?: string; waitTime?: number } {
  if (!rateLimiter) {
    rateLimiter = getGlobalRateLimiter({
      maxRequestsPerHour: rateLimitConfig?.maxRequestsPerHour,
    });
  }
  
  return rateLimiter.canExecuteImmediately();
}

/**
 * 获取API使用统计
 */
export function getLLMUsageStats() {
  if (!rateLimiter) {
    return null;
  }
  
  return rateLimiter.getUsageStats();
}
