# tools/read.ts - 文件读取工具

## 概述

读取文件内容，支持偏移和行数限制，包含路径安全检查。

## 安全机制

### 路径遍历防护

防止读取工作目录之外的文件：

```typescript
// 解析路径
const resolvedPath = path.isAbsolute(file_path) 
  ? file_path 
  : path.join(context.workingDir, file_path);

// 安全检查
const relative = path.relative(context.workingDir, resolvedPath);
if (relative.startsWith('..')) {
  return {
    output: `Error: Access denied. Path must be within working directory: ${context.workingDir}`,
    metadata: { blocked: true },
  };
}
```

**攻击场景防护：**

1. **绝对路径攻击**
   ```typescript
   // 用户输入: /etc/passwd
   // resolvedPath: /etc/passwd
   // relative: ../../../../etc/passwd (startsWith '..')
   // → 拒绝访问 ✅
   ```

2. **相对路径攻击**
   ```typescript
   // 用户输入: ../../etc/passwd
   // resolvedPath: /project/../../etc/passwd
   // relative: ../../etc/passwd (startsWith '..')
   // → 拒绝访问 ✅
   ```

3. **符号链接攻击**
   - 当前实现不处理符号链接
   - 解析后的实际路径仍会被检查

## 参数定义

```typescript
parameters: z.object({
  file_path: z.string()
    .describe('Absolute path or relative path to the file'),
  offset: z.number()
    .optional()
    .describe('Line number to start reading from (0-indexed)'),
  limit: z.number()
    .optional()
    .describe('Maximum number of lines to read'),
})
```

**参数说明：**

- **file_path** (必填): 文件路径，支持绝对路径和相对路径
- **offset** (可选): 起始行号（0 索引），默认 0
- **limit** (可选): 最大读取行数，默认 200

## 执行流程

### 1. 路径解析

```typescript
const resolvedPath = path.isAbsolute(file_path) 
  ? file_path 
  : path.join(context.workingDir, file_path);
```

**示例：**

```typescript
// 工作目录: /project/hello_world
// 输入: src/index.ts
// resolvedPath: /project/hello_world/src/index.ts

// 输入: /etc/passwd
// resolvedPath: /etc/passwd（保持绝对路径）
```

### 2. 安全检查

```typescript
const relative = path.relative(context.workingDir, resolvedPath);
if (relative.startsWith('..')) {
  return {
    output: `Error: Access denied...`,
    metadata: { blocked: true },
  };
}
```

### 3. 读取文件

```typescript
const content = await fs.readFile(resolvedPath, 'utf-8');
```

### 4. 处理内容

```typescript
const lines = content.split('\n');
const selectedLines = lines.slice(offset, offset + limit);
const output = selectedLines.join('\n');

const isTruncated = lines.length > limit;
```

### 5. 返回结果

```typescript
return {
  output: isTruncated 
    ? `${output}\n\n... (${lines.length - offset - limit} more lines)` 
    : output,
  metadata: {
    filePath: resolvedPath,
    totalLines: lines.length,
    displayedLines: selectedLines.length,
    truncated: isTruncated,
  },
};
```

## 使用示例

### 读取整个文件

```typescript
const result = await executeTool('read', {
  file_path: 'package.json'
}, context);

console.log(result.output);
// {
//   "name": "hello_world_opencode",
//   "version": "0.1.0",
//   ...
// }
```

### 使用绝对路径

```typescript
const result = await executeTool('read', {
  file_path: '/project/hello_world/README.md'
}, context);
```

### 读取部分行

```typescript
const result = await executeTool('read', {
  file_path: 'large-file.txt',
  offset: 100,   // 从第 101 行开始
  limit: 50      // 读取 50 行
}, context);
```

### 访问被拒绝

```typescript
const result = await executeTool('read', {
  file_path: '../../etc/passwd'
}, context);

console.log(result.output);
// Error: Access denied. Path must be within working directory: /project/hello_world
```

## 返回值

```typescript
{
  output: string;              // 文件内容
  metadata: {
    filePath: string;          // 解析后的绝对路径
    totalLines: number;        // 文件总行数
    displayedLines: number;    // 实际显示行数
    truncated: boolean;        // 是否被截断
    blocked?: boolean;         // 是否被安全系统阻止
    error?: string;            // 错误信息（如有）
  }
}
```

## 大文件处理

### 自动截断

对于大文件，默认只显示前 200 行：

```typescript
// 文件有 1000 行
const result = await executeTool('read', {
  file_path: 'large.txt'
  // offset: 0 (默认)
  // limit: 200 (默认)
}, context);

console.log(result.metadata);
// {
//   totalLines: 1000,
//   displayedLines: 200,
//   truncated: true
// }

console.log(result.output);
// ... (前 200 行)
// ... (800 more lines)
```

### 分页读取

可以分多次读取大文件：

```typescript
// 第一次读取
const page1 = await executeTool('read', {
  file_path: 'large.txt',
  offset: 0,
  limit: 200
}, context);

// 第二次读取
const page2 = await executeTool('read', {
  file_path: 'large.txt',
  offset: 200,
  limit: 200
}, context);

// 以此类推...
```

## 错误场景

### 文件不存在

```
Error reading file: ENOENT: no such file or directory
```

### 权限不足

```
Error reading file: EACCES: permission denied
```

### 是目录而非文件

```
Error reading file: EISDIR: illegal operation on a directory
```

### 路径越界

```
Error: Access denied. Path must be within working directory
```

## 性能考虑

### 当前实现

- 读取整个文件到内存
- 适合中小文件（<10MB）

### 大文件优化

对于超大文件（>100MB）：

```typescript
// 使用流式读取
const stream = fs.createReadStream(resolvedPath, {
  start: offset * averageLineLength,
  end: (offset + limit) * averageLineLength
});

// 逐行读取
const rl = readline.createInterface({ input: stream });
let lineCount = 0;
for await (const line of rl) {
  if (lineCount >= offset && lineCount < offset + limit) {
    output += line + '\n';
  }
  lineCount++;
}
```

## 测试

### 单元测试

```typescript
describe('ReadTool', () => {
  it('should read file content', async () => {
    const result = await ReadTool.execute(
      { file_path: 'test.txt' },
      { sessionId: 'test', messageId: 'test', workingDir: '/tmp' }
    );
    expect(result.metadata.totalLines).toBeGreaterThan(0);
  });

  it('should block path traversal', async () => {
    const result = await ReadTool.execute(
      { file_path: '../../etc/passwd' },
      { sessionId: 'test', messageId: 'test', workingDir: '/tmp/project' }
    );
    expect(result.metadata.blocked).toBe(true);
  });

  it('should respect offset and limit', async () => {
    const result = await ReadTool.execute(
      { file_path: '10-lines.txt', offset: 2, limit: 3 },
      context
    );
    expect(result.metadata.displayedLines).toBe(3);
  });
});
```

## 扩展功能

### 1. 二进制文件检测

```typescript
// 检测是否为二进制文件
const isBinary = (buffer: Buffer) => {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
};
```

### 2. 文件类型提示

```typescript
// 根据扩展名提供提示
const ext = path.extname(file_path);
if (ext === '.json') {
  // 验证 JSON 格式
}
```

### 3. 编码检测

```typescript
// 自动检测文件编码
import * as chardet from 'chardet';
const encoding = chardet.detectFileSync(resolvedPath);
const content = await fs.readFile(resolvedPath, encoding);
```
