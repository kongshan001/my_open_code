# MultiAgent AI System - 1人公司智能协作平台

一个功能强大的AI系统，结合了交互式CLI聊天和MultiAgent协作系统，完美支持1人公司的所有工作流程。基于GLM-4.7模型构建。

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ 核心特性

### 🤖 交互式AI助手
- ✅ 智能CLI聊天界面
- ✅ 完整的工具系统（bash, read, grep等）
- ✅ 会话持久化存储
- ✅ 实时流式响应
- ✅ 上下文压缩（自动管理长对话）
- ✅ 可扩展的工具架构

### 🚀 MultiAgent协作系统
- ✅ **4种专业Agent**：开发者、测试、产品、运维
- ✅ 智能任务路由（优先级/负载均衡）
- ✅ 并行/顺序任务执行
- ✅ Agent间消息通信
- ✅ 完整的性能监控
- ✅ 实时系统状态

### 📊 1人公司最佳实践
- ✅ 完整的产品开发工作流
- ✅ 自动化代码审查和测试
- ✅ 智能文档生成
- ✅ 一键部署和监控
- ✅ 需求到上线的全流程覆盖

## 🎯 适用场景

**1人公司的完美解决方案**：
- 独立开发者 - 从需求到部署的全流程管理
- 小团队创业 - 用AI放大团队效率
- 自由职业者 - 同时处理多个项目
- 个人项目 - 完整的项目生命周期管理

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env，填入你的 GLM API Key
```

```env
GLM_API_KEY=your-api-key-here
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
GLM_MODEL=glm-4.7
```

### 3. 编译项目

```bash
npm run build
```

### 4. 启动CLI模式

```bash
npm run dev
# 或
npm start
```

### 5. 使用MultiAgent系统（代码示例）

创建文件 `demo.js`:

```javascript
import { multiAgentSystem } from './dist/multi-agent-system.js';

async function demo() {
  // 初始化系统
  await multiAgentSystem.initialize();

  // 查看系统状态
  console.log('=== 系统状态 ===');
  console.log(multiAgentSystem.getSystemStatus());

  // 执行开发任务
  const devTask = {
    id: 'dev-1',
    name: 'Build Project',
    description: 'Build the project',
    type: 'script',
    config: {
      script: {
        language: 'bash',
        script: 'echo "Building project..." && npm run build',
      },
    },
    validation: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'demo-user',
  };

  const devResult = await multiAgentSystem.executeTask(devTask, undefined, 'developer');
  console.log('\n=== 开发任务结果 ===');
  console.log('Success:', devResult.success);
  console.log('Output:', devResult.output);

  // 执行测试任务
  const testTask = {
    id: 'test-1',
    name: 'Run Tests',
    description: 'Run unit tests',
    type: 'script',
    config: {
      script: {
        language: 'bash',
        script: 'echo "PASS: All tests passed"',
      },
    },
    validation: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'demo-user',
  };

  const testResult = await multiAgentSystem.executeTask(testTask, undefined, 'tester');
  console.log('\n=== 测试任务结果 ===');
  console.log('Success:', testResult.success);
  console.log('Output:', testResult.output);

  // 查看最终性能统计
  console.log('\n=== 性能统计 ===');
  console.log(multiAgentSystem.getSystemStatus().performance);
}

demo().catch(console.error);
```

运行：

```bash
node demo.js
```

## 📖 MultiAgent系统详解

### Agent架构

```
MultiAgentSystem
├── AgentRegistry (Agent注册表)
│   ├── DeveloperAgent × 2 (开发者)
│   ├── TesterAgent × 2 (测试工程师)
│   ├── ProductAgent × 1 (产品经理)
│   └── OperationsAgent × 1 (运维工程师)
├── AgentOrchestrator (任务协调器)
│   ├── PriorityBasedRouting (优先级路由)
│   ├── LoadBalancingRouting (负载均衡路由)
│   ├── 任务调度
│   ├── Agent通信
│   └── 性能监控
└── Agent (基类)
    ├── execute() - 任务执行
    ├── sendMessage() - 发送消息
    ├── receiveMessage() - 接收消息
    ├── updateStatus() - 状态管理
    └── updateMetrics() - 性能指标
