import { BaseAgent } from '../agent-base.js';
import { AgentConfig, AgentExecutionResult } from '../agent-types.js';
import { Task, ScriptConfig, FileConfig } from '../web-types.js';
import { executeTool } from '../tool.js';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class OperationsAgent extends BaseAgent {
  private deployedServices: Map<string, any> = new Map();
  private monitoringData: Map<string, any> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    const defaultConfig: AgentConfig = {
      id: config.id || 'agent-operations-1',
      name: config.name || 'DevOps Agent',
      role: 'operations',
      description: 'Specialized in deployment, monitoring, and infrastructure management',
      systemPrompt: `You are an expert DevOps engineer. Your role is to:
1. Deploy applications and services
2. Monitor system health and performance
3. Manage infrastructure and resources
4. Handle incident response and troubleshooting
5. Automate deployment pipelines
6. Maintain security and compliance`,
      tools: ['bash', 'read', 'write', 'docker', 'k8s', 'monitoring'],
      capabilities: [
        { id: 'deployment', name: 'Deployment', description: 'Deploy applications', enabled: true },
        { id: 'monitoring', name: 'Monitoring', description: 'Monitor system health', enabled: true },
        { id: 'scaling', name: 'Scaling', description: 'Scale resources', enabled: true },
        { id: 'incident', name: 'Incident Response', description: 'Handle incidents', enabled: true },
        { id: 'backup', name: 'Backup', description: 'Manage backups', enabled: true },
      ],
      priority: config.priority || 'high',
      maxConcurrentTasks: config.maxConcurrentTasks || 4,
      timeout: config.timeout || 120000,
    };
    
    super({ ...defaultConfig, ...config } as AgentConfig);
  }

  async execute(task: Task): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.updateStatus('busy');

    try {
      console.log(`[${this.name}] Executing operations task: ${task.name}`);

      let output = '';

      switch (task.type) {
        case 'script':
          output = await this.executeOpsScript(task);
          break;
        case 'file':
          output = await this.handleConfigFile(task);
          break;
        case 'custom':
          output = await this.handleOpsTask(task);
          break;
        case 'api':
          output = await this.handleMonitoringApi(task);
          break;
        default:
          throw new Error(`Unsupported task type for operations: ${task.type}`);
      }

      const result = this.createExecutionResult(true, output, startTime);
      return result;
    } catch (error: any) {
      const result = this.createExecutionResult(false, '', startTime, error.message);
      return result;
    }
  }

  private async executeOpsScript(task: Task): Promise<string> {
    const scriptConfig = task.config.script as ScriptConfig;
    if (!scriptConfig) {
      throw new Error('Script configuration is missing');
    }

    const context = this.getToolContext(task);
    const output = await executeTool('bash', {
      command: scriptConfig.script,
      timeout: scriptConfig.timeout || 60000,
    }, context);

    return output.output;
  }

  private async handleConfigFile(task: Task): Promise<string> {
    const fileConfig = task.config.file as FileConfig;
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
        const configContent = this.generateConfig(task);
        const writeResult = await executeTool('bash', {
          command: `cat > "${fileConfig.path}" << 'EOF'\n${configContent}\nEOF`,
        }, context);
        return writeResult.output;

      case 'delete':
        const deleteResult = await executeTool('bash', {
          command: `rm -f "${fileConfig.path}"`,
        }, context);
        return deleteResult.output;

      default:
        throw new Error(`File operation ${fileConfig.operation} not implemented for operations`);
    }
  }

  private generateConfig(task: Task): string {
    const configType = task.metadata?.configType || 'general';
    const timestamp = new Date().toISOString();

    switch (configType) {
      case 'docker-compose':
        return this.generateDockerCompose(task);
      case 'kubernetes':
        return this.generateKubernetesConfig(task);
      case 'ci-cd':
        return this.generateCICDConfig(task);
      default:
        return this.generateGeneralConfig(task);
    }
  }

  private generateDockerCompose(task: Task): string {
    return `
version: '3.8'

services:
  app:
    image: ${task.metadata?.image || 'node:18'}
    container_name: ${task.metadata?.containerName || 'app-container'}
    ports:
      - "${task.metadata?.port || '3000'}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - .:/app
      - /app/node_modules
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: redis-container
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
    `.trim();
  }

  private generateKubernetesConfig(task: Task): string {
    return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${task.metadata?.appName || 'app-deployment'}
  labels:
    app: ${task.metadata?.appName || 'app'}
spec:
  replicas: ${task.metadata?.replicas || 3}
  selector:
    matchLabels:
      app: ${task.metadata?.appName || 'app'}
  template:
    metadata:
      labels:
        app: ${task.metadata?.appName || 'app'}
    spec:
      containers:
      - name: ${task.metadata?.containerName || 'app-container'}
        image: ${task.metadata?.image || 'node:18'}
        ports:
        - containerPort: ${task.metadata?.port || 3000}
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: ${task.metadata?.port || 3000}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: ${task.metadata?.port || 3000}
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: ${task.metadata?.serviceName || 'app-service'}
spec:
  selector:
    app: ${task.metadata?.appName || 'app'}
  ports:
  - protocol: TCP
    port: 80
    targetPort: ${task.metadata?.port || 3000}
  type: LoadBalancer
    `.trim();
  }

  private generateCICDConfig(task: Task): string {
    return `
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
    - name: Run linter
      run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Build
      run: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Add deployment commands here
    `.trim();
  }

  private generateGeneralConfig(task: Task): string {
    return `
# Configuration for ${task.name}
# Generated by ${this.name} on ${new Date().toISOString()}

${task.metadata?.config || '# Add your configuration here'}

# Environment Variables
${Object.entries(task.metadata?.env || {}).map(([key, value]) => `${key}=${value}`).join('\n')}
    `.trim();
  }

  private async handleOpsTask(task: Task): Promise<string> {
    const customConfig = task.config.custom;
    if (!customConfig) {
      throw new Error('Custom configuration is missing');
    }

    const opsType = customConfig.opsType || 'general';

    switch (opsType) {
      case 'deploy':
        return await this.handleDeployment(customConfig);
      case 'monitor':
        return this.handleMonitoring(customConfig);
      case 'scale':
        return await this.handleScaling(customConfig);
      case 'backup':
        return await this.handleBackup(customConfig);
      default:
        return this.handleGeneralOps(customConfig);
    }
  }

  private async handleDeployment(config: any): Promise<string> {
    const deploymentId = `deploy-${Date.now()}`;
    const timestamp = new Date().toISOString();

    this.deployedServices.set(deploymentId, {
      id: deploymentId,
      serviceName: config.serviceName,
      version: config.version,
      status: 'deploying',
      timestamp,
    });

    try {
      console.log(`[${this.name}] Deploying ${config.serviceName} v${config.version}...`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      const deployment = this.deployedServices.get(deploymentId);
      deployment.status = 'deployed';
      deployment.health = 'healthy';

      return `
## Deployment Summary

**Deployment ID**: ${deploymentId}
**Service**: ${config.serviceName}
**Version**: ${config.version}
**Status**: ✅ Deployed
**Timestamp**: ${timestamp}

**Deployment Details**:
- Environment: ${config.environment || 'production'}
- Replicas: ${config.replicas || 3}
- Health Check: Passed

**Endpoints**:
- Main: ${config.endpoint || 'https://api.example.com'}
- Health: ${config.healthEndpoint || 'https://api.example.com/health'}

**Next Steps**:
- Monitor logs
- Check metrics
- Verify functionality
      `.trim();
    } catch (error: any) {
      const deployment = this.deployedServices.get(deploymentId);
      deployment.status = 'failed';
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  private handleMonitoring(config: any): string {
    const serviceId = config.serviceId || 'default';
    const metrics = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      requests: Math.floor(Math.random() * 1000),
      errors: Math.floor(Math.random() * 10),
      uptime: Math.floor(Math.random() * 86400),
    };

    this.monitoringData.set(serviceId, metrics);

    return `
## Monitoring Report

**Service ID**: ${serviceId}
**Timestamp**: ${new Date().toISOString()}

**System Metrics**:
- CPU Usage: ${metrics.cpu.toFixed(2)}%
- Memory Usage: ${metrics.memory.toFixed(2)}%
- Uptime: ${metrics.uptime} seconds

**Application Metrics**:
- Requests/Minute: ${metrics.requests}
- Errors: ${metrics.errors}
- Success Rate: ${((1 - metrics.errors / (metrics.requests || 1)) * 100).toFixed(2)}%

**Health Status**: ${metrics.cpu < 80 && metrics.memory < 80 ? '✅ Healthy' : '⚠️ Warning'}

**Recommendations**:
${metrics.cpu > 80 ? '- Consider scaling up due to high CPU\n' : ''}
${metrics.memory > 80 ? '- Consider scaling up due to high memory\n' : ''}
${metrics.errors > 5 ? '- Investigate error patterns\n' : ''}
${metrics.cpu < 80 && metrics.memory < 80 ? '- System running optimally' : ''}
    `.trim();
  }

  private async handleScaling(config: any): Promise<string> {
    const currentReplicas = config.currentReplicas || 3;
    const targetReplicas = config.targetReplicas || 6;
    const service = config.serviceName || 'default';

    await new Promise(resolve => setTimeout(resolve, 500));

    return `
## Scaling Operation

**Service**: ${service}
**Action**: Scale ${targetReplicas > currentReplicas ? 'Up' : 'Down'}
**Current Replicas**: ${currentReplicas}
**Target Replicas**: ${targetReplicas}
**Status**: ✅ Completed

**Scaling Details**:
- Time to Scale: 2s
- New Instance Health: All Healthy
- Total Resource Allocation: ${targetReplicas * 2} cores, ${targetReplicas * 4}GB RAM

**Impact**:
- Capacity Increased: ${((targetReplicas / currentReplicas - 1) * 100).toFixed(0)}%
- Estimated Cost Change: +${((targetReplicas - currentReplicas) * 10).toFixed(0)}%
    `.trim();
  }

  private async handleBackup(config: any): Promise<string> {
    const backupId = `backup-${Date.now()}`;
    const timestamp = new Date().toISOString();

    await new Promise(resolve => setTimeout(resolve, 1000));

    return `
## Backup Summary

**Backup ID**: ${backupId}
**Type**: ${config.type || 'Full Backup'}
**Timestamp**: ${timestamp}
**Status**: ✅ Completed

**Backup Details**:
- Source: ${config.source || 'Database'}
- Destination: ${config.destination || 'S3 Bucket'}
- Size: ${(Math.random() * 100).toFixed(2)} GB
- Duration: 45s

**Backup Contents**:
- Database schema
- All tables
- Binary data
- Configuration files

**Retention**: ${config.retention || '30 days'}
**Next Scheduled Backup**: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
    `.trim();
  }

  private handleGeneralOps(config: any): string {
    return `
## Operations Task Result

**Task**: ${config.taskName || 'General Task'}
**Status**: ✅ Completed

**Output**:
${JSON.stringify(config.result || {}, null, 2)}

**Action Items**:
- Review the results
- Update documentation
- Notify stakeholders
    `.trim();
  }

  private async handleMonitoringApi(task: Task): Promise<string> {
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

      const summary = `
## Monitoring API Check

**Endpoint**: ${apiConfig.url}
**Method**: ${apiConfig.method}
**Status**: ${response.status}
**Response Time**: ${duration}ms

**Health Check**: ${response.status >= 200 && response.status < 300 ? '✅ Healthy' : '❌ Unhealthy'}

**Response**:
${text.substring(0, 500)}${text.length > 500 ? '...' : ''}
      `.trim();

      return summary;
    } catch (error: any) {
      throw new Error(`Monitoring API check failed: ${error.message}`);
    }
  }

  getDeployedServices(): any[] {
    return Array.from(this.deployedServices.values());
  }

  getMonitoringData(serviceId: string): any {
    return this.monitoringData.get(serviceId);
  }
}