import { FileManager } from './file-manager.js';
import { GitManager } from './git-manager.js';

class StorageManager {
    constructor() {
        this.API_KEY_KEY = 'ai_task_runner_api_key';
        this.GITHUB_TOKEN_KEY = 'ai_task_runner_github_token';
        this.REPOSITORY_KEY = 'ai_task_runner_repository';
        this.SESSION_ID_KEY = 'ai_task_runner_session_id';
    }

    getAPIKey() {
        return localStorage.getItem(this.API_KEY_KEY);
    }

    setAPIKey(key) {
        localStorage.setItem(this.API_KEY_KEY, key);
    }

    getGitHubToken() {
        return localStorage.getItem(this.GITHUB_TOKEN_KEY);
    }

    setGitHubToken(token) {
        localStorage.setItem(this.GITHUB_TOKEN_KEY, token);
    }

    getRepository() {
        return localStorage.getItem(this.REPOSITORY_KEY);
    }

    setRepository(repo) {
        localStorage.setItem(this.REPOSITORY_KEY, repo);
    }

    getSessionId() {
        let sessionId = localStorage.getItem(this.SESSION_ID_KEY);
        if (!sessionId) {
            sessionId = this.generateSessionId();
            localStorage.setItem(this.SESSION_ID_KEY, sessionId);
        }
        return sessionId;
    }

