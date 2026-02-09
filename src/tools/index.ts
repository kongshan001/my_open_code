import { registerTool } from '../tool.js';
import { BashTool } from './bash.js';
import { ReadTool } from './read.js';

// 注册所有工具
export function initializeTools(): void {
  registerTool(BashTool);
  registerTool(ReadTool);
  
  console.log('✓ Tools initialized: bash, read');
}

export { BashTool, ReadTool };
