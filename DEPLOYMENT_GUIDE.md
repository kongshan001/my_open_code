# 部署指南

## 项目完成情况总结

### ✅ 已完成的核心功能

1. **任务定义和数据结构**
   - 完整的任务类型定义（脚本/API/文件/自定义）
   - 任务状态机实现
   - 执行记录管理

2. **Web前端界面**
   - 现代化的响应式UI设计
   - 聊天界面与AI助手交互
   - 任务管理界面
   - 文件浏览器
   - Git历史查看器

3. **API Key管理**
   - 客户端本地存储
   - 安全验证机制
   - GitHub Token管理

4. **GitHub Actions工作流**
   - 任务执行引擎
   - 状态监控系统
   - 文件操作处理
   - Git集成服务
   - GitHub Pages自动部署

5. **实时进度监控**
   - GitHub API轮询机制
   - 任务状态实时更新
   - 进度条显示

6. **通用任务执行框架**
   - 支持多种任务类型
   - 灵活的参数配置
   - 错误处理机制

7. **高级文件管理**
   - 文件浏览和搜索
   - 文件创建、编辑、删除
   - 文件下载
   - 目录导航

8. **自动Git集成**
   - 提交历史查看
   - Diff比较功能
   - 自动提交支持
   - 分支管理

### 📦 项目结构

```
my_ai_agent/
├── .github/workflows/          # GitHub Actions配置
│   ├── task-execution.yml      # 任务执行工作流
│   ├── status-monitor.yml      # 状态监控工作流
│   ├── file-operations.yml     # 文件操作工作流
│   ├── git-integration.yml     # Git集成工作流
│   └── deploy-pages.yml        # Pages部署工作流
├── web/                        # Web前端（静态文件）
│   ├── index.html             # 主页面
│   └── assets/
│       ├── css/
│       │   └── main.css       # 样式文件
│       └── js/
│           ├── main.js         # 核心逻辑
│           ├── file-manager.js # 文件管理器
│           └── git-manager.js  # Git管理器
├── src/                        # TypeScript源码
│   ├── web-types.ts           # 类型定义
│   └── task-executor.ts       # 任务执行器
├── package.json               # 项目配置
├── tsconfig.json             # TypeScript配置
├── WEB_README.md             # Web应用使用文档
└── DEPLOYMENT_GUIDE.md       # 本文件 - 部署指南
```

## 部署步骤

### 1. 准备GitHub仓库

1. **创建新仓库或使用现有仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AI Task Runner"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **启用GitHub Pages**
   - 进入仓库Settings → Pages
   - Source选择: "Deploy from a branch"
   - Branch选择: "main" 和 "/ (root)"
   - 点击Save

3. **配置GitHub Actions权限**
   - 进入Settings → Actions → General
   - Workflow permissions选择: "Read and write permissions"
   - 勾选"Allow GitHub Actions to create and approve pull requests"
   - 点击Save

### 2. 配置GitHub Token

1. **生成Personal Access Token**
   - 访问 https://github.com/settings/tokens/new
   - Token名称: "AI Task Runner"
   - 勾选权限:
     - `repo` (完整仓库访问)
     - `workflow` (工作流访问)
     - `actions` (Actions访问)
   - 生成并保存token（仅显示一次）

2. **添加到仓库Secrets**
   - 进入仓库Settings → Secrets and variables → Actions
   - 点击"New repository secret"
   - Name: `GITHUB_TOKEN`
   - Value: 你生成的token
   - 点击Add secret

### 3. 配置GLM API Key

1. **获取GLM API Key**
   - 访问 https://open.bigmodel.cn/
   - 注册账号并获取API Key
   - 保存API Key

2. **添加到仓库Secrets（可选）**
   - Name: `GLM_API_KEY`
   - Value: 你的GLM API Key

### 4. 验证部署

1. **检查Actions工作流**
   - 进入仓库Actions标签页
   - 确认"Deploy to GitHub Pages"工作流正在运行
   - 等待部署完成（约2-3分钟）

