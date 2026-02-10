# tool.ts - 工具系统核心

**← [返回文档索引](README.md)** | **[返回主文档](../README.md)**
## 概述

管理工具的注册、发现和执行，是整个工具系统的核心模块。

## 架构设计

### 注册表模式

使用 Map 存储所有注册的工具，支持动态注册：

```typescript
const toolRegistry = new Map<string, Tool>();
```

**为什么选择 Map？**
- O(1) 查找性能
- 天然的去重（键唯一）
- 支持任意类型键
- 迭代方便

### 工具生命周期

```
注册 (registerTool)
    ↓
发现 (getTool/getAllTools)
    ↓
执行 (executeTool)
```

## API 详解

### registerTool(tool: Tool): void

注册工具到系统。

**参数：**
- `tool`: Tool 对象，必须包含 id、description、parameters、execute

**示例：**

```typescript
import { BashTool } from './tools/bash.js';
import { ReadTool } from './tools/read.js';

registerTool(BashTool);
registerTool(ReadTool);
```

**错误处理：**
- 重复的 ID 会覆盖之前的工具
- 建议使用唯一的工具 ID

**线程安全：**
- 注册操作是同步的
- 执行时才涉及异步操作

### getTool(id: string): Tool | undefined

根据 ID 获取工具。

**参数：**
- `id`: 工具唯一标识符

**返回值：**
- 找到：Tool 对象
- 未找到：`undefined`

**示例：**

```typescript
const tool = getTool('bash');
if (tool) {
  console.log(tool.description);
}
```

### getAllTools(): Tool[]

获取所有已注册的工具。

**返回值：**
Tool 对象数组

**用途：**
- 初始化时传递给 LLM
- 显示可用工具列表
- 遍历执行工具

**示例：**

```typescript
const tools = getAllTools();
console.log(`Available tools: ${tools.length}`);
```

### executeTool(toolId, args, context): Promise<ToolExecuteResult>

执行指定工具。

**完整流程：**

1. **查找工具**
   ```typescript
   const tool = getTool(toolId);
   if (!tool) {
     throw new Error(`Tool not found: ${toolId}`);
   }
   ```

2. **验证参数**
   ```typescript
   const parsed = tool.parameters.safeParse(args);
   if (!parsed.success) {
     throw new Error(`Invalid arguments: ${parsed.error.message}`);
   }
   ```

3. **执行工具**
   ```typescript
   return tool.execute(parsed.data, context);
   ```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| toolId | string | 工具ID |
| args | any | 调用参数 |
| context | ToolContext | 执行上下文 |

**返回值：**

```typescript
Promise<ToolExecuteResult>
// { output: string, metadata?: object }
```

**错误处理：**

```typescript
try {
  const result = await executeTool('bash', { command: 'ls' }, context);
} catch (error) {
  if (error.message.includes('Tool not found')) {
    // 工具不存在
  } else if (error.message.includes('Invalid arguments')) {
    // 参数错误
  }
}
```

### listTools(): string

列出所有工具（用于显示）。

**输出格式：**

```
- bash: Execute shell commands
- read: Read file contents
- my_tool: My custom tool
```

## 工具上下文

### ToolContext 接口

```typescript
interface ToolContext {
  sessionId: string;    // 当前会话ID
  messageId: string;    // 当前消息ID
  workingDir: string;   // 工作目录
}
```

**用途：**

1. **路径解析**
   ```typescript
   const fullPath = path.join(context.workingDir, relativePath);
   ```

2. **日志记录**
   ```typescript
   console.log(`[${context.sessionId}] Executing tool...`);
   ```

3. **权限控制**
   ```typescript
   if (!isPathAllowed(path, context.workingDir)) {
     throw new Error('Access denied');
   }
   ```

## 扩展性

### 动态注册

可以在运行时注册新工具：

```typescript
// 从配置文件加载工具
const customTools = await loadCustomTools();
customTools.forEach(registerTool);
```

### 工具插件

支持从外部文件加载：

```typescript
// 扫描 .opencode/tool/ 目录
const files = await fs.readdir('./.opencode/tool/');
for (const file of files) {
  const { default: tool } = await import(`./.opencode/tool/${file}`);
  registerTool(tool);
}
```

## 最佳实践

### 1. 工具 ID 命名

使用小写+下划线：

```typescript
// ✅ Good
const toolId = 'read_file';
const toolId = 'exec_command';

// ❌ Bad
const toolId = 'ReadFile';      // 驼峰命名
const toolId = 'read-file';     // 短横线
```

### 2. 错误隔离

工具内部处理错误，不影响系统：

```typescript
const MyTool: Tool = {
  execute: async (args, context) => {
    try {
      // ... 执行逻辑
      return { output: 'Success' };
    } catch (error) {
      // 返回错误信息，不抛出
      return { 
        output: `Error: ${error.message}`,
        metadata: { error: true }
      };
    }
  }
};
```

### 3. 参数验证

使用 Zod 定义清晰的参数：

```typescript
parameters: z.object({
  file_path: z.string()
    .describe('Absolute path to the file'),
  offset: z.number()
    .optional()
    .default(0)
    .describe('Line number to start from')
});
```

## 性能考虑

### 当前实现

- 内存存储：所有工具在内存中
- 查找性能：O(1)
- 适合工具数量：几十到几百个

### 大规模场景

如果工具有成千上万个：

1. **分类存储**
   ```typescript
   const toolRegistry = {
     file: new Map(),    // 文件操作工具
     system: new Map(),  // 系统工具
     network: new Map(), // 网络工具
   };
   ```

2. **懒加载**
   ```typescript
   const toolLoaders = new Map();
   toolLoaders.set('heavy_tool', () => import('./heavy_tool.js'));
   ```

## 调试技巧

### 列出所有工具

```typescript
console.log('Registered tools:');
getAllTools().forEach(tool => {
  console.log(`  - ${tool.id}: ${tool.description}`);
});
```

### 验证工具

```typescript
function validateTool(tool: Tool): boolean {
  if (!tool.id) throw new Error('Tool missing id');
  if (!tool.description) throw new Error('Tool missing description');
  if (!tool.parameters) throw new Error('Tool missing parameters');
  if (!tool.execute) throw new Error('Tool missing execute');
  return true;
}
```
