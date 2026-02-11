# AI Task Runner - 远程任务执行平台

AI Task Runner 是一个基于 GitHub Actions 的远程任务执行和监控平台，支持在 GitHub Pages 上运行，无需自建服务器。

## 功能特性

- ✅ **远程任务执行**：在 GitHub Actions 环境中执行各种任务
- ✅ **实时监控**：实时查看任务执行进度和状态
- ✅ **多任务类型支持**：脚本、API调用、文件操作等
- ✅ **AI 智能助手**：基于 GLM-4.7 的 AI 助手帮助创建和管理任务
- ✅ **文件管理**：完整的文件浏览、编辑、删除功能
- ✅ **自动 Git 集成**：任务变更自动提交到 GitHub 仓库
- ✅ **混合验证**：自动规则验证 + 人工审核
- ✅ **GitHub Pages 部署**：无需服务器，零成本运行

## 快速开始

### 1. 准备 GitHub Token

1. 访问 [GitHub Token 设置](https://github.com/settings/tokens/new)
2. 生成新的 Personal Access Token，勾选以下权限：
   - `repo` (完整仓库访问权限)
   - `workflow` (工作流访问权限)
   - `actions` (Actions 访问权限)
3. 保存生成的 token

### 2. 准备 GLM API Key

1. 访问 [GLM 开放平台](https://open.bigmodel.cn/)
2. 注册账号并获取 API Key
3. 保存 API Key

### 3. 部署到 GitHub Pages

将此项目推送到你的 GitHub 仓库：

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

推送后，GitHub Actions 会自动将 Web 应用部署到 GitHub Pages。

访问地址：`https://你的用户名.github.io/仓库名/`

### 4. 配置 Web 应用

1. 打开部署后的 Web 应用
2. 点击右上角的设置图标
3. 填入以下信息：
   - **GLM API Key**：你获取的 GLM API 密钥
   - **GitHub Token**：你生成的 GitHub Personal Access Token
   - **Repository**：你的仓库格式（如：`username/repository`）
4. 点击保存

## 使用指南

### 创建任务

1. 点击侧边栏的 "Tasks"
2. 点击 "Create Task" 按钮
3. 填写任务信息：
   - **任务名称**：任务的标识
   - **描述**：任务说明
   - **类型**：选择任务类型（脚本/API/文件/自定义）
   - **配置**：根据类型填写具体配置
4. 点击 "Create Task"

### 执行任务

1. 在任务列表中找到要执行的任务
2. 点击 "Execute" 按钮
3. 切换到 "History" 标签查看执行状态
4. 实时查看执行进度和结果

### 文件管理

1. 点击侧边栏的 "Files"
2. 浏览仓库文件结构
3. 使用提供的功能进行文件操作：
   - 查看文件内容
   - 编辑文件
   - 删除文件
   - 创建新文件

### AI 助手

在聊天界面中，你可以：

- 输入 "create task" 快速创建任务
- 输入 "list tasks" 查看任务列表
- 输入 "history" 查看执行历史
- 与 AI 助手对话，获取帮助和建议

## 任务类型

### 脚本任务 (Script)

执行 Shell 或 Node.js 脚本：

```bash
#!/bin/bash
echo "Hello, World!"
date
```

### API 调用任务 (API)

调用外部 API：

```json
{
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

### 文件操作任务 (File)

执行文件操作：

- **read**: 读取文件内容
- **write**: 写入文件内容
- **delete**: 删除文件
- **list**: 列出目录内容
- **move**: 移动文件或目录

### 自定义任务 (Custom)

执行自定义 JavaScript 函数：

```javascript
async function customTask({ param1, param2 }) {
  return {
    result: param1 + param2,
    timestamp: Date.now()
  };
}
```

## 项目结构

```
.
├── web/                          # Web 前端
│   ├── index.html               # 主页面
│   ├── assets/
│   │   ├── css/main.css        # 样式文件
│   │   └── js/main.js          # 核心逻辑
├── src/                         # TypeScript 源码
│   ├── web-types.ts            # 类型定义
│   ├── task-executor.ts        # 任务执行器
│   └── ...
├── .github/workflows/           # GitHub Actions 工作流
│   ├── task-execution.yml      # 任务执行
│   ├── status-monitor.yml      # 状态监控
│   ├── file-operations.yml     # 文件操作
│   ├── git-integration.yml     # Git 集成
│   └── deploy-pages.yml        # Pages 部署
└── data/                        # 数据存储（在仓库中）
    ├── tasks/                   # 任务定义
    ├── executions/              # 执行记录
    ├── workspace/               # 工作区状态
    └── status/                  # 实时状态
```

## 工作原理

### 架构设计

```
┌─────────────────┐
│   Web Frontend │ (GitHub Pages)
│   (静态页面)    │
└────────┬────────┘
         │
         │ GitHub API
         ▼
┌─────────────────┐
│  GitHub Actions │ (无服务器后端)
│  (执行引擎)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Repo    │ (数据存储)
│  (任务/结果)    │
└─────────────────┘
```

### 任务执行流程

1. 用户在 Web 界面创建/执行任务
2. 前端通过 GitHub API 触发 Actions 工作流
3. Actions 在 runner 上执行任务
4. 执行状态实时写入仓库
5. 前端轮询状态更新界面
6. 结果通过 Git 自动提交

### 数据持久化

所有数据都存储在 GitHub 仓库中：

- **任务定义**：`data/tasks/` 目录
- **执行记录**：`data/executions/` 目录
- **实时状态**：`data/status/` 目录
- **工作区状态**：`data/workspace/state.json`

## 安全性

- API Key 仅存储在用户浏览器中
- GitHub Token 永不发送到第三方服务
- 所有通信通过 HTTPS 加密
- 任务执行在隔离的 GitHub Actions 环境中

## 配置选项

### 环境变量

可以在 `.env` 文件中配置：

```env
GLM_API_KEY=your-api-key
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
GLM_MODEL=glm-4.7
```

### GitHub Actions 配置

在 `.github/workflows/task-execution.yml` 中：

- `timeout-minutes`：任务超时时间
- `runs-on`：运行环境

## 故障排除

### 任务执行失败

1. 检查 GitHub Token 权限
2. 查看 Actions 日志获取详细错误信息
3. 确认任务配置正确

### Web 应用无法访问

1. 检查 GitHub Pages 设置是否启用
2. 确认源分支设置为 `main`
3. 查看部署工作流状态

### 状态更新不及时

- 系统每 10 秒轮询一次状态
- GitHub Actions 可能有延迟，请耐心等待

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue。