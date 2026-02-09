import { Session, Message, Config } from './types.js';
import { saveSession, loadSession, generateId } from './storage.js';
import { streamChat, LLMResponse } from './llm.js';
import { getSystemPrompt } from './system-prompt.js';
import { executeTool } from './tool.js';
import { calculateContextUsage, formatContextUsage, getContextWarning, ContextUsage } from './token.js';
import type { CoreMessage } from 'ai';

export class SessionManager {
  private session: Session;
  private config: Config;

  constructor(session: Session, config: Config) {
    this.session = session;
    this.config = config;
  }

  // 获取当前上下文使用情况
  getContextUsage(): ContextUsage {
    return calculateContextUsage(this.session.messages, this.config.model);
  }

  // 格式化显示上下文使用率
  formatContextStatus(): string {
    const usage = this.getContextUsage();
    return formatContextUsage(usage);
  }

  // 检查是否需要警告
  checkContextWarning(): string | null {
    const usage = this.getContextUsage();
    return getContextWarning(usage);
  }

  static async create(title: string, config: Config): Promise<SessionManager> {
    const session: Session = {
      id: generateId(),
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveSession(session);
    return new SessionManager(session, config);
  }

  static async load(sessionId: string, config: Config): Promise<SessionManager | null> {
    const session = await loadSession(sessionId);
    if (!session) return null;
    return new SessionManager(session, config);
  }

  getSession(): Session {
    return this.session;
  }

  async addUserMessage(content: string): Promise<void> {
    const message: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.session.messages.push(message);
    this.session.updatedAt = Date.now();
    await saveSession(this.session);
  }

  async processMessage(): Promise<void> {
    // 转换消息为 CoreMessage 格式
    const coreMessages: CoreMessage[] = this.session.messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content,
    }));

    const systemPrompt = getSystemPrompt();
    const stream = streamChat(coreMessages, this.config, systemPrompt);

    let assistantContent = '';
    let toolCalls: LLMResponse['toolCalls'];

    // 收集流式响应
    for await (const response of stream) {
      if (response.content) {
        assistantContent += response.content;
        process.stdout.write(response.content);
      }
      if (response.toolCalls) {
        toolCalls = response.toolCalls;
      }
    }

    console.log(); // 换行

    // 保存助手消息
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: assistantContent,
      toolCalls: toolCalls || [],
      timestamp: Date.now(),
    };
    this.session.messages.push(assistantMessage);

    // 如果有工具调用，执行它们
    if (toolCalls && toolCalls.length > 0) {
      const toolResults = [];

      for (const toolCall of toolCalls) {
        console.log(`\n[Tool: ${toolCall.name}]`);
        
        try {
          const result = await executeTool(
            toolCall.name,
            toolCall.arguments,
            {
              sessionId: this.session.id,
              messageId: assistantMessage.id,
              workingDir: this.config.workingDir,
            }
          );

          console.log(result.output);

          toolResults.push({
            toolCallId: toolCall.id,
            name: toolCall.name,
            output: result.output,
            metadata: result.metadata,
          });
        } catch (error: any) {
          console.error(`Tool execution error: ${error.message}`);
          toolResults.push({
            toolCallId: toolCall.id,
            name: toolCall.name,
            output: `Error: ${error.message}`,
          });
        }
      }

      assistantMessage.toolResults = toolResults;

      // 添加工具结果到消息历史
      const toolResultMessage: Message = {
        id: generateId(),
        role: 'tool',
        content: toolResults.map(r => `[${r.name}]: ${r.output}`).join('\n'),
        timestamp: Date.now(),
      };
      this.session.messages.push(toolResultMessage);

      // 保存会话
      this.session.updatedAt = Date.now();
      await saveSession(this.session);

      // 继续对话，让模型处理工具结果
      console.log('\n[Processing tool results...]\n');
      await this.processMessage();
    } else {
      // 没有工具调用，直接保存
      this.session.updatedAt = Date.now();
      await saveSession(this.session);
    }
  }
}
