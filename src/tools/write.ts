import { z } from 'zod';
import { Tool, ToolContext, ToolExecuteResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export const WriteTool: Tool = {
  id: 'write',
  description: 'Write content to a file in the working directory',
  parameters: z.object({
    file_path: z.string().describe('Absolute path or relative path to the file'),
    content: z.string().describe('Content to write to the file'),
    mode: z.enum(['overwrite', 'append']).optional().describe('Write mode: "overwrite" (default) or "append"'),
    create_dirs: z.boolean().optional().describe('Create parent directories if they do not exist (default: true)'),
  }),
  
  async execute(args: { file_path: string; content: string; mode?: 'overwrite' | 'append'; create_dirs?: boolean }, context: ToolContext): Promise<ToolExecuteResult> {
    const { file_path, content, mode = 'overwrite', create_dirs = true } = args;
    
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
          metadata: { blocked: true, filePath: resolvedPath },
        };
      }

      // 检查父目录是否存在，不存在则创建
      const dirPath = path.dirname(resolvedPath);
      
      if (create_dirs) {
        try {
          await fs.mkdir(dirPath, { recursive: true });
        } catch (error: any) {
          if (error.code !== 'EEXIST') {
            return {
              output: `Error creating directory: ${error.message}`,
              metadata: {
                filePath: resolvedPath,
                dirPath,
                error: error.message,
              },
            };
          }
        }
      } else {
        // 检查父目录是否存在
        try {
          await fs.access(dirPath);
        } catch {
          return {
            output: `Error: Parent directory does not exist: ${dirPath}. Use create_dirs=true to create it automatically.`,
            metadata: {
              filePath: resolvedPath,
              dirPath,
              error: 'Parent directory does not exist',
            },
          };
        }
      }

      // 写入文件
      let bytesWritten: number;
      if (mode === 'append') {
        await fs.appendFile(resolvedPath, content, 'utf-8');
        const stats = await fs.stat(resolvedPath);
        bytesWritten = stats.size;
      } else {
        await fs.writeFile(resolvedPath, content, 'utf-8');
        bytesWritten = Buffer.byteLength(content, 'utf-8');
      }

      // 获取文件信息
      const stats = await fs.stat(resolvedPath);
      const lines = content.split('\n').length;

      return {
        output: `Successfully wrote ${bytesWritten.toLocaleString()} bytes (${lines} line${lines !== 1 ? 's' : ''}) to ${resolvedPath}`,
        metadata: {
          filePath: resolvedPath,
          mode,
          bytesWritten,
          linesWritten: lines,
          fileSize: stats.size,
          createdAt: stats.birthtimeMs,
          modifiedAt: stats.mtimeMs,
        },
      };
    } catch (error: any) {
      return {
        output: `Error writing file: ${error.message}`,
        metadata: {
          filePath: resolvedPath,
          error: error.message,
          code: error.code,
        },
      };
    }
  },
};
