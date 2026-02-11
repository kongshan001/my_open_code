export type TaskType = 'script' | 'api' | 'file' | 'custom';
export type TaskStatus = 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  config: TaskConfig;
  schedule?: CronSchedule;
  validation: ValidationRules;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface TaskConfig {
  script?: ScriptConfig;
  api?: ApiConfig;
  file?: FileConfig;
  custom?: CustomConfig;
}

export interface ScriptConfig {
  language: 'bash' | 'python' | 'node' | 'powershell';
  script: string;
  timeout?: number;
  env?: Record<string, string>;
  workingDir?: string;
}

export interface ApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  expectedStatus?: number[];
}

export interface FileConfig {
  operation: 'read' | 'write' | 'delete' | 'copy' | 'move' | 'list';
  path: string;
  content?: string;
  targetPath?: string;
  pattern?: string;
  recursive?: boolean;
}

export interface CustomConfig {
  function: string;
  parameters: Record<string, any>;
  dependencies?: string[];
}

export interface CronSchedule {
  enabled: boolean;
  expression: string;
  timezone?: string;
  nextRun?: number;
}

export interface ValidationRules {
  enabled: boolean;
  successCriteria?: string[];
  errorPatterns?: string[];
  timeoutMs?: number;
  outputFilters?: string[];
  exitCodes?: number[];
  requireManualReview?: boolean;
  customValidator?: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: TaskStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  output: string;
  error?: string;
  progress: number;
  retryCount: number;
  validation?: ValidationResult;
  artifacts?: Artifact[];
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  passed: boolean;
  autoChecked: boolean;
  manualReview?: {
    reviewer: string;
    approved: boolean;
    comment?: string;
    reviewTime: number;
  };
  criteriaResults: Array<{
    criterion: string;
    passed: boolean;
    details: string;
  }>;
  errorMatches?: string[];
}

export interface Artifact {
  name: string;
  type: 'file' | 'log' | 'data' | 'image';
  path: string;
  size: number;
  url?: string;
}

export interface TaskStatusUpdate {
  executionId: string;
  status: TaskStatus;
  progress: number;
  output?: string;
  error?: string;
  timestamp: number;
}

export interface TaskQueue {
  pending: string[];
  running: string[];
  completed: string[];
  failed: string[];
}

export interface WorkspaceState {
  branch: string;
  files: WorkspaceFile[];
  lastSync: number;
  pendingChanges: PendingChange[];
}

export interface WorkspaceFile {
  path: string;
  size: number;
  modified: boolean;
  hash: string;
}

export interface PendingChange {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  content?: string;
  timestamp: number;
}

export interface WebSession {
  id: string;
  apiKey: string;
  githubToken?: string;
  repository: string;
  owner: string;
  createdAt: number;
  lastActivity: number;
  activeTasks: string[];
}