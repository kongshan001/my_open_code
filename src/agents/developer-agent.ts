import { BaseAgent } from '../agent-base.js';
import { AgentConfig, AgentExecutionResult } from '../agent-types.js';
import { Task, ScriptConfig } from '../web-types.js';
import { executeTool } from '../tool.js';
import { spawn } from 'child_process';

export class DeveloperAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> = {}) {
    const defaultConfig: AgentConfig = {
      id: config.id || 'agent-developer-1',
      name: config.name || 'Developer Agent',
      role: 'developer',
      description: 'Specialized in code generation, debugging, testing, and technical tasks',
      systemPrompt: `You are an expert software developer assistant. Your role is to:
1. Write clean, maintainable code following best practices
2. Debug issues and fix bugs
3. Write comprehensive tests
4. Review code for quality and security
5. Provide technical explanations and documentation
6. Follow coding standards and conventions`,
      tools: ['bash', 'read', 'write', 'grep', 'git'],
      capabilities: [
        { id: 'code-gen', name: 'Code Generation', description: 'Generate code in multiple languages', enabled: true },
        { id: 'debug', name: 'Debugging', description: 'Debug and fix code issues', enabled: true },
        { id: 'test', name: 'Testing', description: 'Write and run tests', enabled: true },
        { id: 'review', name: 'Code Review', description: 'Review code for quality', enabled: true },
        { id: 'doc', name: 'Documentation', description: 'Write technical documentation', enabled: true },
      ],
      priority: config.priority || 'high',
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      timeout: config.timeout || 60000,
    };
    
    super({ ...defaultConfig, ...config } as AgentConfig);
  }

  async execute(task: Task): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.updateStatus('busy');

    try {
      console.log(`[${this.name}] Executing task: ${task.name}`);

      let output = '';

      switch (task.type) {
        case 'script':
          output = await this.executeScript(task);
          break;
        case 'file':
          output = await this.handleFileOperation(task);
          break;
        case 'api':
          output = await this.handleApiCall(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      const result = this.createExecutionResult(true, output, startTime);
      return result;
    } catch (error: any) {
      const result = this.createExecutionResult(false, '', startTime, error.message);
      return result;
    }
  }

  private async executeScript(task: Task): Promise<string> {
    const scriptConfig = task.config.script as ScriptConfig;
    if (!scriptConfig) {
      throw new Error('Script configuration is missing');
    }

    const context = this.getToolContext(task);

    if (scriptConfig.language === 'bash') {
      return await this.runBashScript(scriptConfig, context);
    } else if (scriptConfig.language === 'node') {
      return await this.runNodeScript(scriptConfig, context);
    } else {
      throw new Error(`Language ${scriptConfig.language} not supported yet`);
    }
  }

  private async runBashScript(script: ScriptConfig, context: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', script.script], {
        cwd: script.workingDir || process.cwd(),
        env: { ...process.env, ...script.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout || 'Script executed successfully');
        } else {
          reject(new Error(`Script failed with exit code ${code}\n${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  private async runNodeScript(script: ScriptConfig, context: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['-e', script.script], {
        cwd: script.workingDir || process.cwd(),
        env: { ...process.env, ...script.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout || 'Node script executed successfully');
        } else {
          reject(new Error(`Node script failed with exit code ${code}\n${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  private async handleFileOperation(task: Task): Promise<string> {
    const fileConfig = task.config.file;
    if (!fileConfig) {
      throw new Error('File configuration is missing');
    }

    const context = this.getToolContext(task);

    switch (fileConfig.operation) {
      case 'read':
        const readResult = await executeTool('read', {
          file_path: fileConfig.path,
          offset: 0,
          limit: 2000,
        }, context);
        return readResult.output;

      case 'write':
        const writeResult = await executeTool('bash', {
          command: `cat > "${fileConfig.path}" << 'EOF'\n${fileConfig.content}\nEOF`,
        }, context);
        return writeResult.output;

      default:
        throw new Error(`File operation ${fileConfig.operation} not implemented`);
    }
  }

  private async handleApiCall(task: Task): Promise<string> {
    const apiConfig = task.config.api;
    if (!apiConfig) {
      throw new Error('API configuration is missing');
    }

    const response = await fetch(apiConfig.url, {
      method: apiConfig.method,
      headers: apiConfig.headers,
      body: apiConfig.body ? JSON.stringify(apiConfig.body) : undefined,
    });

    const text = await response.text();

    if (apiConfig.expectedStatus && !apiConfig.expectedStatus.includes(response.status)) {
      throw new Error(`API call failed with status ${response.status}: ${text}`);
    }

    return text;
  }
}