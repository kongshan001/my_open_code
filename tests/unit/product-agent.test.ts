import { describe, it, expect, beforeEach } from 'vitest';
import { ProductAgent } from '../../src/agents/product-agent.js';
import { Task } from '../../src/web-types.js';

describe('ProductAgent', () => {
  let agent: ProductAgent;

  beforeEach(() => {
    agent = new ProductAgent();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(agent.id).toBe('agent-product-1');
      expect(agent.name).toBe('Product Manager Agent');
      expect(agent.role).toBe('product');
      expect(agent.status).toBe('idle');
    });

    it('should have correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      const capabilityNames = capabilities.map(c => c.name);

      expect(capabilityNames).toContain('Requirements Analysis');
      expect(capabilityNames).toContain('Documentation');
      expect(capabilityNames).toContain('Roadmap Planning');
      expect(capabilityNames).toContain('User Stories');
      expect(capabilityNames).toContain('Acceptance Criteria');
    });

    it('should allow custom config', () => {
      const customAgent = new ProductAgent({
        id: 'custom-product',
        name: 'Custom Product',
        priority: 'high',
      });

      expect(customAgent.id).toBe('custom-product');
      expect(customAgent.name).toBe('Custom Product');
      expect(customAgent.config.priority).toBe('high');
    });
  });

  describe('execute - file operations', () => {
    const createFileTask = (operation: string, path: string, content?: string, metadata?: any): Task => ({
      id: 'task-1',
      name: 'Documentation Task',
      description: 'Create documentation',
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

    it('should generate documentation on write', async () => {
      const testFile = `/tmp/test-doc-${Date.now()}.md`;
      const task = createFileTask('write', testFile, undefined, {
        requirements: 'User authentication and authorization',
        userStory: 'As a user, I want to login securely',
        tasks: ['Design auth system', 'Implement login', 'Add tests'],
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test Documentation Task');
    });

    it('should generate proper markdown structure', async () => {
      const task = createFileTask('write', '/tmp/test.md');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
    });

    it('should throw on unsupported file operation', async () => {
      const task = createFileTask('delete', 'some-path');

      await expect(agent.execute(task)).rejects.toThrow('not implemented for product agent');
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

  describe('execute - custom tasks', () => {
    const createCustomTask = (taskType: string, config: any = {}): Task => ({
      id: 'task-1',
      name: 'Custom Task',
      description: 'Custom task',
      type: 'custom',
      config: {
        custom: {
          taskType,
          ...config,
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
    });

    it('should create user story', async () => {
      const task = createCustomTask('user-story', {
        title: 'User Login',
        role: 'user',
        want: 'to login to my account',
        benefit: 'I can access my data',
        priority: 'High',
        complexity: 'Medium',
        criteria: [
          'User can enter username and password',
          'System validates credentials',
          'User is redirected to dashboard on success',
        ],
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('User Story');
      expect(result.output).toContain('User Login');
      expect(result.output).toContain('As a user');
      expect(result.output).toContain('I want to login to my account');
      expect(result.output).toContain('So that I can access my data');
      expect(result.output).toContain('Priority: High');
      expect(result.output).toContain('Complexity: Medium');
    });

    it('should create acceptance criteria', async () => {
      const task = createCustomTask('acceptance-criteria', {
        feature: 'Login System',
        given: 'user is on login page',
        when: 'user enters valid credentials',
        then: 'user is redirected to dashboard',
        scenarios: [
          'Valid credentials should redirect',
          'Invalid credentials should show error',
          'Empty fields should show validation error',
        ],
        expectedResults: ['Pass', 'Pass', 'Pass'],
        edgeCases: [
          'Test with SQL injection',
          'Test with XSS attempts',
        ],
        maxResponseTime: '2s',
        minThroughput: '100 req/s',
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Acceptance Criteria');
      expect(result.output).toContain('Login System');
      expect(result.output).toContain('Given user is on login page');
      expect(result.output).toContain('When user enters valid credentials');
      expect(result.output).toContain('Then user is redirected to dashboard');
      expect(result.output).toContain('Test Scenarios');
      expect(result.output).toContain('Edge Cases');
      expect(result.output).toContain('Performance Requirements');
    });

    it('should create roadmap', async () => {
      const task = createCustomTask('roadmap', {
        version: '2.0.0',
        timeline: 'Q2 2024',
        phase1: {
          duration: '4 weeks',
          items: ['Research', 'Design', 'Prototype'],
        },
        phase2: {
          duration: '6 weeks',
          items: ['Development', 'Testing', 'Integration'],
        },
        phase3: {
          duration: '3 weeks',
          items: ['UAT', 'Launch', 'Monitor'],
        },
        milestones: [
          { name: 'Alpha', date: '2024-04-15', description: 'Internal release' },
          { name: 'Beta', date: '2024-05-15', description: 'Public beta' },
        ],
        risks: [
          'Team resource constraints',
          'Third-party API changes',
        ],
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Product Roadmap');
      expect(result.output).toContain('Version: 2.0.0');
      expect(result.output).toContain('Timeline: Q2 2024');
      expect(result.output).toContain('Phase 1: Foundation');
      expect(result.output).toContain('Phase 2: Development');
      expect(result.output).toContain('Phase 3: Testing & Launch');
      expect(result.output).toContain('Milestones');
      expect(result.output).toContain('Risks & Dependencies');
    });

    it('should handle general product task', async () => {
      const task = createCustomTask('general', {
        result: {
          insights: ['Feature A is popular', 'Feature B needs improvement'],
          recommendations: ['Enhance Feature B', 'Add more analytics'],
        },
      });

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Product Task Result');
      expect(result.output).toContain('insights');
      expect(result.output).toContain('recommendations');
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

  describe('execute - API (market research)', () => {
    const createApiTask = (url: string, method: string = 'GET'): Task => ({
      id: 'task-1',
      name: 'Market Research',
      description: 'Research market',
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

    it('should execute market research API call', async () => {
      const task = createApiTask('https://httpbin.org/get');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Market Research Summary');
      expect(result.output).toContain('Data Retrieved');
    });

    it('should handle API response', async () => {
      const task = createApiTask('https://httpbin.org/json');
      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Raw Data');
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

  describe('execute - unsupported task types', () => {
    it('should throw on unsupported task type', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'script',
        config: {},
        validation: { enabled: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'test',
      };

      await expect(agent.execute(task)).rejects.toThrow('Unsupported task type for product');
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
            taskType: 'user-story',
            title: 'Test',
            role: 'user',
            want: 'test',
            benefit: 'test',
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

  describe('execution result', () => {
    it('should return properly formatted result on success', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        type: 'custom',
        config: {
          custom: {
            taskType: 'user-story',
            title: 'Test',
            role: 'user',
            want: 'test',
            benefit: 'test',
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
        agentId: 'agent-product-1',
        duration: expect.any(Number),
        timestamp: expect.any(Number),
      });
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});