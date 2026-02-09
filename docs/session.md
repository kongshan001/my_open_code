# session.ts - 会话管理

## 概述

管理单个会话的生命周期，包括消息处理、工具执行和上下文跟踪。

## SessionManager 类

### 属性

```typescript
private session: Session;    // 会话数据（包含消息列表）
private config: Config;      // 配置信息
```

### 静态方法

#### create(title, config): Promise<SessionManager>

创建新会话。

**流程：**
1. 生成唯一 ID
2. 创建空消息列表
3. 设置创建和更新时间
4. 保存到存储
5. 返回 SessionManager 实例

**代码：**
```typescript
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
```

#### load(sessionId, config): Promise<SessionManager | null>

加载已有会话。

**流程：**
1. 从存储加载会话数据
2. 如不存在返回 null
3. 创建 SessionManager 实例

### 实例方法

#### getSession(): Session

获取当前会话数据。

**用途：**
- 获取消息列表
- 获取会话元数据
- 传递给其他组件

#### addUserMessage(content): Promise<void>

添加用户消息。

**流程：**
1. 创建 Message 对象
2. 添加到消息列表
3. 更新会话时间戳
4. 保存到存储

**代码：**
```typescript
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
```

**自动保存：**
- 每次添加后自动保存
- 确保数据不丢失

#### processMessage(): Promise<void>

处理消息的核心方法，与 AI 交互。

**完整流程：**

```
转换消息格式
    ↓
调用 LLM (streamChat)
    ↓
实时显示响应
    ↓
保存助手消息
    ↓
检测工具调用
    ↓
执行工具 (如有)
    ↓
显示工具结果
    ↓
添加工具结果消息
    ↓
递归处理 (如有工具)
```

**详细步骤：**

1. **转换消息格式**
   ```typescript
   const coreMessages: CoreMessage[] = this.session.messages.map(msg => ({
     role: msg.role === 'tool' ? 'assistant' : msg.role,
     content: msg.content,
   }));
   ```

2. **调用 LLM**
   ```typescript
   const stream = streamChat(coreMessages, this.config, systemPrompt);
   ```

3. **处理流式响应**
   ```typescript
   for await (const response of stream) {
     if (response.content) {
       assistantContent += response.content;
       process.stdout.write(response.content);  // 实时显示
     }
     if (response.toolCalls) {
       toolCalls = response.toolCalls;
     }
   }
   ```

4. **保存助手消息**
   ```typescript
   const assistantMessage: Message = {
     id: generateId(),
     role: 'assistant',
     content: assistantContent,
     toolCalls: toolCalls || [],
     timestamp: Date.now(),
   };
   this.session.messages.push(assistantMessage);
   ```

5. **执行工具调用**
   ```typescript
   if (toolCalls && toolCalls.length > 0) {
     for (const toolCall of toolCalls) {
       console.log(`\n[Tool: ${toolCall.name}]`);
       
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
       toolResults.push(result);
     }
   }
   ```

6. **添加工具结果**
   ```typescript
   const toolResultMessage: Message = {
     id: generateId(),
     role: 'tool',
     content: toolResults.map(r => `[${r.name}]: ${r.output}`).join('\n'),
     timestamp: Date.now(),
   };
   this.session.messages.push(toolResultMessage);
   ```

7. **递归处理**
   ```typescript
   if (toolCalls && toolCalls.length > 0) {
     console.log('\n[Processing tool results...]\n');
     await this.processMessage();  // 递归调用
   }
   ```

#### getContextUsage(): ContextUsage

获取当前上下文使用情况。

**实现：**
```typescript
getContextUsage(): ContextUsage {
  return calculateContextUsage(this.session.messages, this.config.model);
}
```

**用途：**
- 显示使用率
- 检查是否需要警告

#### formatContextStatus(): string

格式化显示上下文状态。

**输出示例：**
```
🟢 Context: 5% (3,200/128,000) | Remaining: 124,800
```

#### checkContextWarning(): string | null

检查是否需要警告。

**返回值：**
- 需要警告：警告消息字符串
- 正常：`null`

## 会话生命周期

```
创建 SessionManager
    ↓
循环：
  用户输入
    ↓
  addUserMessage()
    ↓
  processMessage()
    ├─ 调用 LLM
    ├─ 显示响应
    ├─ 执行工具（如有）
    └─ 递归处理（如有）
    ↓
  显示上下文使用率
    ↓
直到 exit/quit
```

## 状态管理

### 自动保存

每次状态变更后自动保存：

```typescript
// 添加用户消息后
await saveSession(this.session);

// 添加助手消息后
await saveSession(this.session);

// 添加工具结果后
await saveSession(this.session);
```

### 时间戳更新

```typescript
// 每次修改后更新时间戳
this.session.updatedAt = Date.now();
```

## 错误处理

### LLM 调用失败

```typescript
try {
  await this.processMessage();
} catch (error) {
  console.error(`Error: ${error.message}`);
  // 不中断对话，继续等待用户输入
}
```

### 工具执行失败

```typescript
try {
  const result = await executeTool(...);
} catch (error) {
  console.error(`Tool execution error: ${error.message}`);
  // 记录错误，但继续执行其他工具
  toolResults.push({
    toolCallId: toolCall.id,
    name: toolCall.name,
    output: `Error: ${error.message}`
  });
}
```

## 性能考虑

### 消息列表增长

随着对话进行，消息列表会不断增长：

- **内存占用**：所有消息在内存中
- **Token 计算**：每次需要遍历所有消息
- **API 调用**：每次都要发送完整历史

### 优化方案

1. **上下文压缩**（已规划）
   - 当接近限制时，总结历史对话
   - 用摘要替代完整消息

2. **消息截断**
   - 只保留最近 N 条消息
   - 丢弃早期对话

3. **本地缓存**
   - 缓存 token 计算结果
   - 避免重复计算

## 使用示例

### 创建并对话

```typescript
const sessionManager = await SessionManager.create('Test', config);

await sessionManager.addUserMessage('Hello!');
await sessionManager.processMessage();

await sessionManager.addUserMessage('List files');
await sessionManager.processMessage();
```

### 加载并继续

```typescript
const sessionManager = await SessionManager.load('abc123', config);

// 显示历史
const session = sessionManager.getSession();
console.log(`Messages: ${session.messages.length}`);

// 继续对话
await sessionManager.addUserMessage('Continue...');
await sessionManager.processMessage();
```

### 检查上下文

```typescript
const usage = sessionManager.getContextUsage();
console.log(sessionManager.formatContextStatus());

const warning = sessionManager.checkContextWarning();
if (warning) {
  console.log(warning);
}
```
