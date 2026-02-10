import { z } from 'zod';
import { Tool, ToolContext, ToolExecuteResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 危险命令检查
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\/null/,
  /mkfs/,
  /dd\s+if=/,
];

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

export const BashTool: Tool = {
  id: 'bash',
  description: 'Execute shell commands in the working directory',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
  }),
  
  async execute(args: { command: string; timeout?: number }, context: ToolContext): Promise<ToolExecuteResult> {
    const { command, timeout = 30000 } = args;
    
    // 安全检查
    if (isDangerousCommand(command)) {
      return {
        output: `Error: Dangerous command detected and blocked: ${command}`,
        metadata: { blocked: true },
      };
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.workingDir,
        timeout,
      });
      
      const output = stdout || stderr || 'Command executed successfully (no output)';
      
      return {
        output: output.trim(),
        metadata: {
          command,
          exitCode: 0,
        },
      };
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
  },
};
