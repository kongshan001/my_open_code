# API Rate Limit 控制功能

## 概述

Rate Limit系统提供强大的API请求频率控制功能，帮助您：
- 控制API调用成本
- 防止超出API配额
- 优雅处理请求超限
- 实现智能请求队列
- 监控使用统计

## 功能特性

### 1. 多层限流控制

- **每小时限制**: 控制每小时的API调用次数
- **每分钟限制**: 控制每分钟的API调用次数
- **并发限制**: 控制同时进行的请求数量

### 2. 智能请求队列

- 自动排队超出限制的请求
- 按优先级处理请求（高/中/低）
- FIFO队列保证公平性

### 3. 完整的监控统计

- 总请求数
- 已处理请求
- 已拒绝请求
- 队列大小
- 成功率统计
- 重置时间提醒

## 配置

### 环境变量配置

在`.env`文件中添加：

```env
# Rate Limit 配置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_PER_HOUR=100
RATE_LIMIT_MAX_PER_MINUTE=10
RATE_LIMIT_MAX_CONCURRENT=5
RATE_LIMIT_QUEUE_INTERVAL=1000
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|---------|------|
| `RATE_LIMIT_ENABLED` | `true` | 是否启用限流控制 |
| `RATE_LIMIT_MAX_PER_HOUR` | `100` | 每小时最大请求数 |
| `RATE_LIMIT_MAX_PER_MINUTE` | `10` | 每分钟最大请求数 |
| `RATE_LIMIT_MAX_CONCURRENT` | `5` | 最大并发请求数 |
| `RATE_LIMIT_QUEUE_INTERVAL` | `1000` | 队列处理间隔（毫秒） |

## 使用方法

### 1. 基本使用

```javascript
import { getGlobalRateLimiter } from './dist/rate-limiter.js';

// 获取全局rate limiter实例
const rateLimiter = getGlobalRateLimiter({
  maxRequestsPerHour: 50,    // 每小时50次
  maxRequestsPerMinute: 5,     // 每分钟5次
  maxConcurrentRequests: 2,    // 最多2个并发
});

// 执行API请求
await rateLimiter.executeRequest(
  async () => {
    const result = await callLLMAPI();
    return result;
  }
);
```

### 2. 检查请求配额

```javascript
import { canExecuteLLMRequest } from './dist/rate-limiter.js';

// 检查是否可以执行请求
const check = canExecuteLLMRequest({
  maxRequestsPerHour: 100,
});

if (check.canExecute) {
  // 可以立即执行
  console.log('✅ 可以执行请求');
} else {
  // 请求受限，需要等待
  console.log('❌ 请求受限:', check.reason);
  console.log('⏰ 需要等待:', Math.ceil((check.waitTime || 0) / 1000), '秒');
  console.log('🕐 重置时间:', new Date(check.resetTime || 0).toLocaleTimeString());
}
```

### 3. 查看使用统计

```javascript
import { getLLMUsageStats } from './dist/rate-limiter.js';

// 获取使用统计
const stats = getLLMUsageStats();

console.log('=== API使用统计 ===');
console.log('总请求数:', stats.totalRequests);
console.log('已处理:', stats.processedRequests);
console.log('已拒绝:', stats.rejectedRequests);
console.log('队列中:', stats.queueSize);
console.log('成功率:', stats.successRate);
console.log('本小时使用:', stats.requestsThisHour, '/', stats.hourlyLimit);
console.log('本分钟使用:', stats.requestsThisMinute, '/', stats.minuteLimit);
console.log('下小时重置:', new Date(stats.resetTime).toLocaleString());
console.log('下分钟重置:', new Date(stats.minuteResetTime).toLocaleString());
```

### 4. 动态调整配置

```javascript
// 更新配置
rateLimiter.updateConfig({
  maxRequestsPerHour: 200,  // 增加每小时配额
  maxRequestsPerMinute: 20,  // 增加每分钟配额
});
```

### 5. 启动队列处理器

```javascript
// 启动队列处理器（自动处理排队请求）
const stopProcessor = rateLimiter.startQueueProcessor(1000);

// 当不再需要时停止处理器
setTimeout(() => {
  stopProcessor();
  console.log('队列处理器已停止');
}, 60000); // 60秒后停止
```

### 6. 优先级请求

```javascript
// 高优先级请求（紧急任务）
await rateLimiter.executeRequest(
  async () => callLLMAPI(),
  { priority: 'high' }
);

// 中优先级请求（普通任务）
await rateLimiter.executeRequest(
  async () => callLLMAPI(),
  { priority: 'medium' }
);

