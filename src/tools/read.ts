import { z } from 'zod';
import { Tool, ToolContext, ToolExecuteResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export const ReadTool: Tool = {
  id: 'read',
  description: 'Read file contents from the working directory',
  parameters: z.object({
    file_path: z.string().describe('Absolute path or relative path to the file'),
    offset: z.number().optional().describe('Line number to start reading from (0-indexed)'),
    limit: z.number().optional().describe('Maximum number of lines to read'),
  }),
  
  async execute(args: { file_path: string; offset?: number; limit?: number }, context: ToolContext): Promise<ToolExecuteResult> {
    const { file_path, offset = 0, limit = 200 } = args;
    
    // 解析路径
    const resolvedPath = path.isAbsolute(file_path) 
      ? file_path 
      : path.join(context.workingDir, file_path);
    
    try {
      // 安全检查：确保在workingDir内
      const relative = path.relative(context.workingDir, resolvedPath);
      if (relative.startsWith('..')) {
        return {
          output: `Error: Access denied. Path must be within working directory: ${context.workingDir}`,
          metadata: { blocked: true },
        };
      }
      
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');
      
      // 应用offset和limit
      const selectedLines = lines.slice(offset, offset + limit);
      const output = selectedLines.join('\n');
      
      const isTruncated = lines.length > limit;
      
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
    } catch (error: any) {
      return {
        output: `Error reading file: ${error.message}`,
        metadata: {
          filePath: resolvedPath,
          error: error.message,
        },
      };
    }
  },
};
