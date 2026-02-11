class FileManager {
    constructor(githubAPI) {
        this.githubAPI = githubAPI;
        this.currentPath = '';
        this.files = [];
    }

    async listFiles(path = '') {
        this.currentPath = path;
        const [owner, repo] = this.githubAPI.repository.split('/');

        try {
            const response = await fetch(
                `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubAPI.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to list files: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (Array.isArray(data)) {
                this.files = data.map(item => ({
                    name: item.name,
                    path: item.path,
                    type: item.type,
                    size: item.size,
                    sha: item.sha
                }));
                return this.files;
            }

            return [data];
        } catch (error) {
            console.error('Error listing files:', error);
            throw error;
        }
    }

    async readFile(path) {
        return await this.githubAPI.getFile(path);
    }

    async writeFile(path, content, message = 'Update file') {
        try {
            const existingFile = await this.githubAPI.getFile(path);
            return await this.githubAPI.updateFile(path, content, message, existingFile?.sha);
        } catch (error) {
            if (error.message.includes('404')) {
                return await this.githubAPI.updateFile(path, content, `Create file: ${path}`);
            }
            throw error;
        }
    }

    async deleteFile(path, message = 'Delete file') {
        const [owner, repo] = this.githubAPI.repository.split('/');
        const file = await this.githubAPI.getFile(path);

        if (!file) {
            throw new Error(`File not found: ${path}`);
        }

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sha: file.sha
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete file: ${response.statusText}`);
        }

        return response.json();
    }

    async createDirectory(path) {
        await this.writeFile(`${path}/.gitkeep`, '', `Create directory: ${path}`);
    }

    async moveFile(sourcePath, targetPath, message = 'Move file') {
        const file = await this.readFile(sourcePath);
        await this.writeFile(targetPath, file.content, message);
        await this.deleteFile(sourcePath, `Remove: ${sourcePath}`);
    }

    async searchFiles(pattern, path = '') {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/search/code?q=${encodeURIComponent(`${pattern} repo:${owner}/${repo}`)}`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to search files: ${response.statusText}`);
        }

        const data = await response.json();
        return data.items || [];
    }

    async getFileInfo(path) {
        return await this.githubAPI.getFile(path);
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    getIconByType(type) {
        const icons = {
            'dir': '📁',
            'file': '📄',
            'symlink': '🔗',
            'submodule': '📦'
        };
        return icons[type] || '📄';
    }

    getIconByName(name) {
        const ext = name.split('.').pop().toLowerCase();
        const iconMap = {
            'js': '📜',
            'ts': '📘',
            'html': '🌐',
            'css': '🎨',
            'json': '📋',
            'md': '📝',
            'py': '🐍',
            'sh': '💻',
            'yml': '⚙️',
            'yaml': '⚙️',
            'svg': '🖼️',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️'
        };
        return iconMap[ext] || '📄';
    }
}

export { FileManager };