# Hello World OpenCode - 架构文档

本文档详细介绍每个 TypeScript 模块的功能、接口和使用方式。

## 📁 目录结构

```
src/
├── types.ts          # 核心类型定义
├── config.ts         # 配置管理
├── token.ts          # Token 计算和上下文管理
├── storage.ts        # 持久化存储
├── tool.ts           # 工具系统核心
├── tools/            # 工具实现
│   ├── bash.ts       # Bash 命令工具
│   ├── read.ts       # 文件读取工具
│   └── index.ts      # 工具注册
├── llm.ts            # LLM 交互层
├── session.ts        # 会话管理
├── system-prompt.ts  # 系统提示词
└── index.ts          # CLI 入口
```

---

## 1. types.ts - 核心类型定义

### 模块职责
定义整个应用使用的基础类型接口，确保类型安全。

### 主要接口

#### Message（消息）
```typescript
interface Message {
  id: string;                    // 唯一标识
  role: 'user' | 'assistant' | 'tool';  // 消息角色
  content: string;               // 消息内容
  toolCalls?: ToolCall[];        // 工具调用（助手消息）
  toolResults?: ToolResult[];    // 工具结果（助手消息）
  timestamp: number;             // 时间戳
}
```

#### Tool（工具）
```typescript
interface Tool {
  id: string;                    // 工具ID
  description: string;           // 工具描述（给AI看）
  parameters: z.ZodSchema;       // 参数Schema（Zod验证）
  execute: (args: any, context: ToolContext) => Promise<ToolExecuteResult>;
}
```

#### Session（会话）
```typescript
interface Session {
  id: string;                    // 会话ID
  title: string;                 // 会话标题
  messages: Message[];           // 消息列表
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
}
```

#### Config（配置）
```typescript
interface Config {
  apiKey: string;                // API密钥
  baseUrl: string;               // API基础URL
  model: string;                 // 模型名称
  workingDir: string;            // 工作目录
}
```

### 设计决策
- 使用 TypeScript 接口确保类型安全
- 时间戳使用 number（Unix时间戳）
- 工具调用和结果关联到助手消息
- 支持扩展字段（如 metadata）

---

## 2. config.ts - 配置管理

### 模块职责
负责加载和管理应用配置，从环境变量读取设置。

### 主要函数

#### loadConfig(): Config
加载配置，从 `.env` 文件读取环境变量。

**流程：**
1. 调用 `dotenv.config()` 加载 `.env` 文件
2. 读取 `GLM_API_KEY`、`GLM_BASE_URL`、`GLM_MODEL`
3. 验证 API Key 是否存在
4. 返回配置对象

**错误处理：**
- 如果 `GLM_API_KEY` 未设置，抛出错误

**示例：**
```typescript
const config = loadConfig();
// {
//   apiKey: 'sk-xxx',
//   baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
//   model: 'glm-4.7',
//   workingDir: '/current/path'
// }
```

### 配置项说明

| 环境变量 | 必填 | 默认值 | 说明 |
|---------|------|--------|------|
| GLM_API_KEY | ✅ | - | GLM API密钥 |
| GLM_BASE_URL | ❌ | https://open.bigmodel.cn/api/coding/paas/v4 | API端点 |
| GLM_MODEL | ❌ | glm-4.7 | 模型名称 |

### 依赖
- `dotenv`：加载 `.env` 文件

---

## 3. token.ts - Token 计算和上下文管理

### 模块职责
估算 Token 数量，计算上下文使用率，提供警告机制。

### 核心概念

#### Token 估算
使用简化算法：4 个字符 ≈ 1 个 token
（实际应使用 tiktoken，但为了简化使用估算）

#### 上下文限制
不同模型有不同的上下文限制：
- GLM-4.7: 128K tokens
- Claude 3.5: 200K tokens
- GPT-4: 8K/32K tokens

### 主要函数

#### estimateTokens(text: string): number
估算文本的 token 数量。

```typescript
estimateTokens("Hello World");  // 3 tokens (11 chars / 4)
```

#### calculateContextUsage(messages, modelName): ContextUsage
计算当前上下文使用情况。

**参数：**
- `messages`: 消息数组
- `modelName`: 模型名称

