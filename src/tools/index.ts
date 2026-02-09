import { registerTool } from '../tool.js';
import { BashTool } from './bash.js';
import { ReadTool } from './read.js';
import { WriteTool } from './write.js';

// 注册所有工具
export function initializeTools(): void {
  registerTool(BashTool);
  registerTool(ReadTool);
  registerTool(WriteTool);
  
  console.log('✓ Tools initialized: bash, read, write');
}

export { BashTool, ReadTool, WriteTool };
