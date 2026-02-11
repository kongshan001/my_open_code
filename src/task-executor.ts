import { Task, TaskExecution, TaskType, TaskStatus, ValidationResult, Artifact } from './web-types.js';

export class TaskExecutor {
  private executions: Map<string, TaskExecution> = new Map();

  async execute(task: Task): Promise<TaskExecution> {
    const executionId = this.generateExecutionId();
    const execution: TaskExecution = {
      id: executionId,
      taskId: task.id,
      status: 'running',
      startTime: Date.now(),
      output: '',
      progress: 0,
      retryCount: 0,
    };

    this.executions.set(executionId, execution);

    try {
      let result: { output: string; artifacts?: Artifact[] };

      switch (task.type) {
        case 'script':
          result = await this.executeScript(task);
          break;
        case 'api':
          result = await this.executeApiCall(task);
          break;
        case 'file':
          result = await this.executeFileOperation(task);
          break;
        case 'custom':
          result = await this.executeCustom(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      execution.output = result.output;
      execution.progress = 100;
      execution.artifacts = result.artifacts;

      const validationResult = await this.validate(task, execution);
      execution.validation = validationResult;

      if (validationResult.passed || task.validation.requireManualReview) {
        execution.status = 'completed';
      } else {
        execution.status = 'failed';
      }

    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.output += `\n\nError: ${error.message}`;
    }

    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;

    return execution;
  }

  private async executeScript(task: Task): Promise<{ output: string; artifacts?: Artifact[] }> {
    const scriptConfig = task.config.script;
    if (!scriptConfig) {
      throw new Error('Script configuration is missing');
    }

    const startTime = Date.now();
    let output = '';

    if (scriptConfig.language === 'bash') {
      output = await this.runBashScript(scriptConfig.script, scriptConfig.workingDir, scriptConfig.env);
    } else if (scriptConfig.language === 'node') {
      output = await this.runNodeScript(scriptConfig.script, scriptConfig.workingDir, scriptConfig.env);
    } else {
      throw new Error(`Script language '${scriptConfig.language}' not yet supported`);
    }

    return { output };
  }

  private async runBashScript(script: string, workingDir?: string, env?: Record<string, string>): Promise<string> {
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tempDir = workingDir || os.tmpdir();
    const scriptPath = path.join(tempDir, `script-${Date.now()}.sh`);

    await fs.writeFile(scriptPath, script, { mode: 0o755 });

    return new Promise((resolve, reject) => {
      const child = spawn('bash', [scriptPath], {
        cwd: tempDir,
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        fs.unlink(scriptPath).catch(() => {});

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Script failed with exit code ${code}\n${stderr}`));
        }
      });

      child.on('error', (error: Error) => {
        fs.unlink(scriptPath).catch(() => {});
        reject(error);
      });
    });
  }

  private async runNodeScript(script: string, workingDir?: string, env?: Record<string, string>): Promise<string> {
    const { spawn } = await import('child_process');
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tempDir = workingDir || os.tmpdir();
    const scriptPath = path.join(tempDir, `script-${Date.now()}.js`);

    await fs.writeFile(scriptPath, script);

    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd: tempDir,
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        fs.unlink(scriptPath).catch(() => {});

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Script failed with exit code ${code}\n${stderr}`));
        }
      });

      child.on('error', (error: Error) => {
        fs.unlink(scriptPath).catch(() => {});
        reject(error);
      });
    });
  }

  private async executeApiCall(task: Task): Promise<{ output: string }> {
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
      throw new Error(`Expected status ${apiConfig.expectedStatus.join(' or ')}, got ${response.status}\n${text}`);
    }

    return { output: text };
  }

  private async executeFileOperation(task: Task): Promise<{ output: string }> {
    const fileConfig = task.config.file;
    if (!fileConfig) {
      throw new Error('File configuration is missing');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    switch (fileConfig.operation) {
      case 'read': {
        const content = await fs.readFile(fileConfig.path, 'utf-8');
        return { output: content };
      }
      case 'write': {
        await fs.mkdir(path.dirname(fileConfig.path), { recursive: true });
        await fs.writeFile(fileConfig.path, fileConfig.content || '');
        return { output: `File written to ${fileConfig.path}` };
      }
      case 'delete': {
        await fs.unlink(fileConfig.path);
        return { output: `File deleted: ${fileConfig.path}` };
      }
      case 'list': {
        const files = await fs.readdir(fileConfig.path, { withFileTypes: true, recursive: fileConfig.recursive });
        let output = '';
        for (const file of files) {
          const filePath = path.join(fileConfig.path, file.name);
          const stats = await fs.stat(filePath);
          output += `${file.isDirectory() ? 'DIR' : 'FILE'} ${stats.size}\t${filePath}\n`;
        }
        return { output };
      }
      default:
        throw new Error(`File operation '${fileConfig.operation}' not yet supported`);
    }
  }

  private async executeCustom(task: Task): Promise<{ output: string }> {
    const customConfig = task.config.custom;
    if (!customConfig) {
      throw new Error('Custom configuration is missing');
    }

    try {
      const fn = eval(customConfig.function);
      if (typeof fn !== 'function') {
        throw new Error('Custom task must define a function');
      }
      const result = await fn(customConfig.parameters);
      return { output: JSON.stringify(result, null, 2) };
    } catch (error: any) {
      throw new Error(`Custom function execution failed: ${error.message}`);
    }
  }

  private async validate(task: Task, execution: TaskExecution): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      autoChecked: true,
      criteriaResults: [],
      errorMatches: [],
    };

    if (!task.validation.enabled) {
      return result;
    }

    const output = execution.output.toLowerCase();

    if (task.validation.errorPatterns) {
      for (const pattern of task.validation.errorPatterns) {
        if (output.includes(pattern.toLowerCase())) {
          result.errorMatches!.push(pattern);
          result.passed = false;
        }
      }
    }

    if (task.validation.successCriteria) {
      for (const criterion of task.validation.successCriteria) {
        const passed = output.includes(criterion.toLowerCase());
        result.criteriaResults.push({
          criterion,
          passed,
          details: passed ? 'Found in output' : 'Not found in output',
        });
        if (!passed) {
          result.passed = false;
        }
      }
    }

    return result;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getExecution(executionId: string): TaskExecution | undefined {
    return this.executions.get(executionId);
  }

  getAllExecutions(): TaskExecution[] {
    return Array.from(this.executions.values());
  }
}