2. **访问Web应用**
   - 访问 `https://YOUR_USERNAME.github.io/YOUR_REPO/`
   - 应该看到AI Task Runner登录界面

3. **配置应用**
   - 点击右上角设置图标
   - 填入:
     - **GLM API Key**: 你获取的API密钥
     - **GitHub Token**: 你的Personal Access Token
     - **Repository**: `YOUR_USERNAME/YOUR_REPO`
   - 点击保存

### 5. 测试功能

1. **创建测试任务**
   - 点击"Tasks" → "Create Task"
   - 填写任务信息
   - 选择类型"Script"
   - 输入测试脚本:
     ```bash
     echo "Hello, World!"
     date
     ```
   - 点击"Create Task"

2. **执行任务**
   - 在任务列表中点击"Execute"
   - 切换到"History"标签
   - 等待任务完成

3. **测试文件管理**
   - 切换到"Files"标签
   - 浏览仓库文件
   - 创建新文件
   - 编辑文件
   - 查看提交历史

4. **测试Git集成**
   - 切换到"Git"标签
   - 查看提交历史
   - 使用"View Diff"功能

## 本地开发

### 安装依赖

```bash
npm install
```

### 构建TypeScript

```bash
npm run build
```

### 本地运行CLI版本

```bash
npm run dev
```

### 本地运行Web版本

```bash
npm run serve:web
```

访问 http://localhost:8080

## 故障排除

### GitHub Actions失败

**问题**: Actions工作流执行失败

**解决方案**:
1. 检查Actions日志获取详细错误信息
2. 确认GitHub Token权限正确
3. 确认仓库Settings → Actions → Workflow permissions设置为"Read and write permissions"

### Web应用无法访问

**问题**: GitHub Pages部署失败或无法访问

**解决方案**:
1. 检查仓库Settings → Pages配置
2. 确认"Deploy to GitHub Pages"工作流成功
3. 清除浏览器缓存并重试
4. 检查web/目录是否存在于仓库根目录

### 任务执行失败

**问题**: 任务创建成功但执行失败

**解决方案**:
1. 查看Actions工作流日志
2. 检查任务配置是否正确
3. 确认GitHub Token有足够权限
4. 检查脚本语法是否正确

### 状态更新不及时

**问题**: 任务状态不实时更新

**解决方案**:
1. 系统每10秒轮询一次，请耐心等待
2. 检查GitHub API速率限制
3. 刷新页面重新加载

## 安全建议

1. **保护敏感信息**
   - API Key和Token仅存储在浏览器本地
   - 不要在公开仓库中包含敏感信息
   - 定期轮换API Key和Token

2. **限制权限**
   - 使用最小权限原则配置GitHub Token
   - 定期审查仓库权限

3. **监控使用**
   - 定期检查GitHub Actions使用情况
   - 监控API调用次数和成本

## 下一步优化建议

### 待实现功能

1. **混合验证系统**
   - 自动规则验证
   - 人工审核界面
   - 验证结果记录

2. **数据持久化优化**
   - 改进数据存储结构
   - 添加数据索引
   - 优化查询性能

3. **用户认证**
   - GitHub OAuth登录
   - 会话管理
   - 权限控制

4. **错误处理**
   - 重试机制
   - 超时处理
   - 错误恢复

5. **任务调度**
   - Cron调度
   - 定时任务
   - 任务队列

### 性能优化

1. **前端优化**
   - 代码分割
   - 懒加载
   - 缓存策略

2. **后端优化**
   - 减少API调用
   - 批量操作
   - 异步处理

3. **监控和日志**
   - 添加日志记录
   - 性能监控
   - 错误追踪

## 支持

如有问题或建议，请：
1. 查看WEB_README.md了解详细使用说明
2. 检查GitHub Actions日志
3. 提交Issue报告问题

## 许可证

MIT License