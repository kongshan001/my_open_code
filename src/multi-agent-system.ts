import { AgentRegistry, agentRegistry, AgentOrchestrator } from './agents/index.js';
import { DeveloperAgent } from './agents/developer-agent.js';
import { TesterAgent } from './agents/tester-agent.js';
import { ProductAgent } from './agents/product-agent.js';
import { OperationsAgent } from './agents/operations-agent.js';

export class MultiAgentSystem {
  registry: AgentRegistry;
  orchestrator: AgentOrchestrator;

  constructor(registry: AgentRegistry = agentRegistry) {
    this.registry = registry;
    this.orchestrator = new AgentOrchestrator(registry);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing MultiAgent System...');

    await this.registerDefaultAgents();
    await this.registry.initializeAll();

    console.log('✅ MultiAgent System initialized successfully');
    this.printSystemStatus();
  }

  private async registerDefaultAgents(): Promise<void> {
    console.log('📝 Registering default agents...');

    const agents = [
      new DeveloperAgent({
        id: 'agent-developer-1',
        name: 'Code Master',
        priority: 'high',
      }),
      new DeveloperAgent({
        id: 'agent-developer-2',
        name: 'Bug Fixer',
        priority: 'medium',
      }),
      new TesterAgent({
        id: 'agent-tester-1',
        name: 'QA Engineer',
        priority: 'high',
      }),
      new TesterAgent({
        id: 'agent-tester-2',
        name: 'Test Automation',
        priority: 'medium',
      }),
      new ProductAgent({
        id: 'agent-product-1',
        name: 'Product Owner',
        priority: 'medium',
      }),
      new OperationsAgent({
        id: 'agent-ops-1',
        name: 'DevOps Engineer',
        priority: 'high',
      }),
    ];

    agents.forEach(agent => {
      this.registry.register(agent);
    });
  }

  registerAgent(agent: any): void {
    this.registry.register(agent);
  }

  async executeTask(task: any, options?: {
    preferredAgentId?: string;
    preferredRole?: string;
  }): Promise<any> {
    return await this.orchestrator.executeTask(
      task,
      options?.preferredAgentId,
      options?.preferredRole as any
    );
  }

  async executeParallelTasks(tasks: any[]): Promise<any[]> {
    return await this.orchestrator.executeParallelTasks(tasks);
  }

  async executeSequentialTasks(tasks: any[]): Promise<any[]> {
    return await this.orchestrator.executeSequentialTasks(tasks);
  }

  getSystemStatus(): any {
    return {
      registry: this.registry.getStatus(),
      performance: this.orchestrator.getPerformanceMetrics(),
      agents: this.registry.getAllAgents().map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        capabilities: agent.getCapabilities().map((c: any) => c.name),
      })),
    };
  }

  printSystemStatus(): void {
    const status = this.getSystemStatus();

    console.log('\n' + '='.repeat(60));
    console.log('📊 MultiAgent System Status');
    console.log('='.repeat(60));

    console.log('\n📈 Registry Status:');
    console.log(`  Total Agents: ${status.registry.total}`);
    console.log(`  Available: ${status.registry.available}`);
    console.log(`  Busy: ${status.registry.busy}`);
    console.log(`  Error: ${status.registry.error}`);

    console.log('\n👥 Agents by Role:');
    Object.entries(status.registry.byRole).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });

    console.log('\n⚡ Performance Metrics:');
    console.log(`  Total Tasks: ${status.performance.totalTasks}`);
    console.log(`  Success Rate: ${status.performance.successRate.toFixed(2)}%`);
    console.log(`  Avg Execution Time: ${status.performance.averageExecutionTime.toFixed(2)}ms`);

    console.log('\n🤖 Agent Details:');
    status.agents.forEach((agent: any) => {
      console.log(`  ${agent.name} (${agent.role}): ${agent.status}`);
      console.log(`    Capabilities: ${agent.capabilities.join(', ')}`);
    });

    console.log('\n' + '='.repeat(60) + '\n');
  }

  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  getRegistry(): AgentRegistry {
    return this.registry;
  }
}

export const multiAgentSystem = new MultiAgentSystem();