```

### Agent能力详解

#### 🔨 DeveloperAgent (开发者Agent)

**核心能力**：
- 代码生成（多语言支持）
- Bug调试和修复
- 代码审查和质量检查
- 测试用例编写
- 技术文档生成

**支持的任务**：
```javascript
// 脚本执行
{
  type: 'script',
  config: {
    script: {
      language: 'bash' | 'node',
      script: 'your script here',
      workingDir: '/path/to/dir',
      env: { VAR: 'value' }
    }
  }
}

// 文件操作
{
  type: 'file',
  config: {
    file: {
      operation: 'read' | 'write' | 'delete',
      path: '/path/to/file',
      content: 'file content'
    }
  }
}

// API调用
{
  type: 'api',
  config: {
    api: {
      url: 'https://api.example.com',
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      headers: { 'Authorization': 'Bearer token' },
      body: { key: 'value' },
      expectedStatus: [200, 201]
    }
  }
}
```

#### 🧪 TesterAgent (测试工程师Agent)

**核心能力**：
- 自动化测试脚本生成
- 单元/集成/E2E测试执行
- 测试覆盖率分析
- Bug报告生成
- 验收标准验证

**测试任务示例**：
```javascript
// 执行测试脚本
{
  type: 'script',
  config: {
    script: {
      language: 'bash' | 'node' | 'python',
      script: 'npm test'
    }
  }
}

// 自定义测试函数
{
  type: 'custom',
  config: {
    custom: {
      function: `async function({ input, expected }) {
        if (input === expected) {
          return { passed: true };
        }
        throw new Error('Test failed');
      }`,
      parameters: { input: 'test', expected: 'test' }
    }
  }
}

// API端点测试
{
  type: 'api',
  config: {
    api: {
      url: 'https://api.example.com/health',
      method: 'GET',
      expectedStatus: [200]
    }
  }
}
```

#### 📝 ProductAgent (产品经理Agent)

**核心能力**：
- 需求分析和文档编写
- 用户故事创建
- 验收标准定义
- 产品路线图规划
- 市场研究

**产品任务示例**：
```javascript
// 创建用户故事
{
  type: 'custom',
  config: {
    custom: {
      taskType: 'user-story',
      title: '用户登录功能',
      role: '用户',
      want: '能够登录系统',
      benefit: '可以使用所有功能',
      priority: 'High',
      complexity: 'Medium',
      criteria: [
        '支持用户名/密码登录',
        '支持社交账号登录',
        '登录失败显示友好提示'
      ]
    }
  }
}

// 创建验收标准
{
  type: 'custom',
  config: {
    custom: {
      taskType: 'acceptance-criteria',
      feature: '用户登录',
      given: '用户在登录页面',
      when: '输入有效的用户名和密码',
      then: '成功跳转到首页',
      scenarios: [
        '测试有效登录',
        '测试无效密码',
        '测试空字段'
      ],
      maxResponseTime: '2s',
      minThroughput: '100 req/s'
    }
  }
}

// 创建产品路线图
{
  type: 'custom',
  config: {
    custom: {
      taskType: 'roadmap',
      version: '2.0.0',
      timeline: 'Q2 2024',
      phase1: {
        duration: '4 weeks',
        items: ['需求分析', '原型设计']
      },
      phase2: {
        duration: '6 weeks',
        items: ['核心功能开发', '集成测试']
      },
      milestones: [
        { name: 'Alpha', date: '2024-04-15', description: '内部测试' },
        { name: 'Beta', date: '2024-05-15', description: '公开测试' }
      ]
    }
  }
}
```

#### ⚙️ OperationsAgent (运维工程师Agent)

**核心能力**：
- 应用部署（Docker/Kubernetes）
- 系统监控和告警
- 资源自动扩容
- 备份和恢复
- 事件响应和处理

**运维任务示例**：
```javascript
// 部署服务
{
  type: 'custom',
  config: {
    custom: {
      opsType: 'deploy',
      serviceName: 'my-app',
      version: 'v1.2.3',
      environment: 'production',
      replicas: 3,
      endpoint: 'https://api.example.com',
      healthEndpoint: 'https://api.example.com/health'
    }
  }
}

