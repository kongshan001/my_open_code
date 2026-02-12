import { config } from 'dotenv';
import { Config } from './types.js';

// 加载 .env 文件
config();

export function loadConfig(): Config {
  const apiKey = process.env.GLM_API_KEY;
  const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/coding/paas/v4';
  const model = process.env.GLM_MODEL || 'glm-4.7';
  
  if (!apiKey) {
    throw new Error('GLM_API_KEY not found. Please set it in .env file');
  }
  
  // 默认压缩配置
  const compressionEnabled = process.env.COMPRESSION_ENABLED === 'true';
  const compressionThreshold = parseInt(process.env.COMPRESSION_THRESHOLD || '75');
  const compressionStrategy = process.env.COMPRESSION_STRATEGY || 'summary';
  const preserveToolHistory = process.env.PRESERVE_TOOL_HISTORY !== 'false';
  const preserveRecentMessages = parseInt(process.env.PRESERVE_RECENT_MESSAGES || '10');
  const notifyBeforeCompression = process.env.NOTIFY_BEFORE_COMPRESSION !== 'false';
  
  const compression = compressionEnabled ? {
    enabled: true,
    threshold: compressionThreshold,
    strategy: compressionStrategy as 'summary' | 'sliding-window' | 'importance',
    preserveToolHistory,
    preserveRecentMessages,
    notifyBeforeCompression,
  } : undefined;

  // Rate Limit配置
  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'; // 默认启用
  const maxRequestsPerHour = parseInt(process.env.RATE_LIMIT_MAX_PER_HOUR || '100');
  const maxRequestsPerMinute = parseInt(process.env.RATE_LIMIT_MAX_PER_MINUTE || '10');
  const maxConcurrentRequests = parseInt(process.env.RATE_LIMIT_MAX_CONCURRENT || '5');
  const rateLimitQueueInterval = parseInt(process.env.RATE_LIMIT_QUEUE_INTERVAL || '1000');

  const rateLimit = rateLimitEnabled ? {
    enabled: true,
    maxRequestsPerHour,
    maxRequestsPerMinute,
    maxConcurrentRequests,
    queueInterval: rateLimitQueueInterval,
  } : undefined;

  return {
    apiKey,
    baseUrl,
    model,
    workingDir: process.cwd(),
    compression,
    rateLimit,
  };
}

export function getConfig(): Config {
  return loadConfig();
}
