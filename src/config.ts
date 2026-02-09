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
  
  return {
    apiKey,
    baseUrl,
    model,
    workingDir: process.cwd(),
  };
}

export function getConfig(): Config {
  return loadConfig();
}