// 监控系统
{
  type: 'custom',
  config: {
    custom: {
      opsType: 'monitor',
      serviceId: 'my-service-123'
    }
  }
}

// 扩容
{
  type: 'custom',
  config: {
    custom: {
      opsType: 'scale',
      serviceName: 'my-service',
      currentReplicas: 3,
      targetReplicas: 6
    }
  }
}

// 备份
{
  type: 'custom',
  config: {
    custom: {
      opsType: 'backup',
      type: 'Full Backup',
      source: 'Database',
      destination: 'S3 Bucket',
      retention: '30 days'
    }
  }
}

// 生成配置文件
{
  type: 'file',
  config: {
    file: {
      operation: 'write',
      path: 'docker-compose.yml',
    },
    metadata: {
      configType: 'docker-compose'
    }
  }
}
```

## 🎓 1人公司最佳实践

### 最佳实践 1：需求驱动开发

**完整工作流**：从想法到上线

```javascript
import { multiAgentSystem } from './multi-agent-system.js';

async function featureWorkflow() {
  await multiAgentSystem.initialize();

  // 第1步：产品分析 - 创建用户故事
  const userStoryTask = {
    type: 'custom',
    config: {
      custom: {
        taskType: 'user-story',
        title: '购物车功能',
        role: '用户',
        want: '能够添加商品到购物车',
        benefit: '可以批量购买商品',
        priority: 'High',
        complexity: 'Medium',
      },
    },
    // ... 其他必需字段
  };

  const userStory = await multiAgentSystem.executeTask(
    userStoryTask, 
    undefined, 
    'product'
  );

  console.log('用户故事创建完成:', userStory.output);

  // 第2步：创建验收标准
  const acceptanceTask = {
    type: 'custom',
    config: {
      custom: {
        taskType: 'acceptance-criteria',
        feature: '购物车功能',
        given: '用户在商品详情页',
        when: '点击"添加到购物车"按钮',
        then: '商品添加成功且数量+1',
        scenarios: [
          '添加单个商品',
          '添加多个相同商品',
          '添加库存不足的商品',
        ],
      },
    },
    // ... 其他必需字段
  };

  const acceptance = await multiAgentSystem.executeTask(
    acceptanceTask,
    undefined,
    'product'
  );

  console.log('验收标准创建完成:', acceptance.output);

  // 第3步：开发实现
  const devTask = {
    type: 'script',
    config: {
      script: {
        language: 'bash',
        script: `
          # 生成购物车功能代码
          echo "Generating cart module..." > src/cart.js
          echo "Cart module created"
          
          # 运行代码审查
          npm run lint
          echo "Code review passed"
        `,
      },
    },
    // ... 其他必需字段
  };

  const devResult = await multiAgentSystem.executeTask(
    devTask,
    undefined,
    'developer'
  );

  console.log('开发完成:', devResult.output);

  // 第4步：编写和执行测试
  const testTask = {
    type: 'script',
    config: {
      script: {
        language: 'bash',
        script: 'npm run test',
      },
    },
    // ... 其他必需字段
  };

  const testResult = await multiAgentSystem.executeTask(
    testTask,
    undefined,
    'tester'
  );

  console.log('测试完成:', testResult.output);

  // 第5步：部署到测试环境
  const deployTask = {
    type: 'custom',
    config: {
      custom: {
        opsType: 'deploy',
        serviceName: 'cart-service',
        version: 'v1.0.0',
        environment: 'staging',
      },
    },
    // ... 其他必需字段
  };

  const deployResult = await multiAgentSystem.executeTask(
    deployTask,
    undefined,
    'operations'
  );

  console.log('部署完成:', deployResult.output);

  console.log('=== 功能开发完成 ===');
  console.log('性能统计:', multiAgentSystem.getSystemStatus().performance);
}