**返回：**
```typescript
{
  totalTokens: number;        // 总使用token数
  contextLimit: number;       // 上下文限制
  usagePercentage: number;    // 使用率百分比
  remainingTokens: number;    // 剩余token数
  isNearLimit: boolean;       // 是否接近限制(≥80%)
  isOverflow: boolean;        // 是否溢出(>100%)
  inputTokens: number;        // 输入token数
  outputTokens: number;       // 输出token数
}
```

#### formatContextUsage(usage): string
格式化显示使用率。

**输出示例：**
```
🟢 Context: 5% (3,200/128,000) | Remaining: 124,800
🟡 Context: 82% (105,000/128,000) | Remaining: 23,000 [⚠️ Near Limit]
🔴 Context: 95% (121,600/128,000) | Remaining: 6,400 [⚠️ Critical]
```

#### getContextWarning(usage): string | null
获取警告消息。

**警告级别：**
- 80%+: "Approaching limit"
- 90%+: "Consider starting new session"
- 100%+: "Context overflow!"

### 模型配置

```typescript
const MODEL_LIMITS = {
  'glm-4.7': {
    context: 128000,
    output: 4096,
  },
  'default': {
    context: 8192,
    output: 4096,
  }
};
```

### 使用示例

```typescript
import { calculateContextUsage, formatContextUsage } from './token.js';

const messages = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi!' }
];

const usage = calculateContextUsage(messages, 'glm-4.7');
console.log(formatContextUsage(usage));
// 🟢 Context: 1% (1,200/128,000) | Remaining: 126,800
```

---

## 4. storage.ts - 持久化存储

### 模块职责
负责会话数据的持久化存储，使用 JSON 文件格式。

### 存储结构

```
data/sessions/
├── {session-id-1}.json    # 会话1数据
├── {session-id-2}.json    # 会话2数据
└── ...
```

### 主要函数

#### ensureDataDir(): Promise<void>
确保数据目录存在，不存在则创建。

#### saveSession(session): Promise<void>
保存会话到文件。

**流程：**
1. 确保目录存在
2. 将会话对象序列化为 JSON
3. 写入文件

**文件格式：**
```json
{
  "id": "abc123",
  "title": "Test Session",
  "messages": [...],
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

#### loadSession(sessionId): Promise<Session | null>
加载会话数据。

**错误处理：**
- 文件不存在时返回 `null`
- 其他错误抛出异常

#### listSessions(): Promise<Session[]>
列出所有会话，按更新时间倒序排列。

**流程：**
1. 读取 `data/sessions/` 目录
2. 解析所有 JSON 文件
3. 按 `updatedAt` 排序

#### deleteSession(sessionId): Promise<void>
删除会话文件。

#### generateId(): string
生成唯一ID。

**实现：**
```typescript
Date.now().toString(36) + Math.random().toString(36).substr(2)
```

### 设计决策
- 使用 JSON 格式：人类可读，易于调试
- 文件命名：使用 session ID 作为文件名
- 无数据库依赖：简化部署
- 自动创建目录：减少配置步骤

### 使用示例

```typescript
import { saveSession, loadSession, listSessions } from './storage.js';

// 保存会话
await saveSession(session);

// 加载会话
const session = await loadSession('abc123');

