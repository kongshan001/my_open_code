import { BaseAgent } from '../agent-base.js';
import { AgentConfig, AgentExecutionResult } from '../agent-types.js';
import { Task, ScriptConfig } from '../web-types.js';
import { executeTool } from '../tool.js';
import { spawn } from 'child_process';

export class TesterAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> = {}) {
    const defaultConfig: AgentConfig = {
      id: config.id || 'agent-tester-1',
      name: config.name || 'QA Tester Agent',
      role: 'tester',
      description: 'Specialized in quality assurance, testing, and validation',
      systemPrompt: `You are an expert QA tester. Your role is to:
1. Write comprehensive test cases (unit, integration, e2e)
2. Execute tests and report results
3. Analyze test failures and identify root causes
4. Create test data and fixtures
5. Perform code coverage analysis
6. Validate requirements and acceptance criteria`,
      tools: ['bash', 'read', 'grep', 'test-runner'],
      capabilities: [
        { id: 'test-gen', name: 'Test Generation', description: 'Generate test cases', enabled: true },
        { id: 'test-exec', name: 'Test Execution', description: 'Execute tests and report results', enabled: true },
        { id: 'test-analyze', name: 'Test Analysis', description: 'Analyze test failures', enabled: true },
        { id: 'coverage', name: 'Coverage Analysis', description: 'Analyze code coverage', enabled: true },
        { id: 'validation', name: 'Validation', description: 'Validate requirements', enabled: true },
      ],
      priority: config.priority || 'medium',
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      timeout: config.timeout || 90000,
    };
    
    super({ ...defaultConfig, ...config } as AgentConfig);
  }

  async execute(task: Task): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.updateStatus('busy');

    try {
      console.log(`[${this.name}] Testing task: ${task.name}`);

      let output = '';

      switch (task.type) {
        case 'script':
          output = await this.executeTestScript(task);
          break;
        case 'custom':
          output = await this.executeCustomTest(task);
          break;
        case 'api':
          output = await this.executeApiTest(task);
          break;
        default:
          throw new Error(`Unsupported task type for tester: ${task.type}`);
      }

      const result = this.createExecutionResult(true, output, startTime);
      return result;
    } catch (error: any) {
      const result = this.createExecutionResult(false, '', startTime, error.message);
      return result;
    }
  }

  private async executeTestScript(task: Task): Promise<string> {
    const scriptConfig = task.config.script as ScriptConfig;
    if (!scriptConfig) {
      throw new Error('Script configuration is missing');
    }

    const context = this.getToolContext(task);

    return new Promise((resolve, reject) => {
      const args = this.getTestCommand(scriptConfig);
      const child = spawn(args.command, args.args, {
        cwd: scriptConfig.workingDir || process.cwd(),
        env: { ...process.env, ...scriptConfig.env },
      });

      let stdout = '';
      let stderr = '';
      let passCount = 0;
      let failCount = 0;

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        const passMatches = output.match(/PASS|pass|✓/g);
        const failMatches = output.match(/FAIL|fail|✗|Error/g);
        
        if (passMatches) passCount += passMatches.length;
        if (failMatches) failCount += failMatches.length;
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const summary = `
=== Test Execution Summary ===
Exit Code: ${code}
Passed: ${passCount}
Failed: ${failCount}
Total: ${passCount + failCount}

${stdout}
${stderr}
        `.trim();
        
        if (code === 0) {
          resolve(summary);
        } else {
          reject(new Error(summary));
        }
      });

      child.on('error', reject);
    });
  }

  private getTestCommand(script: ScriptConfig): { command: string; args: string[] } {
    switch (script.language) {
      case 'bash':
        return { command: 'bash', args: ['-c', script.script] };
      case 'node':
        return { command: 'npm', args: ['test'] };
      case 'python':
        return { command: 'python', args: ['-m', 'pytest'] };
      default:
        return { command: 'bash', args: ['-c', script.script] };
    }
  }

  private async executeCustomTest(task: Task): Promise<string> {
    const customConfig = task.config.custom;
    if (!customConfig) {
      throw new Error('Custom configuration is missing');
    }

    try {
      const testFn = eval(`(${customConfig.function})`);
      if (typeof testFn !== 'function') {
        throw new Error('Custom configuration must contain a function');
      }

      const result = await testFn(customConfig.parameters);
      
      const summary = `
=== Custom Test Execution ===
Status: PASSED
Result: ${JSON.stringify(result, null, 2)}
Parameters: ${JSON.stringify(customConfig.parameters, null, 2)}
      `.trim();

      return summary;
    } catch (error: any) {
      throw new Error(`Custom test execution failed: ${error.message}`);
    }
  }

  private async executeApiTest(task: Task): Promise<string> {
    const apiConfig = task.config.api;
    if (!apiConfig) {
      throw new Error('API configuration is missing');
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(apiConfig.url, {
        method: apiConfig.method,
        headers: apiConfig.headers,
        body: apiConfig.body ? JSON.stringify(apiConfig.body) : undefined,
      });

      const duration = Date.now() - startTime;
      const text = await response.text();

      const statusCheck = apiConfig.expectedStatus 
        ? apiConfig.expectedStatus.includes(response.status)
        : response.status >= 200 && response.status < 300;

      const summary = `
=== API Test Summary ===
Status: ${statusCheck ? 'PASSED' : 'FAILED'}
URL: ${apiConfig.url}
Method: ${apiConfig.method}
Expected Status: ${apiConfig.expectedStatus?.join(', ') || '2xx'}
Actual Status: ${response.status}
Response Time: ${duration}ms
Response: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}
      `.trim();

      if (!statusCheck) {
        throw new Error(summary);
      }

      return summary;
    } catch (error: any) {
      throw new Error(`API test failed: ${error.message}`);
    }
  }
}