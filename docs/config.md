# config.ts - 配置管理

**← [返回文档索引](README.md)** | **[返回主文档](../README.md)**
## 概述

负责加载和管理应用配置，支持从环境变量读取设置。

## 核心功能

### 1. 环境变量加载

使用 `dotenv` 库自动加载 `.env` 文件：

```typescript
import { config } from 'dotenv';
config(); // 加载 .env 文件
```

### 2. 配置验证

确保必需的配置项存在：

```typescript
if (!apiKey) {
  throw new Error('GLM_API_KEY not found. Please set it in .env file');
}
```

## API 详解

### loadConfig(): Config

加载并返回配置对象。

**流程：**
1. 调用 `dotenv.config()` 加载环境变量
2. 读取各个配置项
3. 验证必需项
4. 返回 Config 对象

**配置项：**

| 环境变量 | 类型 | 必需 | 默认值 | 说明 |
|---------|------|------|--------|------|
| GLM_API_KEY | string | ✅ | - | API 认证密钥 |
| GLM_BASE_URL | string | ❌ | https://open.bigmodel.cn/api/coding/paas/v4 | API 端点 |
| GLM_MODEL | string | ❌ | glm-4.7 | 模型名称 |

**返回值：**

```typescript
{
  apiKey: string,      // API密钥
  baseUrl: string,     // API端点
  model: string,       // 模型名
  workingDir: string   // 当前工作目录
}
```

**错误处理：**

```typescript
try {
  const config = loadConfig();
} catch (error) {
  if (error.message.includes('GLM_API_KEY')) {
    console.log('请创建 .env 文件并设置 GLM_API_KEY');
  }
}
```

### getConfig(): Config

`loadConfig` 的别名，提供语义化的函数名。

## 配置文件示例

### .env

```bash
# GLM API Configuration
GLM_API_KEY=sk-your-api-key-here
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
GLM_MODEL=glm-4.7
```

### .env.example

提供给用户的模板文件：

```bash
# GLM API Configuration
GLM_API_KEY=your-api-key-here
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
GLM_MODEL=glm-4.7
```

## 安全注意事项

1. **不要将 .env 提交到 Git**
   - 已在 `.gitignore` 中排除
   - 包含敏感信息（API Key）

2. **使用环境变量覆盖**
   - 命令行设置的环境变量优先级高于 .env 文件
   - 适用于 CI/CD 环境

3. **验证 API Key**
   - 启动时验证必需项
   - 提供清晰的错误信息

## 扩展配置

### 添加新配置项

```typescript
export function loadConfig(): Config {
  // ... 现有配置
  
  const newOption = process.env.NEW_OPTION || 'default';
  
  return {
    // ... 现有字段
    newOption,
  };
}

// 更新 Config 接口
export interface Config {
  // ... 现有字段
  newOption: string;
}
```

### 配置分组

如果配置项很多，可以分组：

```typescript
interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AppConfig {
  workingDir: string;
  maxHistory: number;
}

type Config = LLMConfig & AppConfig;
```

## 测试

### 模拟配置

```typescript
// 测试时提供模拟配置
const mockConfig: Config = {
  apiKey: 'test-key',
  baseUrl: 'https://test.api.com',
  model: 'test-model',
  workingDir: '/tmp/test'
};
```

## 故障排除

### 问题：配置未加载

**原因：**
- .env 文件不存在
- 文件路径错误

**解决：**
```bash
cp .env.example .env
# 编辑 .env 填入配置
```

### 问题：环境变量未生效

**原因：**
- 修改 .env 后未重启应用
- 变量名拼写错误

**解决：**
- 重启应用
- 检查变量名大小写
