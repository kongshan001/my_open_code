# llm.ts - LLM 交互层

**← [返回文档索引](README.md)** | **[返回主文档](../README.md)**
## 概述

负责与 LLM（大语言模型）API 通信，处理流式响应和工具调用。

## 技术栈

### Vercel AI SDK

使用 `@ai-sdk/openai` 提供的功能：

```typescript
import { streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
```

**为什么选择这个 SDK？**
- 统一的 API 接口
- 支持多种模型提供商
- 内置流式处理
- 工具调用支持
- TypeScript 类型安全

### OpenAI 兼容层

GLM API 兼容 OpenAI 的 API 格式：

```typescript
const openai = createOpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,  // GLM 的端点
});
```

## 核心概念

### 流式响应

LLM 生成文本是逐步的，使用流式响应可以：
- 实时显示给用户
- 减少等待时间
- 更好的用户体验

### 工具调用

LLM 可以决定调用工具：

```typescript
// 用户：列出文件
// AI：我决定调用 bash 工具
{
  "toolCalls": [{
    "name": "bash",
    "arguments": { "command": "ls -la" }
  }]
}
```

## API 详解

### streamChat(messages, config, systemPrompt)

与 LLM 进行流式对话。

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| messages | CoreMessage[] | 历史消息 |
| config | Config | API 配置 |
| systemPrompt | string | 系统提示词 |

**消息格式：**

```typescript
interface CoreMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

**返回值：**

异步生成器 `AsyncGenerator<LLMResponse>`：

```typescript
interface LLMResponse {
  content: string;      // 文本片段
  toolCalls?: [{        // 工具调用（可选）
    id: string;
    name: string;
    arguments: object;
  }];
}
```

### 演示模式

当 API Key 为占位符时，自动切换到演示模式：

```typescript
if (config.apiKey === 'your-api-key-here') {
  console.log('[Demo Mode: Using simulated responses]');
  yield* demoStream(messages);
  return;
}
```

**演示模式的作用：**
- 无需真实 API Key 测试 UI
- 模拟流式输出效果
- 模拟工具调用流程

**演示逻辑：**

```typescript
async function* demoStream(messages) {
  const lastMessage = messages[messages.length - 1];
  
  // 根据输入生成模拟响应
  if (lastMessage.content.includes('hello')) {
    yield { content: 'Hello! 👋' };
  } else if (lastMessage.content.includes('file')) {
    yield { content: 'I\'ll read that file.' };
    yield {
      content: '',
      toolCalls: [{
        id: 'demo-1',
        name: 'read',
        arguments: { file_path: 'package.json' }
      }]
    };
  }
}
```

### 工具转换

将内部工具格式转换为 AI SDK 格式：

```typescript
const tools: Record<string, any> = {};
for (const t of getAllTools()) {
  tools[t.id] = tool({
    description: t.description,
    parameters: t.parameters,
  });
}
```

**为什么需要转换？**

内部 Tool 接口 ≠ AI SDK 的 tool 函数
- 内部：包含 execute 方法
- SDK：只需要 description 和 parameters

### streamText 配置

```typescript
const result = await streamText({
  model: openai(config.model),           // 模型实例
  messages,                               // 历史消息
  system: systemPrompt,                   // 系统提示词
  tools: Object.keys(tools).length > 0 ? tools : undefined,
  maxRetries: 2,                          // 失败重试次数
});
```

**配置项说明：**

- **model**: 使用 `createOpenAI` 创建的模型实例
- **messages**: 包含 system、user、assistant 消息
- **system**: 系统提示词，定义 AI 行为
- **tools**: 可用工具，为空时不传
- **maxRetries**: 网络错误时自动重试

### 处理流式响应

```typescript
let fullContent = '';
let toolCalls: LLMResponse['toolCalls'] = [];

for await (const chunk of result.textStream) {
  fullContent += chunk;
  yield { content: chunk };  // 实时传递给上层
}
```

**关键点：**
- `textStream` 是异步可迭代对象
- 每次迭代得到一个文本片段
- 需要累积完整内容

### 提取工具调用

```typescript
const response = await result.response;
if (response.messages && response.messages.length > 0) {
  const lastMessage = response.messages[response.messages.length - 1];
  
  if (lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
    for (const part of lastMessage.content) {
      if (part.type === 'tool-call') {
        toolCalls.push({
          id: part.toolCallId,
          name: part.toolName,
          arguments: part.args
        });
      }
    }
  }
}
```

**流程：**
1. 等待流结束（获取完整 response）
2. 检查最后一条消息
3. 遍历消息内容
4. 提取 tool-call 类型的部分

## 错误处理

### 网络错误

```typescript
try {
  const result = await streamText({...});
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    return { content: 'Error: Cannot connect to API server' };
  }
  if (error.status === 401) {
    return { content: 'Error: Invalid API key' };
  }
}
```

### 超时处理

由 SDK 内部处理，可以通过 `maxRetries` 配置重试。

### 降级处理

API 失败时可以切换到演示模式：

```typescript
try {
  yield* realStream();
} catch (error) {
  console.error('API error, switching to demo mode');
  yield* demoStream();
}
```

## 使用示例

### 基本对话

```typescript
const messages = [
  { role: 'user', content: 'Hello!' }
];

const stream = streamChat(messages, config, systemPrompt);

for await (const response of stream) {
  if (response.content) {
    process.stdout.write(response.content);
  }
}
```

### 处理工具调用

```typescript
for await (const response of stream) {
  if (response.content) {
    console.log(response.content);
  }
  
  if (response.toolCalls) {
    for (const toolCall of response.toolCalls) {
      console.log(`Tool: ${toolCall.name}`);
      console.log(`Args: ${JSON.stringify(toolCall.arguments)}`);
      
      // 执行工具
      const result = await executeTool(
        toolCall.name,
        toolCall.arguments,
        context
      );
      
      console.log(`Result: ${result.output}`);
    }
  }
}
```

## 性能优化

### 连接复用

SDK 内部会复用 HTTP 连接，无需额外处理。

### 流式缓冲

对于特别长的响应，考虑缓冲策略：

```typescript
let buffer = '';
for await (const chunk of stream) {
  buffer += chunk.content;
  
  // 每 100ms 刷新一次
  if (Date.now() - lastFlush > 100) {
    flush(buffer);
    buffer = '';
  }
}
```

### 取消请求

支持通过 AbortSignal 取消：

```typescript
const controller = new AbortController();

const stream = streamChat(messages, config, systemPrompt, {
  abortSignal: controller.signal
});

// 5秒后取消
setTimeout(() => controller.abort(), 5000);
```

## 调试技巧

### 查看原始请求

```typescript
// 启用调试日志
process.env.AI_SDK_LOG_LEVEL = 'debug';
```

### 记录 token 使用

```typescript
const result = await streamText({...});
const usage = await result.usage;
console.log(`Tokens used: ${usage.totalTokens}`);
```

### 模拟延迟

```typescript
// 在演示模式中添加延迟
await new Promise(resolve => setTimeout(resolve, 100));
```
