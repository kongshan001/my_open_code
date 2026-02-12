import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OperationsAgent } from '../../src/agents/operations-agent.js';
import { Task } from '../../src/web-types.js';
import { promises as fs } from 'fs';

describe('OperationsAgent', () => {
  let agent: OperationsAgent;

  beforeEach(() => {
    agent = new OperationsAgent();
  });

  afterEach(async () => {
    const tempFiles = await fs.readdir('/tmp').catch(() => []);
    for (const file of tempFiles) {
      if (file.startsWith('test-config-') || file.startsWith('test-ops-')) {
        await fs.unlink(`/tmp/${file}`).catch(() => {});
      }
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(agent.id).toBe('agent-operations-1');
      expect(agent.name).toBe('DevOps Agent');
      expect(agent.role).toBe('operations');
      expect(agent.status).toBe('idle');
    });

    it('should have correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      const capabilityNames = capabilities.map(c => c.name);

      expect(capabilityNames).toContain('Deployment');
      expect(capabilityNames).toContain('Monitoring');
      expect(capabilityNames).toContain('Scaling');
      expect(capabilityNames).toContain('Incident Response');
      expect(capabilityNames).toContain('Backup');
    });

    it('should allow custom config', () => {
      const customAgent = new OperationsAgent({
        id: 'custom-ops',
        name: 'Custom Ops',
        priority: 'critical',
      });

      expect(customAgent.id).toBe('custom-ops');
      expect(customAgent.name).toBe('Custom Ops');
      expect(customAgent.config.priority).toBe('critical');
    });
  });

  describe('execute - script tasks', () => {
    const createScriptTask = (script: string): Task => ({
      id: 'task-1',
      name: 'Ops Task',
      description: 'Operations task',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script,
          workingDir: process.cwd(),
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should execute bash script successfully', async () => {
      const task = createScriptTask('echo "Operations executed"');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Operations executed');
    });

    it('should handle script execution error', async () => {
      const task = createScriptTask('exit 1');
      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('execute - file operations', () => {
    const createFileTask = (operation: string, path: string, content?: string, metadata?: any): Task => ({
      id: 'task-1',
      name: 'Config Task',
      description: 'Configuration task',
      type: 'file',
      config: {
        file: {
          operation: operation as any,
          path,
          content,
        },
      },
      validation: { enabled: false },
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should read file successfully', async () => {
      const task = createFileTask('read', 'package.json');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('"name"');
    });

    it('should write configuration file successfully', async () => {
      const testFile = `/tmp/test-config-${Date.now()}.yml`;
      const task = createFileTask('write', testFile);
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Configuration for Config Task');

      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should delete file successfully', async () => {
      const testFile = `/tmp/test-ops-${Date.now()}.txt`;
      await fs.writeFile(testFile, 'test content');

      const task = createFileTask('delete', testFile);
      const result = await agent.execute(task);

      expect(result.success).toBe(true);

      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should throw on unsupported file operation', async () => {
      const task = createFileTask('list', '/tmp');

      await expect(agent.execute(task)).rejects.toThrow('not implemented for operations');
    });

    it('should throw when file config is missing', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'file',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('File configuration is missing');
    });
  });

  describe('execute - custom ops tasks', () => {
    const createCustomTask = (opsType: string, config: any = {}): Task => ({
      id: 'task-1',
      name: 'Ops Task',
      description: 'Operations task',
      type: 'custom',
      config: {
        custom: {
          opsType,
          ...config,
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should handle deployment operation', async () => {
      const task = createCustomTask('deploy', {
        serviceName: 'my-service',
        version: 'v1.2.3',
        environment: 'production',
        replicas: 5,
        endpoint: 'https://api.example.com',
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Deployment Summary');
      expect(result.output).toContain('my-service');
      expect(result.output).toContain('v1.2.3');
      expect(result.output).toContain('production');
      expect(result.output).toContain('Status: ✅ Deployed');
    });

    it('should record deployed services', async () => {
      const task = createCustomTask('deploy', {
        serviceName: 'test-service',
        version: 'v1.0.0',
      });

      await agent.execute(task);

      const services = agent.getDeployedServices();
      expect(services.length).toBeGreaterThan(0);
      const lastService = services[services.length - 1];
      expect(lastService.serviceName).toBe('test-service');
      expect(lastService.version).toBe('v1.0.0');
      expect(lastService.status).toBe('deployed');
    });

    it('should handle monitoring operation', async () => {
      const task = createCustomTask('monitor', {
        serviceId: 'service-123',
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Monitoring Report');
      expect(result.output).toContain('System Metrics');
      expect(result.output).toContain('Application Metrics');
      expect(result.output).toContain('Health Status');
    });

    it('should record monitoring data', async () => {
      const task = createCustomTask('monitor', {
        serviceId: 'service-123',
      });

      await agent.execute(task);

      const data = agent.getMonitoringData('service-123');
      expect(data).toBeDefined();
      expect(data.cpu).toBeGreaterThanOrEqual(0);
      expect(data.memory).toBeGreaterThanOrEqual(0);
    });

    it('should handle scaling operation', async () => {
      const task = createCustomTask('scale', {
        serviceName: 'my-service',
        currentReplicas: 3,
        targetReplicas: 6,
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Scaling Operation');
      expect(result.output).toContain('Scale Up');
      expect(result.output).toContain('Current Replicas: 3');
      expect(result.output).toContain('Target Replicas: 6');
    });

    it('should handle scaling down', async () => {
      const task = createCustomTask('scale', {
        serviceName: 'my-service',
        currentReplicas: 6,
        targetReplicas: 3,
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Scale Down');
    });

    it('should handle backup operation', async () => {
      const task = createCustomTask('backup', {
        type: 'Full Backup',
        source: 'Database',
        destination: 'S3 Bucket',
        retention: '30 days',
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Backup Summary');
      expect(result.output).toContain('Full Backup');
      expect(result.output).toContain('Database');
      expect(result.output).toContain('S3 Bucket');
      expect(result.output).toContain('Retention: 30 days');
    });

    it('should handle general ops task', async () => {
      const task = createCustomTask('general', {
        taskName: 'General Ops',
        result: {
          operation: 'System check',
          status: 'All systems normal',
        },
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Operations Task Result');
      expect(result.output).toContain('General Ops');
    });

    it('should throw when custom config is missing', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'custom',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('Custom configuration is missing');
    });
  });

  describe('execute - API (monitoring)', () => {
    const createApiTask = (url: string, method: string = 'GET'): Task => ({
      id: 'task-1',
      name: 'Monitoring API',
      description: 'Monitoring API check',
      type: 'api',
      config: {
        api: {
          url,
          method: method as any,
          headers: { 'Content-Type': 'application/json' },
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should execute monitoring API check', async () => {
      const task = createApiTask('https://httpbin.org/status/200');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Monitoring API Check');
      expect(result.output).toContain('Health Check: ✅ Healthy');
    });

    it('should handle unhealthy endpoint', async () => {
      const task = createApiTask('https://httpbin.org/status/500');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Health Check: ❌ Unhealthy');
    });

    it('should include response time', async () => {
      const task = createApiTask('https://httpbin.org/delay/1');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Response Time:');
    });

    it('should throw when api config is missing', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'api',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('API configuration is missing');
    });
  });

  describe('status management', () => {
    it('should set status to busy during execution', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'custom',
        config: {
          custom: {
            opsType: 'monitor',
            serviceId: 'service-123',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const promise = agent.execute(task);
      expect(agent.status).toBe('busy');

      await promise;
      expect(agent.status).toBe('idle');
    });
  });

  describe('utility methods', () => {
    it('should get deployed services', async () => {
      const task = createCustomTask('deploy', {
        serviceName: 'test-service',
        version: 'v1.0.0',
      });

      await agent.execute(task);

      const services = agent.getDeployedServices();
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
    });

    it('should get monitoring data', async () => {
      const task = createCustomTask('monitor', {
        serviceId: 'service-456',
      });

      await agent.execute(task);

      const data = agent.getMonitoringData('service-456');
      expect(data).toBeDefined();
      expect(typeof data.cpu).toBe('number');
      expect(typeof data.memory).toBe('number');
    });

    it('should return undefined for non-existent monitoring data', () => {
      const data = agent.getMonitoringData('non-existent');
      expect(data).toBeUndefined();
    });
  });

  describe('execution result', () => {
    it('should return properly formatted result on success', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'custom',
        config: {
          custom: {
            opsType: 'monitor',
            serviceId: 'service-123',
          },
        },
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      const result = await agent.execute(task);

      expect(result).toMatchObject({
        success: true,
        output: expect.any(String),
        agentId: 'agent-operations-1',
        duration: expect.any(Number),
        timestamp: expect.any(Number),
      });
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});