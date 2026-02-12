import { Agent, AgentConfig, AgentRole } from './agent-types.js';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private roleIndex: Map<AgentRole, Agent[]> = new Map();

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} already registered`);
    }

    this.agents.set(agent.id, agent);

    if (!this.roleIndex.has(agent.role as AgentRole)) {
      this.roleIndex.set(agent.role as AgentRole, []);
    }
    this.roleIndex.get(agent.role as AgentRole)!.push(agent);

    console.log(`✓ Registered agent: ${agent.name} (${agent.role})`);
  }

  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    this.agents.delete(agentId);

    const roleAgents = this.roleIndex.get(agent.role as AgentRole);
    if (roleAgents) {
      const index = roleAgents.findIndex(a => a.id === agentId);
      if (index !== -1) {
        roleAgents.splice(index, 1);
      }
    }

    console.log(`✓ Unregistered agent: ${agent.name}`);
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAgentByName(name: string): Agent | undefined {
    return Array.from(this.agents.values()).find(a => a.name === name);
  }

  getAgentsByRole(role: AgentRole): Agent[] {
    return this.roleIndex.get(role) || [];
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.isAvailable());
  }

  getAvailableAgentsByRole(role: AgentRole): Agent[] {
    return this.getAgentsByRole(role).filter(a => a.isAvailable());
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  getAgentCountByRole(role: AgentRole): number {
    return this.getAgentsByRole(role).length;
  }

  getAvailableAgentCount(): number {
    return this.getAvailableAgents().length;
  }

  initializeAll(): Promise<void[]> {
    return Promise.all(
      Array.from(this.agents.values()).map(agent => agent.initialize())
    );
  }

  clear(): void {
    this.agents.clear();
    this.roleIndex.clear();
  }

  getStatus(): {
    total: number;
    byRole: Record<AgentRole, number>;
    available: number;
    busy: number;
    error: number;
    offline: number;
  } {
    const agents = this.getAllAgents();
    const status = {
      total: agents.length,
      byRole: {} as Record<AgentRole, number>,
      available: 0,
      busy: 0,
      error: 0,
      offline: 0,
    };

    agents.forEach(agent => {
      const role = agent.role as AgentRole;
      status.byRole[role] = (status.byRole[role] || 0) + 1;

      switch (agent.status) {
        case 'idle':
          status.available++;
          break;
        case 'busy':
          status.busy++;
          break;
        case 'error':
          status.error++;
          break;
        case 'offline':
          status.offline++;
          break;
      }
    });

    return status;
  }
}

export const agentRegistry = new AgentRegistry();