// 列出所有会话
const sessions = await listSessions();
```

---

## 5. tool.ts - 工具系统核心

### 模块职责
管理工具的注册、发现和执行，是工具系统的核心。

### 核心概念

#### 工具注册表
使用 Map 存储所有注册的工具：
```typescript
const toolRegistry = new Map<string, Tool>();
```

#### 工具生命周期
1. **注册**：`registerTool(tool)` 将工具加入注册表
2. **发现**：`getAllTools()` 获取所有工具
3. **执行**：`executeTool(id, args, context)` 执行特定工具

### 主要函数

#### registerTool(tool): void
注册工具到系统。

```typescript
registerTool(BashTool);
registerTool(ReadTool);
```

#### getTool(id): Tool | undefined
根据ID获取工具。

#### getAllTools(): Tool[]
获取所有已注册的工具。

#### executeTool(toolId, args, context): Promise<ToolExecuteResult>
执行工具。

**流程：**
1. 根据 ID 查找工具
2. 使用 Zod 验证参数
3. 调用工具的 execute 方法
4. 返回执行结果

**错误处理：**
- 工具不存在：抛出错误
- 参数验证失败：抛出错误
- 执行错误：由工具内部处理

#### listTools(): string
列出所有工具（用于显示）。

**输出示例：**
```
- bash: Execute shell commands
- read: Read file contents
```

### 工具上下文

```typescript
interface ToolContext {
  sessionId: string;    // 当前会话ID
  messageId: string;    // 当前消息ID
  workingDir: string;   // 工作目录
}
```

### 设计决策
- 注册表模式：支持动态注册工具
- Zod 验证：运行时类型安全
- 统一接口：所有工具遵循相同接口
- 错误隔离：工具内部处理错误，不影响系统

### 扩展性

添加新工具只需：
1. 创建工具文件（实现 Tool 接口）
2. 调用 `registerTool()` 注册

```typescript
// 新工具示例
const MyTool: Tool = {
  id: 'my_tool',
  description: 'Does something',
  parameters: z.object({...}),
  execute: async (args, context) => {
    return { output: 'result' };
  }
};

registerTool(MyTool);
```

---

## 6. tools/bash.ts - Bash 命令工具

### 模块职责
执行 shell 命令，支持安全检查。

### 安全机制

#### 危险命令检测
```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,      // rm -rf /
  />\s*\/dev\/null/,     // 重定向到 null
  /mkfs/,               // 格式化文件系统
  /dd\s+if=/,           // dd 命令
];
```

### 参数定义

```typescript
{
  command: string;      // 要执行的命令
  timeout?: number;     // 超时时间（毫秒），默认30000
}
```

### 执行流程

1. **安全检查**：检测是否包含危险命令
2. **执行命令**：使用 `child_process.exec`
3. **捕获输出**：收集 stdout 和 stderr
4. **返回结果**：包含输出和元数据

### 返回值

```typescript
{
  output: string;       // 命令输出
  metadata: {
    command: string;    // 执行的命令
    exitCode: number;   // 退出码
    error?: string;     // 错误信息（如有）
  }
}
```

### 使用示例

```typescript
// 列出文件
const result = await executeTool('bash', {
  command: 'ls -la'
}, context);

// 带超时的命令
const result = await executeTool('bash', {
  command: 'sleep 5',
  timeout: 10000
}, context);
```

### 错误处理

- **危险命令**：返回错误，不执行
- **命令失败**：捕获错误，返回错误信息
- **超时**：自动终止，返回超时错误

---

## 7. tools/read.ts - 文件读取工具

### 模块职责
读取文件内容，支持偏移和限制，包含安全检查。

### 安全机制

#### 路径验证
确保文件路径在工作目录内：
```typescript
const relative = path.relative(context.workingDir, resolvedPath);
if (relative.startsWith('..')) {
  return { output: 'Error: Access denied' };
}
```

### 参数定义

```typescript
{
  file_path: string;    // 文件路径（绝对或相对）
  offset?: number;      // 起始行号（0索引），默认0
  limit?: number;       // 最大行数，默认200
}
```

### 执行流程

1. **路径解析**：将相对路径转为绝对路径
2. **安全检查**：验证路径在工作目录内
3. **读取文件**：使用 `fs.readFile`
4. **处理内容**：应用 offset 和 limit
5. **返回结果**：包含内容和元数据

### 返回值

```typescript
{
  output: string;       // 文件内容
  metadata: {
    filePath: string;      // 解析后的路径
    totalLines: number;    // 总行数
    displayedLines: number; // 显示行数
    truncated: boolean;    // 是否截断
  }
}
```

### 使用示例

```typescript
// 读取整个文件
const result = await executeTool('read', {
  file_path: 'package.json'
}, context);

// 读取部分行
const result = await executeTool('read', {
  file_path: 'large-file.txt',
  offset: 100,
  limit: 50
}, context);
```

### 特性

- 自动处理相对路径
- 大文件自动截断提示
- 行号精确的偏移和限制

---

## 8. tools/index.ts - 工具注册

### 模块职责
集中注册所有工具，初始化工具系统。

### 实现

```typescript
import { registerTool } from '../tool.js';
import { BashTool } from './bash.js';
import { ReadTool } from './read.js';

