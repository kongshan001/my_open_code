# types.ts - 核心类型定义

## 概述

本模块定义了整个应用的基础类型接口，使用 TypeScript 的类型系统确保代码的类型安全。

## 设计哲学

- **单一职责**：每个接口只定义一个概念
- **可扩展性**：使用可选字段支持未来扩展
- **文档化**：通过类型定义自我文档化

## 接口详解

### Message

消息是应用的核心数据结构，代表一次对话内容。

```typescript
interface Message {
  id: string;                    // 唯一标识符
  role: 'user' | 'assistant' | 'tool';  // 消息角色
  content: string;               // 消息内容
  toolCalls?: ToolCall[];        // 工具调用（仅助手消息）
  toolResults?: ToolResult[];    // 工具结果（仅助手消息）
  timestamp: number;             // 创建时间戳
}
```

**字段说明：**

- **id**: 使用 `generateId()` 生成的唯一标识
- **role**: 
  - `user`: 用户发送的消息
  - `assistant`: AI 助手回复的消息
  - `tool`: 工具执行结果的系统消息
- **content**: 纯文本内容
- **toolCalls**: AI 决定调用的工具列表
- **toolResults**: 工具执行后的结果
- **timestamp**: Unix 时间戳（毫秒）

**使用场景：**

```typescript
// 创建用户消息
const userMsg: Message = {
  id: generateId(),
  role: 'user',
  content: 'Hello!',
  timestamp: Date.now()
};

// 创建助手消息（带工具调用）
const assistantMsg: Message = {
  id: generateId(),
  role: 'assistant',
  content: 'I\'ll help you list files.',
  toolCalls: [{
    id: 'tool-1',
    name: 'bash',
    arguments: { command: 'ls -la' }
  }],
  timestamp: Date.now()
};
```

### ToolCall

代表一次工具调用请求。

```typescript
interface ToolCall {
  id: string;                    // 工具调用ID
  name: string;                  // 工具名称
  arguments: Record<string, any>; // 调用参数
}
```

**关联关系：**
- 一个助手消息可以包含多个 ToolCall
- 每个 ToolCall 对应一个 ToolResult（执行后）

### ToolResult

代表工具执行的结果。

```typescript
interface ToolResult {
  toolCallId: string;            // 关联的ToolCall ID
  name: string;                  // 工具名称
  output: string;                // 输出内容
  metadata?: Record<string, any>; // 元数据
}
```

**关联关系：**
- 通过 `toolCallId` 与 ToolCall 关联
- 存储在助手消息的 `toolResults` 数组中

### Tool

工具接口，定义工具的结构。

```typescript
interface Tool {
  id: string;                    // 工具唯一ID
  description: string;           // 工具描述（给AI看）
  parameters: z.ZodSchema;       // Zod参数验证Schema
  execute: (args: any, context: ToolContext) => Promise<ToolExecuteResult>;
}
```

**设计要点：**

1. **id**: 全局唯一，使用小写+下划线命名
2. **description**: 帮助 AI 理解何时使用该工具
3. **parameters**: Zod Schema 提供运行时类型安全
4. **execute**: 异步执行函数

**实现示例：**

```typescript
const MyTool: Tool = {
  id: 'my_tool',
  description: 'Does something useful',
  parameters: z.object({
    input: z.string().describe('Input parameter')
  }),
  execute: async (args, context) => {
    return { output: 'Result' };
  }
};
```

### ToolContext

工具执行时的上下文信息。

```typescript
interface ToolContext {
  sessionId: string;    // 当前会话ID
  messageId: string;    // 当前消息ID
  workingDir: string;   // 工作目录路径
}
```

**用途：**
- 工具可以通过 `workingDir` 知道当前工作目录
- 可以用于日志记录（关联到特定会话/消息）
- 未来可以扩展更多上下文信息

### ToolExecuteResult

工具执行返回的结果。

```typescript
interface ToolExecuteResult {
  output: string;                    // 主要输出内容
  metadata?: Record<string, any>;    // 额外元数据
}
```

**设计要点：**
- `output`: 必须字段，将被显示给用户和 AI
- `metadata`: 可选，用于存储额外信息（如文件大小、执行时间等）

### Session

会话是消息的集合，代表一次完整的对话。

```typescript
interface Session {
  id: string;             // 会话唯一ID
  title: string;          // 会话标题（用户可读）
  messages: Message[];    // 消息列表（按时间排序）
  createdAt: number;      // 创建时间戳
  updatedAt: number;      // 最后更新时间戳
}
```

**生命周期：**

1. **创建**: `SessionManager.create()` 创建新会话
2. **使用**: 添加消息，updatedAt 自动更新
3. **加载**: 从存储中恢复历史会话
4. **删除**: 从存储中删除（可选）

### Config

应用配置。

```typescript
interface Config {
  apiKey: string;         // API密钥
  baseUrl: string;        // API基础URL
  model: string;          // 模型名称
  workingDir: string;     // 工作目录
}
```

**来源：**
- 从环境变量读取（.env 文件）
- 在应用启动时加载一次

## 类型关系图

```
Session
  ├── id
  ├── title
  ├── messages: Message[]
  │   ├── id
  │   ├── role
  │   ├── content
  │   ├── toolCalls: ToolCall[]
  │   │   ├── id
  │   │   ├── name
  │   │   └── arguments
  │   ├── toolResults: ToolResult[]
  │   │   ├── toolCallId (→ ToolCall.id)
  │   │   ├── name
  │   │   ├── output
  │   │   └── metadata
  │   └── timestamp
  ├── createdAt
  └── updatedAt
```

## 扩展指南

### 添加新字段

```typescript
// 向后兼容：使用可选字段
interface Message {
  // ... 现有字段
  newField?: string;  // 新增可选字段
}
```

### 添加新类型

```typescript
// 在 types.ts 中定义
export interface NewType {
  // ... 字段定义
}
```

## 最佳实践

1. **使用类型别名**：为复杂类型创建别名
   ```typescript
   export type MessageList = Message[];
   ```

2. **使用联合类型**：明确枚举值
   ```typescript
   type Role = 'user' | 'assistant' | 'tool';
   ```

3. **使用 Pick/Omit**：创建子类型
   ```typescript
   type MessageInput = Omit<Message, 'id' | 'timestamp'>;
   ```

4. **文档注释**：为复杂接口添加 JSDoc
   ```typescript
   /**
    * 工具执行上下文
    * @property sessionId - 关联的会话ID
    */
   interface ToolContext { ... }
   ```