featureWorkflow().catch(console.error);
```

### 最佳实践 2：并行工作流

**最大化效率**：多个任务同时进行

```javascript
async function parallelWorkflow() {
  await multiAgentSystem.initialize();

  // 并行执行多个任务
  const tasks = [
    // 开发者Agent：开发API
    {
      id: 'api-1',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'echo "Developing API..." && sleep 2',
        },
      },
      createdBy: 'user',
    },

    // 测试者Agent：编写测试
    {
      id: 'test-1',
      type: 'custom',
      config: {
        custom: {
          function: `async function() {
            await new Promise(r => setTimeout(r, 2000));
            return { tests: 10, coverage: '85%' };
          }`,
        },
      },
      createdBy: 'user',
    },

    // 产品Agent：编写文档
    {
      id: 'doc-1',
      type: 'file',
      config: {
        file: {
          operation: 'write',
          path: 'README-new.md',
        },
      },
      createdBy: 'user',
    },

    // 运维Agent：准备部署配置
    {
      id: 'ops-1',
      type: 'custom',
      config: {
        custom: {
          opsType: 'deploy',
          serviceName: 'api-service',
          version: 'v1.0.0',
        },
      },
      createdBy: 'user',
    },
  ];

  // 并行执行 - 只需要2秒而不是8秒！
  const results = await multiAgentSystem.executeParallelTasks(tasks);

  console.log('=== 并行任务结果 ===');
  results.forEach((result, index) => {
    console.log(`\n任务 ${index + 1}:`);
    console.log('Success:', result.success);
    console.log('Duration:', result.duration + 'ms');
    console.log('Output:', result.output.substring(0, 100));
  });

  console.log('\n总耗时:', Math.max(...results.map(r => r.duration)) + 'ms');
}

parallelWorkflow().catch(console.error);
```

### 最佳实践 3：错误处理和重试

**健壮的工作流**：优雅处理失败

```javascript
async function robustWorkflow() {
  await multiAgentSystem.initialize();

  // 创建任务链，每个任务设置了 continueOnError
  const workflow = [
    {
      id: 'step-1',
      name: 'Step 1: Setup',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'echo "Setup complete"',
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user',
    },

    {
      id: 'step-2',
      name: 'Step 2: Build',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'echo "Building..." && sleep 1',
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user',
      metadata: { continueOnError: true }, // 失败后继续
    },

    {
      id: 'step-3',
      name: 'Step 3: Test',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'echo "Testing..." && sleep 1',
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user',
      metadata: { continueOnError: true },
    },

    {
      id: 'step-4',
      name: 'Step 4: Deploy',
      type: 'custom',
      config: {
        custom: {
          opsType: 'deploy',
          serviceName: 'my-app',
          version: 'v1.0.0',
        },
      },
      validation: { enabled: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'user',
      metadata: { continueOnError: true },
    },
  ];

  // 顺序执行 - 即使某个步骤失败，其他步骤继续执行
  const results = await multiAgentSystem.executeSequentialTasks(workflow);

  console.log('=== 工作流执行结果 ===');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    if (!result.success) {
      console.log(`   错误: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n成功率: ${successCount}/${results.length} (${(successCount / results.length * 100).toFixed(0)}%)`);
}

robustWorkflow().catch(console.error);
```

### 最佳实践 4：自动化日常任务

**CI/CD集成**：自动化日常重复工作

```javascript
async function dailyAutomation() {
  await multiAgentSystem.initialize();

  // 每日检查清单
  const dailyTasks = [
    {
      id: 'security-scan',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'npm audit',
        },
      },
      createdBy: 'automation',
    },

    {
      id: 'code-quality',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'npm run lint && npm run format:check',
        },
      },
      createdBy: 'automation',
    },

    {
      id: 'run-tests',
      type: 'script',
      config: {
        script: {
          language: 'bash',
          script: 'npm test',
        },
      },
      createdBy: 'automation',
    },

    {
      id: 'update-docs',
      type: 'file',
      config: {
        file: {
          operation: 'write',
          path: 'docs/status.md',
        },
        metadata: {
          requirements: 'Daily health check',
        },
      },
      createdBy: 'automation',
    },
  ];

  const results = await multiAgentSystem.executeParallelTasks(dailyTasks);

  // 生成日报
  const report = `
=== 日报 $(new Date().toISOString()) ===

检查项：
${results.map((r, i) => `${r.success ? '✅' : '❌'} ${dailyTasks[i].name}: ${r.success ? '通过' : r.error}`).join('\n')}

总耗时: ${Math.max(...results.map(r => r.duration))}ms
性能统计: ${JSON.stringify(multiAgentSystem.getSystemStatus().performance, null, 2)}
  `.trim();

  console.log(report);

  // 保存日报
  const fs = await import('fs/promises');
  await fs.writeFile(`daily-report-${Date.now()}.md`, report);
}