// 低优先级请求（后台任务）
await rateLimiter.executeRequest(
  async () => callLLMAPI(),
  { priority: 'low' }
);
```

### 7. 超时处理

```javascript
// 设置超时时间（默认2分钟）
await rateLimiter.executeRequest(
  async () => callLLMAPI(),
  { timeout: 30000 }  // 30秒超时
);

try {
  const result = await rateLimiter.executeRequest(fn, { timeout: 30000 });
  console.log('请求成功:', result);
} catch (error) {
  if (error.message === 'Request timeout') {
    console.log('请求超时，已自动取消');
    // 可以选择重试或使用其他策略
  }
}
```

## MultiAgent集成使用

Rate Limit已集成到LLM调用和MultiAgent系统中，自动生效。

### 配置示例

在`.env`中设置合适的限制：

```env
# 根据GLM API配额设置
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_PER_HOUR=50        # 每小时50次（免费配额）
RATE_LIMIT_MAX_PER_MINUTE=10        # 每分钟10次
RATE_LIMIT_MAX_CONCURRENT=3         # 最多3个并发请求
RATE_LIMIT_QUEUE_INTERVAL=1000        # 每秒检查队列
```

### Agent任务中的自动限流

```javascript
// 所有Agent的任务都会自动受到Rate Limit限制
// 无需额外配置，自动生效

const result = await multiAgentSystem.executeTask(task);
// 系统会自动：
// 1. 检查API配额
// 2. 如超出限制，排队等待
// 3. 配额可用时自动执行
```

### 不同Agent的优先级

```javascript
// 高优先级任务（紧急bug修复）
const urgentTask = {
  id: 'urgent-1',
  name: 'Critical Bug Fix',
  type: 'script',
  config: { script: { language: 'bash', script: 'echo "Fixing bug..."' } },
  // ... 其他字段
  metadata: { priority: 'high' },
};

// 普通优先级任务（常规开发）
const normalTask = {
  id: 'normal-1',
  name: 'Feature Implementation',
  type: 'script',
  config: { script: { language: 'bash', script: 'echo "Developing..."' } },
  // ... 其他字段
  metadata: { priority: 'medium' },
};

// 低优先级任务（文档更新）
const lowPriorityTask = {
  id: 'low-1',
  name: 'Update Documentation',
  type: 'script',
  config: { script: { language: 'bash', script: 'echo "Updating..."' } },
  // ... 其他字段
  metadata: { priority: 'low' },
};
```

## 最佳实践

### 1. 成本控制

根据API配额设置合理的限制：

```javascript
// 免费配额场景（假设每小时50次免费额度）
getGlobalRateLimiter({
  maxRequestsPerHour: 45,      // 留5次作为buffer
  maxRequestsPerMinute: 8,       // 留2次作为buffer
  maxConcurrentRequests: 1,     // 单线程，避免超限
});

// 付费配额场景（假设每小时1000次）
getGlobalRateLimiter({
  maxRequestsPerHour: 950,     // 留50次作为buffer
  maxRequestsPerMinute: 100,     // 留20次作为buffer
  maxConcurrentRequests: 5,     // 可接受更多并发
});
```

### 2. 任务优先级策略

为不同类型的任务设置合适的优先级：

```javascript
// 生产环境问题 - 最高优先级
const productionIssues = {
  metadata: { priority: 'high' },
};

// 用户报告的bug - 高优先级
const userBugs = {
  metadata: { priority: 'high' },
};

// 新功能开发 - 中优先级
const newFeatures = {
  metadata: { priority: 'medium' },
};

// 测试和文档 - 低优先级
const testingAndDocs = {
  metadata: { priority: 'low' },
};
```

### 3. 批量任务处理

处理大量任务时，考虑分批执行：

```javascript
const allTasks = [...]; // 100个任务

// 分批处理，每批10个
const batchSize = 10;
const batches = [];
for (let i = 0; i < allTasks.length; i += batchSize) {
  batches.push(allTasks.slice(i, i + batchSize));
}

