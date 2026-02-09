# Extension Development Guide

This document explains how to extend Hello World OpenCode functionality.

## Adding New Tools

### Step 1: Create Tool File

Create a new tool file in `src/tools/`, e.g., `grep.ts`:

```typescript
import { z } from 'zod';
import { Tool, ToolContext, ToolExecuteResult } from '../types.js';
import { execSync } from 'child_process';

export const GrepTool: Tool = {
  id: 'grep',
  description: 'Search for patterns in files',
  parameters: z.object({
    pattern: z.string().describe('Search pattern (regex)'),
    path: z.string().optional().describe('Directory or file to search'),
  }),
  
  async execute(args, context) {
    const { pattern, path = '.' } = args;
    
    try {
      const output = execSync(`grep -r "${pattern}" ${path} -n`, {
        cwd: context.workingDir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      
      return {
        output: output.trim(),
        metadata: { pattern, path },
      };
    } catch (error: any) {
      return {
        output: 'No matches found',
        metadata: { pattern, path, error: error.message },
      };
    }
  },
};
```

### Step 2: Register Tool

Register in `src/tools/index.ts`:

```typescript
import { registerTool } from '../tool.js';
import { BashTool } from './bash.js';
import { ReadTool } from './read.js';
import { GrepTool } from './grep.js';  // Import new tool

export function initializeTools(): void {
  registerTool(BashTool);
  registerTool(ReadTool);
  registerTool(GrepTool);  // Register new tool
  
  console.log('✓ Tools initialized: bash, read, grep');
}
```

### Step 3: Test

Restart the application, AI can now use the new tool.

## Tool Development Guidelines

### Tool ID
- Use lowercase letters and underscores
- Short but descriptive, e.g.: `read_file`, `exec_command`

### Parameter Definition
- Use Zod for parameter schema
- Each parameter should have `describe()`
- Required first, optional after
- Use sensible defaults

```typescript
parameters: z.object({
  file_path: z.string().describe('Absolute path to file'),
  offset: z.number().optional().default(0),
  limit: z.number().optional().default(100),
})
```

### Error Handling
- Always return valid ToolExecuteResult
- Include error info in metadata
- User-friendly error messages

### Security
- Validate paths are within workingDir
- Check for dangerous operations
- Set reasonable timeouts

## Advanced Extensions

### Custom System Prompt

Create `data/prompt.txt` to override default system prompt.

### Switch Models

Modify `.env`:

```env
GLM_MODEL=glm-4-plus
```

### Session Export

Add to `src/storage.ts`:

```typescript
export async function exportSession(sessionId: string, format: 'json' | 'md'): Promise<string> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error('Session not found');
  
  if (format === 'md') {
    const lines = [
      `# ${session.title}`,
      '',
      ...session.messages.map(m => {
        const role = m.role === 'user' ? '**User**' : '**Assistant**';
        return `${role}:\n${m.content}\n`;
      }),
    ];
    return lines.join('\n');
  }
  
  return JSON.stringify(session, null, 2);
}
```
