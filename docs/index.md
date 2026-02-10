# index.ts - CLI 入口

## 概述

应用程序的入口点，负责用户交互、命令路由和程序生命周期管理。

## 架构

### 主循环结构

```
main()
  ├── 加载配置
  ├── 初始化工具
  ├── 显示菜单
  ├── 处理选择
  │   ├── 创建新会话
  │   ├── 加载已有会话
  │   └── 退出
  ├── 显示历史（如加载）
  ├── 显示上下文使用率
  └── 交互式对话循环
       ├── /history: 显示历史
       ├── /clear: 清屏
       ├── exit/quit: 退出
       └── 处理消息
```

## 核心组件

### Readline 接口

```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
```

**用途：**
- 读取用户输入
- 提供交互式提示
- 处理特殊按键（如 Ctrl+C）

### 输入封装

```typescript
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}
```

**好处：**
- 支持 async/await
- 可重用
- 易于测试

## 主函数详解

### main()

应用程序的主入口。

#### 第一阶段：初始化

```typescript
console.log('🚀 Hello World OpenCode Agent');
console.log('==============================\n');

// 1. 加载配置
const config = getConfig();
console.log(`✓ Config loaded`);
console.log(`  Model: ${config.model}`);
console.log(`  Base URL: ${config.baseUrl}\n`);

// 2. 初始化工具
initializeTools();
console.log();
```

#### 第二阶段：菜单选择

```typescript
console.log('Options:');
console.log('1. Create new session');
console.log('2. Load existing session');
console.log('3. Exit\n');

const choice = await question('Select option (1-3): ');
```

**选项 1：创建新会话**

```typescript
if (choice === '1') {
  const title = await question('Session title: ');
  sessionManager = await SessionManager.create(title || 'New Session', config);
  console.log(`\n✓ Session created: ${sessionManager.getSession().id}\n`);
}
```

**选项 2：加载已有会话**

```typescript
} else if (choice === '2') {
  const sessions = await listSessions();
  
  if (sessions.length === 0) {
    console.log('No existing sessions found. Creating new session...');
    sessionManager = await SessionManager.create('New Session', config);
  } else {
    // 显示会话列表
    console.log('\nExisting sessions:');
    sessions.forEach((s, i) => {
      console.log(`${i + 1}. ${s.title} (${new Date(s.updatedAt).toLocaleString()})`);
    });
    
    // 用户选择
    const idx = parseInt(await question('\nSelect session (number): ')) - 1;
    const selected = sessions[idx];
    
    if (selected) {
      const loaded = await SessionManager.load(selected.id, config);
      if (loaded) {
        sessionManager = loaded;
        const msgCount = sessionManager.getSession().messages.length;
        console.log(`\n✓ Session loaded: ${sessionManager.getSession().title}`);
        console.log(`  Messages: ${msgCount} | Created: ${new Date(sessionManager.getSession().createdAt).toLocaleString()}\n`);
      }
    }
  }
}
```

#### 第三阶段：显示历史

```typescript
const session = sessionManager.getSession();
if (session.messages.length > 0) {
  console.log('\n📜 Conversation History');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const msg of session.messages) {
    if (msg.role === 'user') {
      console.log(`You: ${msg.content}\n`);
    } else if (msg.role === 'assistant') {
      console.log(`Assistant: ${msg.content}`);
      
      // 显示工具调用
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const toolCall of msg.toolCalls) {
          console.log(`\n[Tool: ${toolCall.name}]`);
          const toolResult = msg.toolResults?.find(tr => tr.toolCallId === toolCall.id);
          if (toolResult) {
            console.log(toolResult.output.split('\n').slice(0, 10).join('\n'));
            if (toolResult.output.split('\n').length > 10) {
              console.log('... (truncated)');
            }
          }
        }
      }
      console.log();
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}
```

#### 第四阶段：显示上下文使用率

```typescript
const contextStatus = sessionManager.formatContextStatus();
console.log(`${contextStatus}\n`);
```

#### 第五阶段：交互式对话循环

