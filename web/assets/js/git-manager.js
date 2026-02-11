class GitManager {
    constructor(githubAPI) {
        this.githubAPI = githubAPI;
    }

    async getCommits(limit = 20) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/commits?per_page=${limit}`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get commits: ${response.statusText}`);
        }

        return response.json();
    }

    async getCommit(sha) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/commits/${sha}`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get commit: ${response.statusText}`);
        }

        return response.json();
    }

    async getDiff(base, head = 'main') {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/compare/${base}...${head}`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get diff: ${response.statusText}`);
        }

        return response.json();
    }

    async createBranch(branchName, baseBranch = 'main') {
        return await this.githubAPI.createBranch(branchName, baseBranch);
    }

    async createPullRequest(title, description, headBranch, baseBranch = 'main') {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/pulls`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    body: description,
                    head: headBranch,
                    base: baseBranch
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create PR: ${response.statusText}`);
        }

        return response.json();
    }

    async getPullRequests(state = 'all') {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/pulls?state=${state}`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get PRs: ${response.statusText}`);
        }

        return response.json();
    }

    async createCommit(message, files, branch = 'main') {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const treeItems = [];

        for (const file of files) {
            const fileData = await this.githubAPI.getFile(file.path);
            if (fileData) {
                const content = file.content || fileData.content;
                const blob = await this.createBlob(content);
                treeItems.push({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    sha: blob.sha
                });
            }
        }

        const tree = await this.createTree(treeItems);
        const parentCommit = await this.getLatestCommit(branch);
        const commit = await this.createCommitObject(message, tree.sha, parentCommit.sha);

        return await this.updateRef(branch, commit.sha);
    }

    async createBlob(content) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/git/blobs`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: btoa(content),
                    encoding: 'base64'
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create blob: ${response.statusText}`);
        }

        return response.json();
    }

    async createTree(treeItems) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/git/trees`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tree: treeItems
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create tree: ${response.statusText}`);
        }

        return response.json();
    }

    async getLatestCommit(branch = 'main') {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get ref: ${response.statusText}`);
        }

        const data = await response.json();
        return data.object;
    }

    async createCommitObject(message, treeSha, parentSha) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/git/commits`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    tree: treeSha,
                    parents: [parentSha]
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create commit: ${response.statusText}`);
        }

        return response.json();
    }

    async updateRef(ref, sha) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/git/refs/heads/${ref}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sha: sha,
                    force: false
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update ref: ${response.statusText}`);
        }

        return response.json();
    }

    async getStatus(sha) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/commits/${sha}/status`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get status: ${response.statusText}`);
        }

        return response.json();
    }

    async getBranches() {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/branches`,
            {
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get branches: ${response.statusText}`);
        }

        return response.json();
    }

    async deleteBranch(branchName) {
        const [owner, repo] = this.githubAPI.repository.split('/');

        const response = await fetch(
            `${this.githubAPI.baseUrl}/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${this.githubAPI.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete branch: ${response.statusText}`);
        }

        return response.json();
    }

    formatCommit(commit) {
        return {
            sha: commit.sha.substring(0, 7),
            fullSha: commit.sha,
            message: commit.commit.message.split('\n')[0],
            author: commit.commit.author.name,
            date: commit.commit.author.date,
            avatarUrl: commit.author ? commit.author.avatar_url : null,
            url: commit.html_url
        };
    }

    formatDiff(diff) {
        return {
            aheadBy: diff.ahead_by,
            behindBy: diff.behind_by,
            status: diff.status,
            files: diff.files.map(file => ({
                filename: file.filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
                changes: file.changes,
                patch: file.patch
            }))
        };
    }
}

export { GitManager };