dailyAutomation().catch(console.error);
```

### 最佳实践 5：Agent协作

**Agent间通信**：共享信息和协作

```javascript
async function agentCollaboration() {
  await multiAgentSystem.initialize();

  // 场景：开发者需要测试者帮助验证bug修复

  // 1. 开发者修复bug
  const fixBugTask = {
    id: 'fix-1',
    type: 'script',
    config: {
      script: {
        language: 'bash',
        script: 'echo "Bug fixed in cart.js"',
      },
    },
    createdBy: 'developer',
  };

  const fixResult = await multiAgentSystem.executeTask(
    fixBugTask,
    undefined,
    'developer'
  );

  // 2. 通知测试者进行验证
  await multiAgentSystem.getOrchestrator().broadcastMessage({
    from: 'developer-agent-1',
    to: 'all',
    content: 'Bug #123 fixed in cart.js. Please verify.',
    timestamp: Date.now(),
    metadata: {
      bugId: '123',
      file: 'cart.js',
      changeLog: 'Fixed cart calculation error',
    },
  });

  console.log('已广播消息给所有Agent');

  // 3. 测试者执行验证
  const verifyTask = {
    id: 'verify-1',
    type: 'custom',
    config: {
      custom: {
        function: `async function({ bugId, file }) {
          console.log(\`Verifying bug \${bugId} in \${file}...\`);
          // 执行验证逻辑
          await new Promise(r => setTimeout(r, 1000));
          return { verified: true, testResults: 'All passed' };
        }`,
        parameters: {
          bugId: '123',
          file: 'cart.js',
        },
      },
    },
    createdBy: 'tester',
  };

  const verifyResult = await multiAgentSystem.executeTask(
    verifyTask,
    undefined,
    'tester'
  );

  console.log('验证结果:', verifyResult.output);

  // 4. 运维更新部署状态
  const deployTask = {
    id: 'deploy-1',
    type: 'custom',
    config: {
      custom: {
        opsType: 'deploy',
        serviceName: 'cart-service',
        version: 'v1.0.1',
        changelog: 'Bug fix #123',
      },
    },
    createdBy: 'operations',
  };

  const deployResult = await multiAgentSystem.executeTask(
    deployTask,
    undefined,
    'operations'
  );

  console.log('部署结果:', deployResult.output);
}

