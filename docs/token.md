# token.ts - Token 计算和上下文管理

## 概述

估算 Token 数量，计算上下文使用率，提供警告机制。

## 核心概念

### Token 是什么？

Token 是 LLM 处理文本的基本单位：
- 英文单词：约 0.75 个 token/单词
- 中文字符：约 0.5 个 token/字符
- 简化估算：4 字符 ≈ 1 token

### 上下文限制

每个模型都有最大上下文长度：

| 模型 | 上下文长度 | 输出限制 |
|------|-----------|---------|
| GLM-4.7 | 128K | 4K |
| Claude 3.5 | 200K | 8K |
| GPT-4 | 8K/32K | 4K/8K |

## API 详解

### 常量

#### CHARS_PER_TOKEN

字符到 token 的转换比例：

```typescript
const CHARS_PER_TOKEN = 4;  // 4字符 ≈ 1 token
```

### 函数

#### estimateTokens(text: string): number

估算文本的 token 数量。

**算法：**
```typescript
Math.round(text.length / CHARS_PER_TOKEN)
```

**示例：**

```typescript
estimateTokens("Hello World");  // 3 (11 chars / 4)
estimateTokens("你好世界");      // 2 (4 chars / 4)
```

**注意：**
- 这是简化估算，实际数量可能不同
- 真实 token 计算需要使用 tiktoken

#### calculateMessageTokens(content: string): number

`estimateTokens` 的别名，语义更清晰。

#### getModelLimits(modelName: string): ModelLimits

获取模型的上下文限制。

**支持的模型：**

```typescript
const MODEL_LIMITS = {
  'glm-4.7': {
    context: 128000,   // 128K 上下文
    output: 4096,      // 4K 输出
  },
  'default': {
    context: 8192,
    output: 4096,
  }
};
```

**匹配逻辑：**

```typescript
// 模糊匹配模型名称
if (modelName.toLowerCase().includes('glm-4.7')) {
  return MODEL_LIMITS['glm-4.7'];
}
```

#### calculateContextUsage(messages, modelName): ContextUsage

计算当前上下文使用情况。

**参数：**
- `messages`: 消息数组
- `modelName`: 模型名称

**返回值：**

```typescript
{
  totalTokens: number,        // 总使用 token 数
  contextLimit: number,       // 上下文限制
  usagePercentage: number,    // 使用率（0-100+）
  remainingTokens: number,    // 剩余 token 数
  isNearLimit: boolean,       // ≥80%
  isOverflow: boolean,        // >100%
  inputTokens: number,        // 输入 token 数
  outputTokens: number        // 输出 token 数
}
```

**计算逻辑：**

```typescript
// 统计输入和输出
totalTokens = inputTokens + outputTokens;

// 计算百分比
usagePercentage = Math.round((totalTokens / limit) * 100);

// 检查警告条件
isNearLimit = usagePercentage >= 80;
isOverflow = totalTokens > contextLimit;
```

**使用示例：**

```typescript
const messages = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' }
];

const usage = calculateContextUsage(messages, 'glm-4.7');
console.log(usage);
// {
//   totalTokens: 5,
//   contextLimit: 128000,
//   usagePercentage: 0,
//   remainingTokens: 127995,
//   isNearLimit: false,
//   isOverflow: false,
//   inputTokens: 2,
//   outputTokens: 3
// }
```

#### formatContextUsage(usage: ContextUsage): string

格式化显示使用率。

**颜色编码：**

| 使用率 | 图标 | 状态 |
|--------|------|------|
| <50% | 🟢 | 正常 |
| 50-79% | 🟠 | 注意 |
| 80-89% | 🟡 | 警告 |
| ≥90% | 🔴 | 严重 |

**输出格式：**

```typescript
// 正常状态
🟢 Context: 5% (3,200/128,000) | Remaining: 124,800

// 警告状态
🟡 Context: 82% (105,000/128,000) | Remaining: 23,000 [⚠️ Near Limit]

// 溢出状态
🔴 Context: 105% (134,400/128,000) | Remaining: -6,400 [⚠️ OVERFLOW]
```

#### getContextWarning(usage: ContextUsage): string | null

获取警告消息。

**警告级别：**

```typescript
if (isOverflow) {
  return "⚠️ Context overflow! ...";
}
if (usagePercentage >= 90) {
  return "⚠️ Critical: Context usage at 90%. ...";
}
if (usagePercentage >= 80) {
  return "⚡ Warning: Context usage at 80%. ...";
}
return null;
```

## 使用场景

### 1. 加载会话时显示

```typescript
const usage = calculateContextUsage(session.messages, config.model);
console.log(formatContextUsage(usage));
```

### 2. 每次对话后更新

```typescript
await sessionManager.processMessage();
console.log(`\n${sessionManager.formatContextStatus()}\n`);
```

### 3. 检查是否需要压缩

```typescript
const warning = sessionManager.checkContextWarning();
if (warning) {
  console.log(warning);
  // 提示用户创建新会话
}
```

## 最佳实践

### 1. 定期显示使用率

在每次对话后显示，让用户了解剩余空间。

### 2. 提前警告

在达到 80% 时警告，给用户预留操作时间。

### 3. 估算准确性

如果切换到真实模型，考虑使用 tiktoken：

```typescript
// 使用 tiktoken 进行精确计算
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4');
const tokens = enc.encode(text).length;
```

## 扩展

### 添加新模型

```typescript
MODEL_LIMITS['claude-3.5'] = {
  context: 200000,
  output: 8192,
};
```

### 自定义警告阈值

```typescript
const WARNING_THRESHOLD = 75;  // 改为 75%
const CRITICAL_THRESHOLD = 85; // 改为 85%
```
