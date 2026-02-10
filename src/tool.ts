import { Tool, ToolContext, ToolExecuteResult } from './types.js';

// 工具注册表
const toolRegistry = new Map<string, Tool>();

export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.id, tool);
}

export function getTool(id: string): Tool | undefined {
  return toolRegistry.get(id);
}

export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values());
}

export async function executeTool(
  toolId: string,
  args: any,
  context: ToolContext
): Promise<ToolExecuteResult> {
  const tool = getTool(toolId);
  if (!tool) {
    throw new Error(`Tool not found: ${toolId}`);
  }
  
  // 验证参数
  const parsed = tool.parameters.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid arguments for tool ${toolId}: ${parsed.error.message}`);
  }
  
  return tool.execute(parsed.data, context);
}