agentCollaboration().catch(console.error);
```

## 📋 可用工具

### CLI模式工具

- **bash**: 执行shell命令
  - 参数: `command` (string), `timeout` (number, optional)
  
- **read**: 读取文件内容
  - 参数: `file_path` (string), `offset` (number, optional), `limit` (number, optional)

- **grep**: 搜索文件内容
  - 参数: `pattern` (string), `path` (string, optional)

### MultiAgent系统工具

系统提供了4种专业Agent，每种Agent都有独特的工具集和能力。

**开发者Agent工具**：
- Bash脚本执行
- Node.js脚本执行
- 文件读写
- API调用

**测试Agent工具**：
- 测试脚本执行
- 自定义测试函数
- API端点测试
- 测试报告生成

**产品Agent工具**：
- 用户故事生成
- 验收标准定义
- 路线图规划
- 文档编写

**运维Agent工具**：
- 应用部署
- 系统监控
- 资源扩容
- 备份管理
- 配置文件生成

## 📁 项目结构

```
my_ai_agent/
├── src/                           # 源代码
│   ├── types.ts                   # 核心类型定义
│   ├── config.ts                  # 配置管理
│   ├── storage.ts                 # 会话持久化
│   ├── tool.ts                    # 工具系统核心
│   ├── tools/                     # 工具实现
│   │   ├── bash.ts
│   │   ├── read.ts
│   │   └── index.ts
│   ├── llm.ts                     # LLM交互层
│   ├── session.ts                 # 会话管理
│   ├── system-prompt.ts           # 系统提示词
│   ├── compression.ts             # 上下文压缩
│   ├── task-executor.ts          # 任务执行器
│   ├── agent-types.ts             # Agent类型定义
│   ├── agent-base.ts             # Agent基类
│   ├── agent-registry.ts         # Agent注册表
│   ├── agent-orchestrator.ts     # Agent协调器
│   ├── agents/                    # 具体Agent实现
│   │   ├── developer-agent.ts    # 开发者Agent
│   │   ├── tester-agent.ts       # 测试Agent
│   │   ├── product-agent.ts     # 产品Agent
│   │   ├── operations-agent.ts  # 运维Agent
│   │   └── index.ts
│   ├── multi-agent-system.ts      # MultiAgent系统
│   ├── web-types.ts              # Web应用类型
│   └── index.ts                  # CLI入口
│
├── tests/                         # 测试
│   ├── unit/                     # 单元测试
│   │   ├── agent-*.test.ts     # Agent测试
│   │   ├── task-executor.test.ts
│   │   └── ...
│   ├── integration/               # 集成测试
│   │   └── multi-agent-system.test.ts
│   ├── compression/               # 压缩测试
│   ├── performance/               # 性能测试
│   └── fixtures/                # 测试数据
│
├── web/                           # Web应用
│   ├── index.html
│   └── assets/
│
├── .github/workflows/             # GitHub Actions
│   ├── task-execution.yml
│   ├── deploy-pages.yml
│   └── ...
│
├── docs/                          # 详细文档
│   ├── types.md
│   ├── config.md
│   ├── storage.md
│   ├── tool.md
│   ├── llm.md
│   ├── session.md
│   ├── compression.md
│   └── ...
│
├── package.json                   # 项目配置
├── tsconfig.json                 # TypeScript配置
├── vitest.config.ts              # 测试配置
│
├── README.md                      # 本文件
├── ARCHITECTURE.md               # 架构文档
├── MULTIAGENT_SUMMARY.md          # MultiAgent总结
├── WEB_README.md                # Web应用文档
├── DEPLOYMENT_GUIDE.md          # 部署指南
├── PROJECT_SUMMARY.md            # 项目总结
└── EXTENSION.md                 # 扩展指南
```

## 📚 文档

### 核心模块文档
- [ARCHITECTURE.md](ARCHITECTURE.md) - 系统整体架构
- [MULTIAGENT_SUMMARY.md](MULTIAGENT_SUMMARY.md) - MultiAgent系统详细说明
- [WEB_README.md](WEB_README.md) - Web应用使用指南
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署完整指南

### CLI模式文档
- [docs/types.md](docs/types.md) - 核心类型定义
- [docs/config.md](docs/config.md) - 配置管理
- [docs/token.md](docs/token.md) - Token计算和上下文管理
- [docs/storage.md](docs/storage.md) - 会话持久化
- [docs/tool.md](docs/tool.md) - 工具系统
- [docs/llm.md](docs/llm.md) - LLM交互
- [docs/session.md](docs/session.md) - 会话管理
- [docs/compression.md](docs/compression.md) - 上下文压缩

### 工具文档
- [docs/tools-bash.md](docs/tools-bash.md) - Bash工具
- [docs/tools-read.md](docs/tools-read.md) - Read工具
- [EXTENSION.md](EXTENSION.md) - 如何添加新工具

### 测试文档
- [TEST_SYSTEM_SUMMARY.md](TEST_SYSTEM_SUMMARY.md) - 测试系统总结

## 🔧 扩展指南

### 添加新的Agent

1. 创建新Agent类，继承`BaseAgent`:

```typescript
import { BaseAgent } from './agent-base.js';
import { AgentConfig, AgentExecutionResult } from './agent-types.js';
import { Task } from './web-types.js';