    clearAll() {
        localStorage.removeItem(this.API_KEY_KEY);
        localStorage.removeItem(this.GITHUB_TOKEN_KEY);
        localStorage.removeItem(this.REPOSITORY_KEY);
        localStorage.removeItem(this.SESSION_ID_KEY);
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

class GitHubAPIClient {
    constructor(token, repository) {
        this.token = token;
        this.repository = repository;
        this.baseUrl = 'https://api.github.com';
        this.workflows = {
            'task-execution': 'task-execution.yml',
            'status-monitor': 'status-monitor.yml',
            'file-operations': 'file-operations.yml',
            'git-integration': 'git-integration.yml'
        };
    }

    async dispatchWorkflow(workflowName, inputs) {
        const [owner, repo] = this.repository.split('/');
        const workflowFile = this.workflows[workflowName];

        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: inputs
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Workflow dispatch failed: ${response.statusText}`);
        }

        return response.json();
    }

    async getWorkflowRun(runId) {
        const [owner, repo] = this.repository.split('/');

        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}`,
            {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get workflow run: ${response.statusText}`);
        }

        return response.json();
    }

    async listWorkflowRuns() {
        const [owner, repo] = this.repository.split('/');

        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/actions/runs`,
            {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to list workflow runs: ${response.statusText}`);
        }

        return response.json();
    }

    async getFile(path, ref = 'main') {
        const [owner, repo] = this.repository.split('/');

        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
            {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Failed to get file: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.type === 'file' && data.encoding === 'base64') {
            const content = atob(data.content);
            return {
                name: data.name,
                path: data.path,
                size: data.size,
                content: content,
                sha: data.sha
            };
        }

        return data;
    }

    async updateFile(path, content, message = 'Update file', sha = null) {
        const [owner, repo] = this.repository.split('/');
        const encodedContent = btoa(content);

        const body = {
            message: message,
            content: encodedContent
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update file: ${response.statusText}`);
        }

        return response.json();
    }

    async createBranch(branchName, baseBranch = 'main') {
        const [owner, repo] = this.repository.split('/');

        const baseRef = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
            {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!baseRef.ok) {
            throw new Error(`Failed to get base branch: ${baseRef.statusText}`);
        }

        const baseData = await baseRef.json();
        const sha = baseData.object.sha;

        const response = await fetch(
            `${this.baseUrl}/repos/${owner}/${repo}/git/refs`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: `refs/heads/${branchName}`,
                    sha: sha
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create branch: ${response.statusText}`);
        }

        return response.json();
    }
}

class TaskRunner {
    constructor() {
        this.storage = new StorageManager();
        this.githubAPI = null;
        this.fileManager = null;
        this.gitManager = null;
        this.tasks = [];
        this.executions = [];
        this.activeTasks = new Map();
        this.init();
    }

    init() {
        this.checkConfiguration();
        this.setupEventListeners();
        this.loadInitialData();
        this.startStatusPolling();
    }

    checkConfiguration() {
        const apiKey = this.storage.getAPIKey();
        const githubToken = this.storage.getGitHubToken();
        const repository = this.storage.getRepository();

        if (!apiKey || !githubToken || !repository) {
            this.showSettingsModal();
        } else {
            this.githubAPI = new GitHubAPIClient(githubToken, repository);
            this.fileManager = new FileManager(this.githubAPI);
            this.gitManager = new GitManager(this.githubAPI);
        }
    }

    setupEventListeners() {
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });

        document.getElementById('create-task-btn').addEventListener('click', () => this.showCreateTaskModal());
        document.getElementById('refresh-files-btn').addEventListener('click', () => this.refreshFiles());
        document.getElementById('create-file-btn').addEventListener('click', () => this.showCreateFileDialog());
        document.getElementById('file-search').addEventListener('input', (e) => this.searchFiles(e.target.value));
        document.getElementById('clear-history-btn').addEventListener('click', () => this.clearHistory());
        document.getElementById('refresh-git-btn').addEventListener('click', () => this.loadGitHistory());
        document.getElementById('view-diff-btn').addEventListener('click', () => this.showDiffModal());
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettingsModal());

        document.getElementById('modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideModal();
            }
        });
    }

    async searchFiles(pattern) {
        if (!this.fileManager || !pattern.trim()) {
            this.refreshFiles(this.fileManager.currentPath);
            return;
        }

        try {
            const results = await this.fileManager.searchFiles(pattern);
            this.renderSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    renderSearchResults(results) {
        const container = document.getElementById('files-browser');

        if (!results || results.length === 0) {
            container.innerHTML = '<p class="empty-state">No results found</p>';
            return;
        }

        container.innerHTML = `
            <div style="padding: 1rem; color: var(--text-muted);">Found ${results.length} results</div>
            ${results.map(result => `
                <div class="file-item" data-path="${result.path}" data-type="file">
                    <span class="file-icon">${this.fileManager.getIconByName(result.name)}</span>
                    <span class="file-name">${result.name}</span>
                    <span class="file-size" style="font-size: 0.75rem; max-width: 400px; overflow: hidden; text-overflow: ellipsis;">${result.path}</span>
                    <div class="file-actions">
                        <button class="icon-btn" onclick="taskRunner.viewFile('${result.path}')" title="View">👁️</button>
                        <button class="icon-btn" onclick="taskRunner.editFile('${result.path}')" title="Edit">✏️</button>
                    </div>
                </div>
            `).join('')}
        `;
    }

    async loadInitialData() {
        if (!this.githubAPI) return;

        try {
            await this.loadTasks();
            await this.loadExecutions();
            await this.refreshFiles();
            await this.loadGitHistory();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    async loadTasks() {
        try {
            const tasksFile = await this.githubAPI.getFile('data/tasks');
            if (tasksFile && tasksFile.content) {
                this.tasks = JSON.parse(tasksFile.content);
                this.renderTasks();
            }
        } catch (error) {
            console.log('No existing tasks found');
        }
    }

    async loadExecutions() {
        try {
            const executionsFile = await this.githubAPI.getFile('data/executions');
            if (executionsFile && executionsFile.content) {
                const content = executionsFile.content;
                const lines = content.split('\n').filter(line => line.trim());
                this.executions = lines.map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                }).filter(Boolean);
                this.renderHistory();
            }
        } catch (error) {
            console.log('No existing executions found');
        }
    }

    async refreshFiles(path = '') {
        if (!this.fileManager) return;

        const container = document.getElementById('files-browser');
        container.innerHTML = '<p class="empty-state"><span class="loading"></span> Loading files...</p>';

        try {
            const files = await this.fileManager.listFiles(path);
            this.renderFiles(files);
        } catch (error) {
            container.innerHTML = `<p class="empty-state">Error loading files: ${error.message}</p>`;
        }
    }

    renderFiles(files) {
        const container = document.getElementById('files-browser');

        if (!files || files.length === 0) {
            container.innerHTML = '<p class="empty-state">No files found</p>';
            return;
        }

        container.innerHTML = files.map(file => {
            const icon = this.fileManager.getIconByType(file.type);
            const size = this.fileManager.formatSize(file.size);

            return `
            <div class="file-item" data-path="${file.path}" data-type="${file.type}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${file.type === 'file' ? size : ''}</span>
                <div class="file-actions">
                    ${file.type === 'file' ? `
                        <button class="icon-btn" onclick="taskRunner.viewFile('${file.path}')" title="View">
                            👁️
                        </button>
                        <button class="icon-btn" onclick="taskRunner.editFile('${file.path}')" title="Edit">
                            ✏️
                        </button>
                        <button class="icon-btn" onclick="taskRunner.downloadFile('${file.path}')" title="Download">
                            ⬇️
                        </button>
                        <button class="icon-btn" onclick="taskRunner.deleteFile('${file.path}')" title="Delete" style="color: var(--danger)">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `}).join('');

        document.querySelectorAll('.file-item').forEach(item => {
            if (item.dataset.type === 'dir') {
                item.addEventListener('dblclick', () => {
                    this.refreshFiles(item.dataset.path);
                });
            }
        });
    }

    async viewFile(path) {
        if (!this.fileManager) return;

        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = `View File: ${path}`;

        try {
            const file = await this.fileManager.readFile(path);
            const language = this.getLanguageByPath(path);

            content.innerHTML = `
                <pre style="background: var(--bg-darker); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; max-height: 60vh;"><code class="language-${language}">${this.escapeHtml(file.content)}</code></pre>
                <div class="form-actions" style="margin-top: 1rem;">
                    <button class="secondary-btn" onclick="taskRunner.hideModal()">Close</button>
                </div>
            `;

            this.showModal();
        } catch (error) {
            this.addMessage(`Failed to view file: ${error.message}`, 'assistant');
        }
    }

    async editFile(path) {
        if (!this.fileManager) return;

        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = `Edit File: ${path}`;

        try {
            const file = await this.fileManager.readFile(path);

            content.innerHTML = `
                <form id="edit-file-form">
                    <div class="form-group">
                        <label for="file-content">Content</label>
                        <textarea id="file-content" rows="20" style="font-family: monospace; font-size: 0.85rem;">${this.escapeHtml(file.content)}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="secondary-btn" onclick="taskRunner.hideModal()">Cancel</button>
                        <button type="submit" class="primary-btn">Save</button>
                    </div>
                </form>
            `;

            document.getElementById('edit-file-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveFile(path, document.getElementById('file-content').value);
            });

            this.showModal();
        } catch (error) {
            this.addMessage(`Failed to edit file: ${error.message}`, 'assistant');
        }
    }

    async saveFile(path, content) {
        try {
            await this.fileManager.writeFile(path, content, `Update file: ${path}`);
            this.hideModal();
            this.addMessage(`File saved: ${path}`, 'assistant');
            this.refreshFiles(this.fileManager.currentPath);
        } catch (error) {
            this.addMessage(`Failed to save file: ${error.message}`, 'assistant');
        }
    }

    async deleteFile(path) {
        if (!confirm(`Are you sure you want to delete ${path}?`)) return;

        try {
            await this.fileManager.deleteFile(path, `Delete file: ${path}`);
            this.addMessage(`File deleted: ${path}`, 'assistant');
            this.refreshFiles(this.fileManager.currentPath);
        } catch (error) {
            this.addMessage(`Failed to delete file: ${error.message}`, 'assistant');
        }
    }

    async downloadFile(path) {
        try {
            const file = await this.fileManager.readFile(path);
            const blob = new Blob([file.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            this.addMessage(`Failed to download file: ${error.message}`, 'assistant');
        }
    }

    showCreateFileDialog(path = '') {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = 'Create New File';

        content.innerHTML = `
            <form id="create-file-form">
                <div class="form-group">
                    <label for="file-name">File Name</label>
                    <input type="text" id="file-name" placeholder="example.txt" required>
                </div>
                <div class="form-group">
                    <label for="file-content">Content</label>
                    <textarea id="file-content-new" rows="15" placeholder="Enter file content..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="secondary-btn" onclick="taskRunner.hideModal()">Cancel</button>
                    <button type="submit" class="primary-btn">Create</button>
                </div>
            </form>
        `;

        document.getElementById('create-file-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const fileName = document.getElementById('file-name').value.trim();
            const fileContent = document.getElementById('file-content-new').value;
            const filePath = path ? `${path}/${fileName}` : fileName;
            this.saveFile(filePath, fileContent);
        });

        this.showModal();
    }

    getLanguageByPath(path) {
        const ext = path.split('.').pop().toLowerCase();
        const langMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'py': 'python',
            'sh': 'bash',
            'yml': 'yaml',
            'yaml': 'yaml',
            'xml': 'xml',
            'sql': 'sql'
        };
        return langMap[ext] || 'plaintext';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();

        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';

        this.processUserMessage(message);
    }

    addMessage(content, role = 'assistant') {
        const container = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
            </div>
        `;
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    async processUserMessage(message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('create task') || lowerMessage.includes('new task')) {
            this.showCreateTaskModal();
            this.addMessage('I can help you create a new task. Please fill in the task details.', 'assistant');
        } else if (lowerMessage.includes('list tasks') || lowerMessage.includes('show tasks')) {
            this.switchView('tasks');
            this.addMessage(`Here are your ${this.tasks.length} tasks.`, 'assistant');
        } else if (lowerMessage.includes('history') || lowerMessage.includes('executions')) {
            this.switchView('history');
            this.addMessage(`Here are your recent task executions.`, 'assistant');
        } else {
            const response = await this.callAI(message);
            this.addMessage(response, 'assistant');
        }
    }

    async callAI(message) {
        const apiKey = this.storage.getAPIKey();

        const response = await fetch('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'glm-4.7',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI Task Runner assistant. Help users create, manage, and monitor tasks. Be concise and helpful.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`AI API failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    switchView(viewName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}-view`);
        });
    }

    showSettingsModal() {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = 'Settings';

        content.innerHTML = `
            <form id="settings-form">
                <div class="form-group">
                    <label for="api-key">GLM API Key</label>
                    <input type="password" id="api-key" value="${this.storage.getAPIKey() || ''}" placeholder="Enter your GLM API key">
                </div>
                <div class="form-group">
                    <label for="github-token">GitHub Token</label>
                    <input type="password" id="github-token" value="${this.storage.getGitHubToken() || ''}" placeholder="Enter your GitHub personal access token">
                </div>
                <div class="form-group">
                    <label for="repository">Repository</label>
                    <input type="text" id="repository" value="${this.storage.getRepository() || ''}" placeholder="owner/repo (e.g., username/my-repo)">
                </div>
                <div class="form-actions">
                    <button type="button" class="secondary-btn" id="cancel-settings">Cancel</button>
                    <button type="submit" class="primary-btn">Save</button>
                </div>
            </form>
        `;

        document.getElementById('cancel-settings').addEventListener('click', () => this.hideModal());

        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        this.showModal();
    }

    saveSettings() {
        const apiKey = document.getElementById('api-key').value.trim();
        const githubToken = document.getElementById('github-token').value.trim();
        const repository = document.getElementById('repository').value.trim();

        if (apiKey) {
            this.storage.setAPIKey(apiKey);
        }
        if (githubToken) {
            this.storage.setGitHubToken(githubToken);
        }
        if (repository) {
            this.storage.setRepository(repository);
        }

        if (githubToken && repository) {
            this.githubAPI = new GitHubAPIClient(githubToken, repository);
            this.loadInitialData();
        }

        this.hideModal();
        this.addMessage('Settings saved successfully!', 'assistant');
    }

    showCreateTaskModal() {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = 'Create New Task';

        content.innerHTML = `
            <form id="create-task-form">
                <div class="form-group">
                    <label for="task-name">Task Name</label>
                    <input type="text" id="task-name" placeholder="Enter task name" required>
                </div>
                <div class="form-group">
                    <label for="task-description">Description</label>
                    <textarea id="task-description" placeholder="Describe the task" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="task-type">Task Type</label>
                    <select id="task-type" required>
                        <option value="script">Script</option>
                        <option value="api">API Call</option>
                        <option value="file">File Operation</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <div class="form-group" id="script-config" style="display: block;">
                    <label for="script-content">Script</label>
                    <textarea id="script-content" placeholder="#!/bin/bash&#10;echo 'Hello, World!'" rows="6"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="secondary-btn" id="cancel-task">Cancel</button>
                    <button type="submit" class="primary-btn">Create Task</button>
                </div>
            </form>
        `;

        document.getElementById('cancel-task').addEventListener('click', () => this.hideModal());

        document.getElementById('task-type').addEventListener('change', (e) => {
            document.getElementById('script-config').style.display = 
                e.target.value === 'script' ? 'block' : 'none';
        });

        document.getElementById('create-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });

        this.showModal();
    }

    async createTask() {
        const name = document.getElementById('task-name').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const type = document.getElementById('task-type').value;
        const scriptContent = document.getElementById('script-content').value;

        const task = {
            id: `task_${Date.now()}`,
            name: name,
            description: description,
            type: type,
            config: type === 'script' ? {
                script: {
                    language: 'bash',
                    script: scriptContent,
                    timeout: 60000
                }
            } : {},
            validation: {
                enabled: true,
                successCriteria: [],
                errorPatterns: ['error', 'failed', 'Error', 'Failed'],
                requireManualReview: false
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: this.storage.getSessionId()
        };

        this.tasks.push(task);
        this.renderTasks();

        await this.saveTaskToGitHub(task);

        this.hideModal();
        this.addMessage(`Task "${name}" created successfully!`, 'assistant');
    }

    async saveTaskToGitHub(task) {
        const tasksContent = JSON.stringify(this.tasks, null, 2);
        try {
            await this.githubAPI.updateFile('data/tasks.json', tasksContent, `Create task: ${task.id}`);
        } catch (error) {
            console.error('Failed to save task to GitHub:', error);
        }
    }

    renderTasks() {
        const container = document.getElementById('tasks-list');

        if (this.tasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No tasks created yet</p>';
            return;
        }

        container.innerHTML = this.tasks.map(task => `
            <div class="task-card">
                <div class="card-header">
                    <span class="card-title">${task.name}</span>
                    <span class="status-badge ${task.type}">${task.type}</span>
                </div>
                <div class="card-meta">
                    <span>${new Date(task.createdAt).toLocaleDateString()}</span>
                    <span>${task.description}</span>
                </div>
                <div class="card-actions" style="margin-top: 0.75rem;">
                    <button class="primary-btn" onclick="taskRunner.executeTask('${task.id}')">
                        Execute
                    </button>
                </div>
            </div>
        `).join('');
    }

    async executeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const executionId = `exec_${Date.now()}`;

        try {
            await this.githubAPI.dispatchWorkflow('task-execution', {
                task_id: task.id,
                task_definition: JSON.stringify(task),
                execution_id: executionId,
                github_token: this.storage.getGitHubToken(),
                repository: this.storage.getRepository()
            });

            this.activeTasks.set(executionId, {
                taskId: task.id,
                status: 'running',
                startTime: Date.now(),
                progress: 0
            });

            this.updateActiveTasks();
            this.addMessage(`Task "${task.name}" started executing...`, 'assistant');
            this.switchView('history');

        } catch (error) {
            this.addMessage(`Failed to execute task: ${error.message}`, 'assistant');
        }
    }

    updateActiveTasks() {
        const container = document.getElementById('active-tasks-list');

        if (this.activeTasks.size === 0) {
            container.innerHTML = '<p class="empty-state">No active tasks</p>';
            return;
        }

        container.innerHTML = Array.from(this.activeTasks.entries()).map(([id, task]) => `
            <div class="task-item" data-execution-id="${id}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                    <span class="task-name">${task.taskId}</span>
                    <span class="status-badge ${task.status}">${task.status}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${task.progress}%"></div>
                </div>
            </div>
        `).join('');
    }

    async loadExecutions() {
        if (!this.githubAPI) return;

        try {
            const runs = await this.githubAPI.listWorkflowRuns();
            this.executions = runs.workflow_runs
                .filter(run => run.name === 'Task Execution Engine')
                .map(run => ({
                    id: run.id,
                    status: run.conclusion === 'success' ? 'completed' : (run.conclusion === 'failure' ? 'failed' : 'running'),
                    startTime: new Date(run.created_at).getTime(),
                    endTime: run.updated_at ? new Date(run.updated_at).getTime() : null,
                    runId: run.id,
                    name: run.display_title,
                    triggeredBy: run.triggered_by
                }));

            this.renderHistory();
        } catch (error) {
            console.error('Failed to load executions:', error);
        }
    }

    renderHistory() {
        const container = document.getElementById('history-list');

        if (this.executions.length === 0) {
            container.innerHTML = '<p class="empty-state">No execution history</p>';
            return;
        }

        container.innerHTML = this.executions.slice(0, 20).map(exec => `
            <div class="execution-card">
                <div class="card-header">
                    <span class="card-title">Run #${exec.id}</span>
                    <span class="status-badge ${exec.status}">${exec.status}</span>
                </div>
                <div class="card-meta">
                    <span>${new Date(exec.startTime).toLocaleString()}</span>
                    ${exec.endTime ? `<span>Duration: ${Math.round((exec.endTime - exec.startTime) / 1000)}s</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        this.executions = [];
        this.renderHistory();
    }

    startStatusPolling() {
        setInterval(() => {
            this.pollStatus();
        }, 10000);
    }

    async pollStatus() {
        if (this.activeTasks.size === 0 || !this.githubAPI) return;

        for (const [executionId, task] of this.activeTasks.entries()) {
            try {
                const run = await this.githubAPI.getWorkflowRun(task.runId);
                const status = run.conclusion === 'success' ? 'completed' : (run.conclusion === 'failure' ? 'failed' : 'running');
                const progress = run.conclusion ? 100 : Math.min(90, Math.floor(((Date.now() - task.startTime) / 120000) * 100));

                this.activeTasks.set(executionId, {
                    ...task,
                    status,
                    progress
                });

                if (status === 'completed' || status === 'failed') {
                    this.activeTasks.delete(executionId);
                    this.loadExecutions();
                }
            } catch (error) {
                console.error(`Failed to poll status for ${executionId}:`, error);
            }
        }

        this.updateActiveTasks();
    }

    async loadGitHistory() {
        if (!this.gitManager) return;

        const container = document.getElementById('git-commits-list');
        container.innerHTML = '<p class="empty-state"><span class="loading"></span> Loading commits...</p>';

        try {
            const commits = await this.gitManager.getCommits(20);
            this.renderGitCommits(commits);
        } catch (error) {
            container.innerHTML = `<p class="empty-state">Error loading commits: ${error.message}</p>`;
        }
    }

    renderGitCommits(commits) {
        const container = document.getElementById('git-commits-list');

        if (!commits || commits.length === 0) {
            container.innerHTML = '<p class="empty-state">No commits found</p>';
            return;
        }

        container.innerHTML = commits.map(commit => {
            const formatted = this.gitManager.formatCommit(commit);
            return `
            <div class="commit-card">
                <div class="card-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        ${formatted.avatarUrl ? `<img src="${formatted.avatarUrl}" width="24" height="24" style="border-radius: 50%;">` : '<div style="width: 24px; height: 24px; background: var(--border); border-radius: 50%;"></div>'}
                        <span class="card-title">${formatted.message}</span>
                    </div>
                    <span class="commit-sha">${formatted.sha}</span>
                </div>
                <div class="card-meta">
                    <span>${formatted.author}</span>
                    <span>${new Date(formatted.date).toLocaleString()}</span>
                </div>
            </div>
        `}).join('');
    }

    async showDiffModal() {
        if (!this.gitManager) return;

        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = 'View Diff';

        content.innerHTML = `
            <form id="diff-form">
                <div class="form-group">
                    <label for="base-ref">Base Reference</label>
                    <input type="text" id="base-ref" placeholder="HEAD~1 or commit SHA" required>
                </div>
                <div class="form-group">
                    <label for="head-ref">Head Reference</label>
                    <input type="text" id="head-ref" value="main" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="secondary-btn" onclick="taskRunner.hideModal()">Cancel</button>
                    <button type="submit" class="primary-btn">View Diff</button>
                </div>
            </form>
        `;

        document.getElementById('diff-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const baseRef = document.getElementById('base-ref').value;
            const headRef = document.getElementById('head-ref').value;
            await this.showDiff(baseRef, headRef);
        });

        this.showModal();
    }

    async showDiff(base, head) {
        if (!this.gitManager) return;

        const content = document.getElementById('modal-content');

        try {
            const diff = await this.gitManager.getDiff(base, head);
            const formatted = this.gitManager.formatDiff(diff);

            content.innerHTML = `
                <div class="diff-summary">
                    <div class="summary-card">
                        <h4>Changed Files</h4>
                        <div class="value">${diff.files.length}</div>
                    </div>
                    <div class="summary-card">
                        <h4>Additions</h4>
                        <div class="value" style="color: var(--success)">+${diff.files.reduce((sum, f) => sum + f.additions, 0)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>Deletions</h4>
                        <div class="value" style="color: var(--danger)">-${diff.files.reduce((sum, f) => sum + f.deletions, 0)}</div>
                    </div>
                </div>
                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.75rem;">Changed Files</h4>
                    ${diff.files.map(file => `
                        <div class="file-diff" style="padding: 1rem; background: var(--bg-darker); border-radius: 0.375rem; margin-bottom: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="font-weight: 500;">${file.filename}</span>
                                <div style="display: flex; gap: 1rem; font-size: 0.8rem;">
                                    <span style="color: var(--success)">+${file.additions}</span>
                                    <span style="color: var(--danger)">-${file.deletions}</span>
                                </div>
                            </div>
                            ${file.patch ? `
                                <pre style="background: var(--bg-light); padding: 0.75rem; border-radius: 0.25rem; overflow-x: auto; font-size: 0.8rem;"><code>${this.escapeHtml(file.patch).substring(0, 500)}${file.patch.length > 500 ? '...' : ''}</code></pre>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions" style="margin-top: 1rem;">
                    <button class="secondary-btn" onclick="taskRunner.hideModal()">Close</button>
                </div>
            `;
        } catch (error) {
            content.innerHTML = `
                <div style="color: var(--danger); padding: 1rem;">
                    Failed to load diff: ${error.message}
                </div>
                <div class="form-actions" style="margin-top: 1rem;">
                    <button class="secondary-btn" onclick="taskRunner.showDiffModal()">Try Again</button>
                    <button class="secondary-btn" onclick="taskRunner.hideModal()">Close</button>
                </div>
            `;
        }
    }

    async autoCommitChanges() {
        if (!this.gitManager || !this.githubAPI) return;

        try {
            const commits = await this.gitManager.getCommits(1);
            const latestCommit = commits[0];

            if (!latestCommit || latestCommit.commit.message.startsWith('Automated commit')) {
                return;
            }

            await this.githubAPI.dispatchWorkflow('git-integration', {
                action: 'commit',
                commit_message: `Automated commit from task execution at ${new Date().toISOString()}`,
                github_token: this.storage.getGitHubToken(),
                repository: this.storage.getRepository()
            });

            this.addMessage('Changes committed automatically.', 'assistant');
            this.loadGitHistory();
        } catch (error) {
            console.error('Auto-commit failed:', error);
        }
    }

    showModal() {
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }
}

const taskRunner = new TaskRunner();
export default taskRunner;