for (const batch of batches) {
  console.log(`处理批次 ${(batch.length / batchSize)} / batches.length}`);
  
  await multiAgentSystem.executeParallelTasks(batch);
  
  // 等待一下再处理下一批
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### 4. 监控和告警

定期检查使用情况：

```javascript
import { getLLMUsageStats } from './dist/rate-limiter.js';

setInterval(() => {
  const stats = getLLMUsageStats();
  
  console.log('=== API使用监控 ===');
  console.log('已使用:', stats.requestsThisHour, '/', stats.hourlyLimit);
  
  // 使用率超过80%时发出警告
  const usageRate = stats.requestsThisHour / stats.hourlyLimit * 100;
  
  if (usageRate > 80) {
    console.log('⚠️ 警告：API使用率已达到', usageRate.toFixed(1) + '%');
    console.log('建议：降低并发数或减少批量任务');
  }
  
  // 队列积压警告
  if (stats.queueSize > 10) {
    console.log('⚠️ 警告：队列中有', stats.queueSize, '个请求等待处理');
  }
  
}, 60000); // 每分钟检查一次
```

### 5. 优雅降级

当配额耗尽时，提供替代方案：

```javascript
import { canExecuteLLMRequest } from './dist/rate-limiter.js';

async function smartTaskExecution(task) {
  const check = canExecuteLLMRequest();
  
  if (check.canExecute) {
    // API可用，正常执行
    return await multiAgentSystem.executeTask(task);
  } else {
    console.log('⚠️ API配额受限，使用缓存或降级策略');
    console.log('等待时间:', Math.ceil((check.waitTime || 0) / 1000), '秒');
    
    // 降级策略：使用更简单的Agent或本地执行
    return {
      success: false,
      output: 'Task queued due to rate limit',
      error: 'API quota exceeded',
    };
  }
}
```

## 性能调优

### 减少API调用

1. **优化Prompt**: 更精确的prompt减少不必要的API调用
2. **上下文压缩**: 启用压缩功能减少token使用
3. **结果缓存**: 缓存常用查询的结果

### 提高并发效率

```javascript
// 根据任务特点调整并发数
const highValueTasks = {
  metadata: { priority: 'high' },
};

const lowValueTasks = {
  metadata: { priority: 'low' },
};

// 高价值任务可以接受更高延迟，降低并发
const limiter = getGlobalRateLimiter({
  maxConcurrentRequests: 2,  // 降低并发
});

// 低价值任务可以更快完成，提高并发
const limiter2 = getGlobalRateLimiter({
  maxConcurrentRequests: 5,  // 提高并发
});
```

### 队列优化

```javascript
// 启动更频繁的队列处理器
const stopProcessor = rateLimiter.startQueueProcessor(500); // 0.5秒检查一次

// 或者根据负载动态调整
const adaptiveInterval = () => {
  const stats = getLLMUsageStats();
  const queueSize = stats.queueSize;
  
  // 队列越大，处理越频繁
  const interval = Math.max(100, 5000 / (queueSize + 1));
  
  return interval;
};

const stopAdaptive = rateLimiter.startQueueProcessor(adaptiveInterval());
```

## 故障排除

### 问题：请求一直被拒绝

**原因**: 配置过于严格

**解决方案**:
```javascript
// 放宽限制
rateLimiter.updateConfig({
  maxRequestsPerHour: 200,
  maxRequestsPerMinute: 20,
});
```

### 问题：队列积压严重

**原因**: 请求速度超过处理能力

**解决方案**:
```javascript
// 1. 减少批量任务大小
const batchSize = 5; // 从10减少到5

// 2. 提高队列处理频率
const stopProcessor = rateLimiter.startQueueProcessor(500); // 每0.5秒

// 3. 增加并发数
rateLimiter.updateConfig({
  maxConcurrentRequests: 8, // 从5增加到8
});
```

### 问题：成本超出预期

**原因**: 限制设置过高或缺少限制

**解决方案**:
```javascript
// 1. 设置更严格的限制
rateLimiter.updateConfig({
  maxRequestsPerHour: 50,      // 从100降低到50
  maxRequestsPerMinute: 5,       // 从10降低到5
});

// 2. 监控成本
setInterval(() => {
  const stats = getLLMUsageStats();
  console.log('成本监控:', stats.requestsThisHour, '次/小时');
  
  const estimatedCost = stats.requestsThisHour * 0.001; // 假设每次$0.001
  console.log('预估成本: $' + estimatedCost.toFixed(2));
}, 3600000); // 每小时检查
```

## 与MultiAgent的协同

Rate Limit系统已完全集成到MultiAgent系统中，提供：

### 1. 自动限流

所有Agent的任务执行都会自动经过Rate Limit检查，无需手动配置。

### 2. Agent优先级

不同Agent可以有不同的默认优先级：

```javascript
// 开发者Agent - 默认高优先级
DeveloperAgent执行时自动使用 'medium' 优先级

// 可以在任务中设置优先级
const task = {
  metadata: { priority: 'high' },
};

const result = await multiAgentSystem.executeTask(task);
// 系统会自动使用高优先级
```

### 3. 统计汇总

```javascript
// 查看整体API使用情况
const stats = getLLMUsageStats();
const systemStats = multiAgentSystem.getSystemStatus().performance;

console.log('=== 多Agent系统 + Rate Limit 统计 ===');
console.log('API调用:', stats.totalRequests);
console.log('Agent任务:', systemStats.totalTasks);
console.log('每个任务平均API调用:', (stats.totalRequests / systemStats.totalTasks).toFixed(2));
console.log('成功率:', stats.successRate);
```

## 监控和告警

建议实现以下监控和告警机制：

### 1. 使用率监控

```javascript
// 每小时检查使用率
const monitorHourlyUsage = () => {
  const stats = getLLMUsageStats();
  const usageRate = stats.requestsThisHour / stats.hourlyLimit * 100;
  
  if (usageRate > 90) {
    console.error('🚨 严重告警：API使用率达到', usageRate.toFixed(1) + '%');
    // 发送通知（邮件/Slack等）
  } else if (usageRate > 75) {
    console.warn('⚠️ 警告：API使用率达到', usageRate.toFixed(1) + '%');
  }
  
  // 记录到文件
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestsThisHour: stats.requestsThisHour,
    hourlyLimit: stats.hourlyLimit,
    usageRate: usageRate,
  };
  
  const fs = await import('fs/promises');
  await fs.appendFile('api-usage.log', JSON.stringify(logEntry) + '\n');
};

setInterval(monitorHourlyUsage, 60000 * 60); // 每小时
```

### 2. 队列监控

```javascript
const monitorQueue = () => {
  const stats = getLLMUsageStats();
  
  if (stats.queueSize > 20) {
    console.warn('⚠️ 队列积压:', stats.queueSize, '个请求');
    console.log('建议：1. 降低并发数 2. 增加处理频率 3. 优先处理高优先级');
  } else if (stats.queueSize > 50) {
    console.error('🚨 严重积压:', stats.queueSize, '个请求');
    console.log('建议：暂停新任务，优先处理队列');
  }
};

setInterval(monitorQueue, 60000); // 每分钟
```

## 高级功能

### 1. 动态限流

根据系统负载动态调整限制：

```javascript
class DynamicRateLimiter {
  adjustRateLimit() {
    const stats = getLLMUsageStats();
    const queueSize = stats.queueSize;
    
    // 队列越大，限制越严格
    if (queueSize > 50) {
      // 严格模式
      this.updateConfig({
        maxRequestsPerMinute: 5,
        maxConcurrentRequests: 1,
      });
    } else if (queueSize > 20) {
      // 中等模式
      this.updateConfig({
        maxRequestsPerMinute: 10,
        maxConcurrentRequests: 2,
      });
    } else {
      // 宽松模式
      this.updateConfig({
        maxRequestsPerMinute: 20,
        maxConcurrentTasks: 5,
      });
    }
  }
}
```

### 2. 预测性限流

基于使用模式预测并提前限流：

```javascript
class PredictiveRateLimiter {
  private hourlyRequestHistory: number[] = [];
  
  shouldLimitRequest() {
    const now = Date.now();
    const currentHour = Math.floor(now / 3600000);
    
    // 添加当前小时请求
    this.hourlyRequestHistory.push({
      hour: currentHour,
      count: this.hourlyRequestHistory.filter(h => h.hour === currentHour).length,
    });
    
    // 分析最近24小时的使用模式
    const recent24Hours = this.hourlyRequestHistory.slice(-24);
    const avgUsage = recent24Hours.reduce((sum, h) => sum + h.count, 0) / recent24Hours.length;
    
    // 预测下一小时使用
    if (avgUsage > this.config.maxRequestsPerHour * 0.8) {
      // 预计会超限，提前限流
      return {
        canExecute: false,
        reason: 'Predicted limit approaching',
        suggestPriority: 'high',
      };
    }
    
    return { canExecute: true };
  }
}
```

## 总结

Rate Limit系统提供了完整的API请求控制功能，帮助您：

✅ **成本控制** - 防止超出API配额
✅ **性能优化** - 通过合理的并发和队列管理提高效率
✅ **稳定性** - 避免被API提供商限流
✅ **可观测性** - 完整的监控和统计
✅ **灵活性** - 支持动态调整和优先级控制
✅ **集成性** - 与MultiAgent系统无缝集成

通过合理配置和最佳实践，可以有效管理API使用，降低成本，提高系统稳定性！