export class MyAgent extends BaseAgent {
  constructor(config: Partial<AgentConfig> = {}) {
    const defaultConfig: AgentConfig = {
      id: 'agent-my-1',
      name: 'My Custom Agent',
      role: 'custom',
      description: 'A custom agent',
      systemPrompt: 'You are a custom agent',
      tools: ['bash', 'read'],
      capabilities: [
        { id: 'custom-cap', name: 'Custom Capability', description: 'Custom', enabled: true },
      ],
      priority: 'medium',
      maxConcurrentTasks: 3,
      timeout: 30000,
    };
    
    super({ ...defaultConfig, ...config } as AgentConfig);
  }

  async execute(task: Task): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.updateStatus('busy');

    try {
      // 实现你的逻辑
      const output = 'Task completed';
      
      return {
        success: true,
        output,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        agentId: this.id,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        agentId: this.id,
      };
    }
  }
}
```

2. 在`src/agents/index.ts`中导出：

```typescript
export { MyAgent } from './my-agent.js';
```

3. 在`src/multi-agent-system.ts`中注册：

```typescript
async registerCustomAgents(): Promise<void> {
  const myAgent = new MyAgent();
  this.registry.register(myAgent);
}
```

### 添加新的路由策略

```typescript
import { Agent, AgentRoutingStrategy } from './agent-types.js';
import { Task } from './web-types.js';

export class SkillBasedRouting implements AgentRoutingStrategy {
  selectAgent(agents: Agent[], task: Task): Agent | null {
    // 根据任务类型和Agent技能选择最合适的Agent
    // 这里实现你的自定义路由逻辑
    return agents[0] || null;
  }
}
```

使用：

```typescript
import { SkillBasedRouting } from './my-routing.js';

system.getOrchestrator().setRoutingStrategy(new SkillBasedRouting());
```

## 🧪 测试

运行测试：

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行性能测试
npm run test:performance

# 运行特定测试文件
npm run test:run -- tests/unit/agent-registry.test.ts

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 📊 性能

- **启动时间**: < 1秒
- **Agent数量**: 6个（默认配置）
- **并行任务**: 最多6个同时执行
- **任务吞吐量**: ~100-500任务/分钟（取决于任务复杂度）
- **内存占用**: < 100MB

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## ❓ 常见问题

### Q: MultiAgent系统和CLI聊天有什么区别？

**A**: 
- **CLI聊天**：适合交互式工作，可以随时向AI提问，AI会使用工具来执行命令、读取文件等
- **MultiAgent系统**：适合自动化工作流，可以指定特定的专业Agent（开发、测试、产品、运维）来执行特定类型的任务

两者可以配合使用！比如：
1. 用CLI聊天与AI讨论需求
2. 用MultiAgent系统执行完整的工作流
3. 再用CLI聊天讨论遇到的问题

### Q: 如何选择使用哪个Agent？

**A**: 系统会自动根据任务类型和Agent角色进行路由。你也可以手动指定：

```javascript
// 让系统自动选择
await system.executeTask(task);

