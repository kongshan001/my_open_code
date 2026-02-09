// Token 估算工具
// 参考 OpenCode: 4 个字符 ≈ 1 个 token（简化估算）

export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.max(0, Math.round((text || '').length / CHARS_PER_TOKEN));
}

export function calculateMessageTokens(content: string): number {
  return estimateTokens(content);
}

// 模型上下文限制配置
export interface ModelLimits {
  context: number;  // 总上下文限制
  input?: number;   // 输入限制（可选）
  output: number;   // 输出限制
}

// GLM-4.7 模型限制（需要根据实际模型调整）
export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'glm-4.7': {
    context: 128000,  // 128K 上下文
    output: 4096,     // 4K 输出
  },
  'glm-4.7-coding': {
    context: 128000,
    output: 4096,
  },
  'default': {
    context: 8192,
    output: 4096,
  }
};

export function getModelLimits(modelName: string): ModelLimits {
  // 匹配模型名称
  for (const [key, limits] of Object.entries(MODEL_LIMITS)) {
    if (modelName.toLowerCase().includes(key.toLowerCase())) {
      return limits;
    }
  }
  return MODEL_LIMITS.default;
}

// 计算上下文使用率
export interface ContextUsage {
  totalTokens: number;
  contextLimit: number;
  usagePercentage: number;
  remainingTokens: number;
  isNearLimit: boolean;
  isOverflow: boolean;
  inputTokens: number;
  outputTokens: number;
}

export function calculateContextUsage(
  messages: { role: string; content: string }[],
  modelName: string
): ContextUsage {
  const limits = getModelLimits(modelName);
  
  let inputTokens = 0;
  let outputTokens = 0;
  
  for (const msg of messages) {
    const tokens = calculateMessageTokens(msg.content);
    if (msg.role === 'user') {
      inputTokens += tokens;
    } else if (msg.role === 'assistant') {
      outputTokens += tokens;
    }
  }
  
  const totalTokens = inputTokens + outputTokens;
  const usagePercentage = Math.round((totalTokens / limits.context) * 100);
  const remainingTokens = limits.context - totalTokens;
  
  // 当使用率超过 80% 时警告，90% 时严重警告
  const isNearLimit = usagePercentage >= 80;
  const isOverflow = totalTokens > limits.context;
  
  return {
    totalTokens,
    contextLimit: limits.context,
    usagePercentage,
    remainingTokens,
    isNearLimit,
    isOverflow,
    inputTokens,
    outputTokens,
  };
}

// 格式化显示
export function formatContextUsage(usage: ContextUsage): string {
  const { usagePercentage, totalTokens, contextLimit, remainingTokens } = usage;
  
  // 根据使用率选择颜色/表情
  let indicator = '🟢';
  if (usagePercentage >= 90) indicator = '🔴';
  else if (usagePercentage >= 80) indicator = '🟡';
  else if (usagePercentage >= 50) indicator = '🟠';
  
  let status = '';
  if (usage.isOverflow) {
    status = ' [⚠️  OVERFLOW]';
  } else if (usage.isNearLimit) {
    status = ' [⚠️  Near Limit]';
  }
  
  return `${indicator} Context: ${usagePercentage}% (${totalTokens.toLocaleString()}/${contextLimit.toLocaleString()}) | Remaining: ${remainingTokens.toLocaleString()}${status}`;
}

// 获取警告消息
export function getContextWarning(usage: ContextUsage): string | null {
  if (usage.isOverflow) {
    return `⚠️  Context overflow! Current: ${usage.totalTokens.toLocaleString()} tokens, Limit: ${usage.contextLimit.toLocaleString()} tokens. Please start a new session.`;
  }
  if (usage.usagePercentage >= 90) {
    return `⚠️  Critical: Context usage at ${usage.usagePercentage}%. Consider starting a new session soon.`;
  }
  if (usage.usagePercentage >= 80) {
    return `⚡ Warning: Context usage at ${usage.usagePercentage}%. Approaching limit.`;
  }
  return null;
}