```typescript
console.log('💬 Interactive Mode');
console.log('Commands: "exit" or "quit" to exit, "/history" to view history, "/clear" to clear screen\n');
console.log(`Working directory: ${config.workingDir}\n`);

while (true) {
  const input = await question('You: ');
  
  // 处理命令...
}
```

## 命令处理

### exit / quit

```typescript
if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
  console.log('\n👋 Goodbye!');
  break;
}
```

### /history

```typescript
if (input.toLowerCase() === '/history') {
  const session = sessionManager.getSession();
  if (session.messages.length === 0) {
    console.log('\n📜 No conversation history yet.\n');
  } else {
    console.log('\n📜 Conversation History');
    console.log('═══════════════════════════════════════════════════════════\n');

    let messageCount = 0;
    for (const msg of session.messages) {
      if (msg.role === 'user') {
        messageCount++;
        console.log(`[${messageCount}] You: ${msg.content}\n`);
      } else if (msg.role === 'assistant') {
        console.log(`[${messageCount}] Assistant: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          console.log(`    [Used ${msg.toolCalls.length} tool(s)]`);
        }
        console.log();
      }
    }

    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`Total messages: ${session.messages.length} | Created: ${new Date(session.createdAt).toLocaleString()}`);
    
    // 显示上下文使用率
    const usage = sessionManager.getContextUsage();
    console.log(`Context: ${usage.usagePercentage}% (${usage.totalTokens.toLocaleString()}/${usage.contextLimit.toLocaleString()} tokens) | Input: ${usage.inputTokens.toLocaleString()} | Output: ${usage.outputTokens.toLocaleString()}`);
    
    console.log(`═══════════════════════════════════════════════════════════\n`);
  }
  continue;
}
```

### /clear

```typescript
if (input.toLowerCase() === '/clear') {
  console.clear();
  console.log('💬 Interactive Mode');
  console.log('Type "exit" or "quit" to exit, "/history" to view history\n');
  continue;
}
```

### 普通消息处理

```typescript
try {
  // 检查上下文警告
  const warning = sessionManager.checkContextWarning();
  if (warning) {
    console.log(`\n${warning}\n`);
  }

  // 添加用户消息
  await sessionManager.addUserMessage(input);

  // 处理消息
  console.log('\nAssistant: ');
  await sessionManager.processMessage();
  
  // 显示上下文使用率
  console.log(`\n${sessionManager.formatContextStatus()}\n`);
} catch (error: any) {
  console.error(`\nError: ${error.message}\n`);
}
```

## 错误处理

### 配置错误

```typescript
try {
  const config = getConfig();
} catch (error: any) {
  console.error(`Error: ${error.message}`);
  if (error.message.includes('GLM_API_KEY')) {
    console.log('\nPlease create a .env file with:');
    console.log('GLM_API_KEY=your-api-key');
    console.log('GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4');
    console.log('GLM_MODEL=glm-4.7');
  }
}
```

### 清理资源

```typescript
finally {
  rl.close();  // 关闭 readline 接口
}
```

## 用户体验优化

### 视觉分隔

使用分隔线区分不同区域：

```typescript
console.log('═══════════════════════════════════════════════════════════');
```

### 状态指示

使用图标和颜色提供视觉反馈：

```typescript
✓ Config loaded
✓ Session created
📜 Conversation History
🟢 Context: 5%
```

### 帮助信息

显示可用命令：

```typescript
console.log('Commands: "exit" or "quit" to exit, "/history" to view history, "/clear" to clear screen\n');
```

## 测试

### 模拟输入

```typescript
// 测试脚本
const inputs = ['1', 'Test Session', 'hello', 'exit'];
let inputIndex = 0;

function question(prompt: string): Promise<string> {
  console.log(prompt + inputs[inputIndex]);
  return Promise.resolve(inputs[inputIndex++]);
}
```

### 自动化测试

```typescript
// 使用测试框架
describe('CLI', () => {
  it('should create new session', async () => {
    // 模拟用户输入 "1" 和会话标题
    // 验证 SessionManager.create 被调用
  });
});
```