// 指定角色
await system.executeTask(task, undefined, 'developer');

// 指定特定的Agent
await system.executeTask(task, 'agent-developer-1');
```

### Q: Agent可以并行工作吗？

**A**: 是的！每个Agent都有`maxConcurrentTasks`配置，可以同时处理多个任务：

```javascript
// 并行执行6个任务，分配给不同的Agent
const tasks = [task1, task2, task3, task4, task5, task6];
await system.executeParallelTasks(tasks);
```

### Q: 如何监控Agent的执行情况？

**A**: 系统提供了完整的监控接口：

```javascript
// 查看系统状态
const status = system.getSystemStatus();

console.log('可用的Agent:', status.registry.available);
console.log('忙碌的Agent:', status.registry.busy);
console.log('总任务数:', status.performance.totalTasks);
console.log('成功率:', status.performance.successRate + '%');

// 查看特定Agent的性能
const agentPerf = status.performance.agentPerformance['agent-developer-1'];
console.log('开发者Agent1完成任务数:', agentPerf.tasksCompleted);
console.log('开发者Agent1成功率:', agentPerf.successRate + '%');

// 查看执行历史
const history = system.getOrchestrator().getExecutionHistory();
history.forEach(exec => {
  console.log(`任务 ${exec.taskId} by ${exec.agentId}: ${exec.success ? '成功' : '失败'}`);
});
```

### Q: 如何添加自定义Agent？

**A**: 参考"扩展指南"部分，创建新的Agent类并继承`BaseAgent`。你只需要实现`execute()`方法，其他功能（状态管理、消息传递、性能跟踪）都由基类提供。

### Q: Agent之间如何通信？

**A**: 系统提供了消息通信机制：

```javascript
// 广播消息给所有Agent
await orchestrator.broadcastMessage({
  from: 'agent-developer-1',
  to: 'all',
  content: 'Task completed',
  timestamp: Date.now(),
});

// 点对点消息
await orchestrator.sendMessage(
  fromAgent,
  'agent-tester-1',
  'Please verify this fix',
  taskData
);
```

### Q: 如何处理任务执行失败？

**A**: 系统提供了多种错误处理方式：

```javascript
// 1. 顺序执行时可以继续执行后续任务
task.metadata = { continueOnError: true };
await system.executeSequentialTasks([task1, task2, task3]);

// 2. 并行执行时，单个失败不影响其他任务
await system.executeParallelTasks([task1, task2, task3]);

// 3. 检查执行结果并重试
const result = await system.executeTask(task);
if (!result.success) {
  console.log('任务失败:', result.error);
  // 实现重试逻辑
  await system.executeTask(task);
}
```

### Q: 性能如何？

**A**: 
- **并发能力**: 6个Agent可以同时工作
- **任务路由**: 毫秒级
- **状态同步**: 实时
- **内存占用**: < 100MB
- **适用场景**: 每天100-500个任务的中等规模项目

## 🔒 安全性

- ✅ 输入验证：所有Agent输入都经过验证
- ✅ 路径保护：文件操作有路径遍历保护
- ✅ 危险命令检测：bash工具会检测危险命令
- ✅ 超时保护：所有任务都有超时限制
- ✅ 错误隔离：单个Agent失败不影响其他Agent

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- GLM-4.7 模型提供支持
- Vercel AI SDK 提供工具支持
- Vitest 提供测试框架
- 所有贡献者

## 📞 联系方式

如有问题或建议，请：
1. 提交 [Issue](https://github.com/your-repo/issues)
2. 加入 [Discord](https://discord.gg/your-server)
3. 发送邮件到 support@example.com

---

**Made with ❤️ for 1-person companies**