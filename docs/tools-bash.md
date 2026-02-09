# tools/bash.ts - Bash 命令工具

## 概述

执行 shell 命令，支持超时设置和安全检查。

## 安全机制

### 危险命令检测

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,      // rm -rf / （删除根目录）
  />\s*\/dev\/null/,     // 重定向到 /dev/null
  /mkfs/,               // 格式化文件系统
  /dd\s+if=/,           // dd 命令（低级复制）
];
```

**为什么这些命令危险？**

1. **rm -rf /**: 递归强制删除根目录下所有文件
2. **> /dev/null**: 可能用于隐藏恶意操作
3. **mkfs**: 格式化磁盘，会清除数据
4. **dd if=**: 可以直接写入磁盘，破坏文件系统

### 安全策略

```typescript
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}
```

**处理流程：**

```
接收命令
    ↓
安全检查
    ├─ 危险 → 返回错误，不执行
    └─ 安全 → 继续执行
    ↓
执行命令
```

## 参数定义

```typescript
parameters: z.object({
  command: z.string()
    .describe('The shell command to execute'),
  timeout: z.number()
    .optional()
    .describe('Timeout in milliseconds (default: 30000)'),
})
```

**参数说明：**

- **command** (必填): 要执行的 shell 命令
- **timeout** (可选): 超时时间，默认 30 秒

## 执行流程

### 1. 安全检查

```typescript
if (isDangerousCommand(command)) {
  return {
    output: `Error: Dangerous command detected and blocked: ${command}`,
    metadata: { blocked: true },
  };
}
```

### 2. 执行命令

使用 Node.js 的 `child_process.exec`：

```typescript
const { stdout, stderr } = await execAsync(command, {
  cwd: context.workingDir,  // 在工作目录执行
  timeout,                   // 超时设置
});
```

### 3. 处理输出

```typescript
const output = stdout || stderr || 'Command executed successfully (no output)';

return {
  output: output.trim(),
  metadata: {
    command,
    exitCode: 0,
  },
};
```

### 4. 错误处理

```typescript
try {
  // ... 执行命令
} catch (error: any) {
  return {
    output: `Error executing command: ${error.message}\n${error.stderr || ''}`,
    metadata: {
      command,
      exitCode: error.code || 1,
      error: error.message,
    },
  };
}
```

## 使用示例

### 列出文件

```typescript
const result = await executeTool('bash', {
  command: 'ls -la'
}, context);

console.log(result.output);
// total 160
// drwxr-xr-x  11 user  staff   352 Feb  8 11:45 .
// ...
```

### 带超时的命令

```typescript
const result = await executeTool('bash', {
  command: 'sleep 10',
  timeout: 5000  // 5 秒超时
}, context);

// 如果超时：
// Error executing command: Command timeout
```

### 查看当前目录

```typescript
const result = await executeTool('bash', {
  command: 'pwd'
}, context);

console.log(result.output);
// /Users/ks_128/Documents/open_code_source_learn/hello_world
```

## 返回值

```typescript
{
  output: string;       // 命令输出（stdout + stderr）
  metadata: {
    command: string;    // 执行的命令
    exitCode: number;   // 退出码（0 表示成功）
    error?: string;     // 错误信息（如有）
    blocked?: boolean;  // 是否被安全系统阻止
  }
}
```

## 错误场景

### 命令不存在

```
Error executing command: Command failed: abc123
/bin/sh: abc123: command not found
```

### 权限不足

```
Error executing command: Command failed: rm /etc/passwd
rm: /etc/passwd: Permission denied
```

### 超时

```
Error executing command: Command timeout
```

### 被安全系统阻止

```
Error: Dangerous command detected and blocked: rm -rf /
```

## 安全增强

### 当前限制

- 仅基于正则表达式检测
- 无法检测所有危险命令

### 改进方案

1. **白名单模式**
   ```typescript
   const ALLOWED_COMMANDS = ['ls', 'cat', 'grep', 'pwd'];
   if (!ALLOWED_COMMANDS.includes(commandName)) {
     return { error: 'Command not allowed' };
   }
   ```

2. **沙箱执行**
   ```typescript
   // 使用 Docker 或 chroot
   exec(`docker run --rm -v ${cwd}:/work alpine sh -c "${command}"`);
   ```

3. **用户确认**
   ```typescript
   if (isPotentiallyDangerous(command)) {
     const confirmed = await askUser(`Execute "${command}"?`);
     if (!confirmed) return { error: 'Cancelled by user' };
   }
   ```

## 性能考虑

### 超时机制

- 防止长时间运行的命令阻塞系统
- 默认 30 秒，可自定义

### 输出限制

当前实现返回完整输出，对于大输出：

```typescript
// 可以限制输出大小
const MAX_OUTPUT = 10000;
if (output.length > MAX_OUTPUT) {
  output = output.substring(0, MAX_OUTPUT) + '\n... (truncated)';
}
```

## 测试

### 单元测试

```typescript
describe('BashTool', () => {
  it('should execute simple command', async () => {
    const result = await BashTool.execute(
      { command: 'echo hello' },
      { sessionId: 'test', messageId: 'test', workingDir: '/tmp' }
    );
    expect(result.output).toBe('hello');
  });

  it('should block dangerous command', async () => {
    const result = await BashTool.execute(
      { command: 'rm -rf /' },
      context
    );
    expect(result.metadata.blocked).toBe(true);
  });
});
```
