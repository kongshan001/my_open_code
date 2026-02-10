import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Config } from './types.js';
import { getAllTools } from './tool.js';

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
}

export async function* streamChat(
  messages: CoreMessage[],
  config: Config,
  systemPrompt: string
): AsyncGenerator<LLMResponse, void, unknown> {
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
  } catch (error: any) {
    console.error('LLM Error:', error.message);
    yield {
      content: `Error: ${error.message}`,
    };
  }
}