export function initializeTools(): void {
  registerTool(BashTool);
  registerTool(ReadTool);
  
  console.log('✓ Tools initialized: bash, read');
}

export { BashTool, ReadTool };
```

### 添加新工具的步骤

1. 创建工具文件 `tools/{name}.ts`
2. 导出 Tool 对象
3. 在 `index.ts` 中导入并注册

```typescript
// 1. 创建 tools/grep.ts
export const GrepTool: Tool = { ... };

// 2. 在 index.ts 注册
import { GrepTool } from './grep.js';
registerTool(GrepTool);
```

---

## 9. llm.ts - LLM 交互层

### 模块职责
负责与 LLM API 通信，处理流式响应和工具调用。

### 核心技术

#### Vercel AI SDK
使用 `@ai-sdk/openai` 的 `streamText` 函数：
```typescript
import { streamText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
```

#### OpenAI 兼容层
GLM API 兼容 OpenAI 格式：
```typescript
const openai = createOpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,
});
```

### 主要函数

#### streamChat(messages, config, systemPrompt)
与 LLM 进行流式对话。

**参数：**
- `messages`: 历史消息数组
- `config`: 配置对象（API Key、模型等）
- `systemPrompt`: 系统提示词

**返回：**
异步生成器，产生 `LLMResponse`：
```typescript
{
  content: string;      // 文本片段
  toolCalls?: [{        // 工具调用（如有）
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
  yield* demoStream(messages);
  return;
}
```

演示模式模拟 LLM 响应，用于测试 UI。

### 工具转换

将内部工具格式转为 AI SDK 格式：

```typescript
const tools = {};
for (const t of getAllTools()) {
  tools[t.id] = tool({
    description: t.description,
    parameters: t.parameters,
  });
}
```

### 错误处理

- 网络错误：捕获并返回错误消息
- API 错误：显示错误信息
- 超时：由 SDK 处理

### 使用示例

```typescript
const stream = streamChat(messages, config, systemPrompt);

for await (const response of stream) {
  if (response.content) {
    process.stdout.write(response.content);
  }
  if (response.toolCalls) {
    // 处理工具调用
  }
}
```

---

## 10. session.ts - 会话管理

### 模块职责
管理单个会话的生命周期，包括消息处理和上下文跟踪。

### SessionManager 类

#### 属性
```typescript
private session: Session;    // 会话数据
private config: Config;      // 配置
```

#### 静态方法

##### create(title, config): Promise<SessionManager>
创建新会话。

**流程：**
1. 生成唯一 ID
2. 创建空消息列表
3. 保存到存储
4. 返回 SessionManager 实例

##### load(sessionId, config): Promise<SessionManager | null>
加载已有会话。

#### 实例方法

##### addUserMessage(content): Promise<void>
添加用户消息。

**流程：**
1. 创建 Message 对象
2. 添加到消息列表
3. 更新会话时间戳
4. 保存到存储

##### processMessage(): Promise<void>
处理消息并获取 AI 回复。

**完整流程：**
1. **转换消息**：转为 AI SDK 格式
2. **调用 LLM**：获取流式响应
3. **显示响应**：实时输出文本
4. **保存助手消息**：包含工具调用
5. **执行工具**（如有）：
   - 遍历 toolCalls
   - 调用 executeTool
   - 显示工具输出
   - 保存工具结果
6. **添加工具结果消息**：将结果加入历史
7. **递归处理**（如有工具调用）：让 AI 处理工具结果

##### getContextUsage(): ContextUsage
获取当前上下文使用情况。

**返回：**
- 总 Token 数
- 使用率百分比
- 剩余 Token 数
- 警告状态

##### formatContextStatus(): string
格式化显示上下文状态。

**输出：**
```
🟢 Context: 5% (3,200/128,000) | Remaining: 124,800
```

##### checkContextWarning(): string | null
检查是否需要警告。

### 会话生命周期

```
创建/加载会话
    ↓
添加用户消息
    ↓
处理消息 → 调用 LLM
    ↓
显示流式响应
    ↓
检测工具调用
    ↓
执行工具 → 显示结果
    ↓
递归处理（如有需要）
    ↓
保存会话
```

### 设计决策

- **自动保存**：每次消息更新后自动持久化
- **递归处理**：工具结果自动交给 AI 继续处理
- **上下文跟踪**：实时计算和显示 Token 使用

---

## 11. system-prompt.ts - 系统提示词

### 模块职责
定义 AI 助手的行为准则和能力说明。

### 当前提示词

```typescript
export function getSystemPrompt(): string {
  return `You are a helpful coding assistant powered by GLM-4.7.

You have access to tools that can help you complete tasks:
- bash: Execute shell commands
- read: Read file contents

When responding:
1. Be concise and direct
2. Use tools when needed to gather information
3. Always use absolute paths when working with files
4. Explain what you're doing before executing commands
5. If you're unsure about something, ask for clarification

...`;
}
```

### 提示词组成

1. **身份定义**：明确 AI 角色
2. **工具说明**：列出可用工具
3. **行为准则**：回复规范
4. **安全提示**：强调谨慎操作
5. **代码风格**：编码规范

### 扩展方式

支持从文件加载自定义提示词：

```typescript
// 检查 data/prompt.txt 是否存在
// 如存在，读取并覆盖默认提示词
```

---

## 12. index.ts - CLI 入口

### 模块职责
应用程序入口，处理用户交互和命令路由。

### 主要流程

```
启动
  ↓
加载配置
  ↓
初始化工具
  ↓
显示菜单
  ↓
用户选择
  ├─ 创建新会话
  ├─ 加载已有会话 → 显示历史
  └─ 退出
  ↓
显示上下文使用率
  ↓
交互式对话循环
  ├─ /history: 显示历史
  ├─ /clear: 清屏
  ├─ exit/quit: 退出
  └─ 其他: 处理消息
  ↓
保存并退出
```

### 命令列表

| 命令 | 功能 |
|-----|------|
| `exit` / `quit` | 退出程序 |
| `/history` | 显示完整对话历史 |
| `/clear` | 清屏 |

### 历史显示

加载会话时自动显示历史：
- 用户消息和助手回复
- 工具调用和结果
- 截断过长的输出

### 上下文显示

每次对话后显示：
```
🟢 Context: 8% (5,100/128,000) | Remaining: 122,900
```

### 警告显示

接近限制时显示：
```
⚠️ Warning: Context usage at 82%. Approaching limit.
```

### 错误处理

- **配置错误**：提示创建 .env 文件
- **API 错误**：显示错误信息
- **工具错误**：捕获并显示，不中断对话

---

## 模块关系图

```
index.ts (入口)
    ├── config.ts (配置)
    ├── tools/index.ts (工具初始化)
    │   └── tool.ts (工具注册表)
    │       ├── bash.ts
    │       └── read.ts
    ├── storage.ts (存储)
    ├── session.ts (会话管理)
    │   ├── token.ts (上下文计算)
    │   ├── llm.ts (LLM交互)
    │   │   └── system-prompt.ts
    │   └── tool.ts (工具执行)
    └── types.ts (类型)
```

## 数据流

```
用户输入
  ↓
index.ts
  ↓
SessionManager.addUserMessage()
  ↓
storage.ts (保存)
  ↓
SessionManager.processMessage()
  ↓
token.ts (计算上下文)
  ↓
llm.ts (调用AI)
  ↓
显示响应
  ↓
tool.ts (如有工具调用)
  ↓
bash.ts / read.ts (执行)
  ↓
显示结果
  ↓
storage.ts (保存)
  ↓
token.ts (显示使用率)
```

---

## 扩展指南

### 添加新工具

1. 创建 `src/tools/{name}.ts`
2. 实现 Tool 接口
3. 在 `src/tools/index.ts` 注册

### 修改模型限制

编辑 `src/token.ts`：
```typescript
MODEL_LIMITS['new-model'] = {
  context: 200000,
  output: 8192,
};
```

### 自定义提示词

创建 `data/prompt.txt`，内容将覆盖默认提示词。

---

## 最佳实践

1. **错误处理**：每个模块内部处理错误，不传播到上层
2. **类型安全**：所有函数都有明确的返回类型
3. **异步操作**：所有 IO 操作都使用 Promise
4. **自动保存**：数据变更后自动持久化
5. **安全检查**：所有外部输入都经过验证

