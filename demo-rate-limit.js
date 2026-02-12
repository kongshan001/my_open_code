import { multiAgentSystem } from './dist/multi-agent-system.js';
import { getGlobalRateLimiter, canExecuteLLMRequest, getLLMUsageStats } from './dist/rate-limiter.js';

/**
 * Rate Limit 使用示例
 * 演示如何控制API请求频率
 */

async function demoRateLimit() {
  console.log('=== Rate Limit 使用示例 ===\n');

  // 1. 初始化MultiAgent系统（会自动初始化rate limiter）
  await multiAgentSystem.initialize();

  // 2. 配置Rate Limit
  const rateLimiter = getGlobalRateLimiter({
    maxRequestsPerHour: 10,      // 每小时最多10个请求
    maxRequestsPerMinute: 3,       // 每分钟最多3个请求
    maxConcurrentRequests: 2,     // 最多2个并发请求
  });

  console.log('Rate Limit配置:');
  console.log('  - 每小时上限:', rateLimiter['config'].maxRequestsPerHour);
  console.log('  - 每分钟上限:', rateLimiter['config'].maxRequestsPerMinute);
  console.log('  - 并发上限:', rateLimiter['config'].maxConcurrentRequests);

  // 3. 检查是否可以执行请求
  console.log('\n=== 检查请求配额 ===');
  const check = canExecuteLLMRequest({
    maxRequestsPerHour: 10,
  });

  if (check.canExecute) {
    console.log('✅ 可以立即执行请求');
  } else {
    console.log('❌ 请求受限:', check.reason);
    console.log('⏰ 需要等待:', Math.ceil((check.waitTime || 0) / 1000), '秒');
  }

  // 4. 查看当前使用统计
  console.log('\n=== API使用统计 ===');
  const stats = getLLMUsageStats();
  console.log('总请求数:', stats.totalRequests);
  console.log('已处理:', stats.processedRequests);
  console.log('已拒绝:', stats.rejectedRequests);
  console.log('队列中:', stats.queueSize);
  console.log('成功率:', stats.successRate);
  console.log('本小时请求:', stats.requestsThisHour);
  console.log('本分钟请求:', stats.requestsThisMinute);
  console.log('下小时重置:', new Date(stats.resetTime).toLocaleTimeString());
  console.log('下分钟重置:', new Date(stats.minuteResetTime).toLocaleTimeString());

  // 5. 演示请求限制
  console.log('\n=== 演示请求限制 ===');
  
  // 快速执行多个任务，观察限流效果
  const tasks = [
    { id: 'task-1', name: 'Task 1', description: 'Demo task 1', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Task 1"' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'task-2', name: 'Task 2', description: 'Demo task 2', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Task 2"' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'task-3', name: 'Task 3', description: 'Demo task 3', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Task 3"' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'task-4', name: 'Task 4', description: 'Demo task 4', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Task 4"' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'task-5', name: 'Task 5', description: 'Demo task 5', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Task 5"' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
  ];

  console.log('开始执行5个任务（注意观察限流效果）...\n');

  // 并行执行
  const startTime = Date.now();
  const results = await multiAgentSystem.executeParallelTasks(tasks);
  const duration = Date.now() - startTime;

  console.log('\n执行完成:');
  console.log('总耗时:', duration, 'ms');
  console.log('成功:', results.filter(r => r.success).length);
  console.log('失败:', results.filter(r => !r.success).length);

  // 6. 查看最终统计
  console.log('\n=== 最终统计 ===');
  const finalStats = getLLMUsageStats();
  console.log('总请求数:', finalStats.totalRequests);
  console.log('队列大小:', finalStats.queueSize);

  if (finalStats.queueSize > 0) {
    console.log('⚠️  注意：有', finalStats.queueSize, '个请求在队列中等待');
    console.log('提示：可以调用 processQueue() 来处理队列');
  }

  // 7. 演示队列处理
  if (finalStats.queueSize > 0) {
    console.log('\n=== 处理队列 ===');
    const processed = rateLimiter.processQueue();
    console.log('已处理:', processed, '个队列请求');

    // 再次查看统计
    const statsAfterProcess = getLLMUsageStats();
    console.log('队列剩余:', statsAfterProcess.queueSize);
  }

  // 8. 演示等待重置
  if (!canExecuteLLMRequest().canExecute) {
    console.log('\n=== 等待重置 ===');
    const check = canExecuteLLMRequest();
    console.log('当前限制:', check.reason);
    console.log('等待时间:', Math.ceil((check.waitTime || 0) / 1000), '秒');
    console.log('重置时间:', new Date(check.resetTime || 0).toLocaleString());
  }

  // 9. 演示配置更新
  console.log('\n=== 动态配置更新 ===');
  
  const beforeUpdate = getLLMUsageStats();
  console.log('更新前 - 每小时上限:', beforeUpdate.hourlyLimit);
  
  rateLimiter.updateConfig({ maxRequestsPerHour: 50 });
  
  const afterUpdate = getLLMUsageStats();
  console.log('更新后 - 每小时上限:', afterUpdate.hourlyLimit);

  // 10. 启动队列处理器
  console.log('\n=== 启动队列处理器 ===');
  console.log('队列处理器将每1秒检查并处理队列中的请求');
  
  const stopProcessor = rateLimiter.startQueueProcessor(1000);

  // 5秒后停止处理器（实际应用中可能一直运行）
  setTimeout(() => {
    stopProcessor();
    console.log('队列处理器已停止');
  }, 5000);

  // 等待处理器运行几次
  await new Promise(resolve => setTimeout(resolve, 6000));

  console.log('\n=== Rate Limit 示例完成 ===');
  console.log('提示：在生产环境中，建议：');
  console.log('1. 根据API配额设置合理的限制');
  console.log('2. 使用队列处理器自动处理排队请求');
  console.log('3. 监控使用统计，及时调整配置');
  console.log('4. 对重要任务使用高优先级');
}

async function demoPriorityBasedExecution() {
  console.log('=== 基于优先级的任务执行 ===\n');

  await multiAgentSystem.initialize();

  const rateLimiter = getGlobalRateLimiter({
    maxRequestsPerHour: 5,
    maxRequestsPerMinute: 2,
    maxConcurrentRequests: 1, // 限制并发以更好地观察效果
  });

  // 创建不同优先级的任务
  const highPriorityTask = {
    id: 'high-1',
    name: 'High Priority - Critical Bug Fix',
    description: 'Fix critical bug in production',
    type: 'script' as any,
    config: { script: { language: 'bash', script: 'echo "Fixing critical bug..."' } },
    validation: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'demo',
    metadata: { priority: 'high' },
  };

  const mediumPriorityTask = {
    id: 'medium-1',
    name: 'Medium Priority - Feature Implementation',
    description: 'Implement new feature',
    type: 'script' as any,
    config: { script: { language: 'bash', script: 'echo "Implementing feature..."' } },
    validation: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'demo',
    metadata: { priority: 'medium' },
  };

  const lowPriorityTask = {
    id: 'low-1',
    name: 'Low Priority - Documentation Update',
    description: 'Update documentation',
    type: 'script' as any,
    config: { script: { language: 'bash', script: 'echo "Updating docs..."' } },
    validation: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'demo',
    metadata: { priority: 'low' },
  };

  console.log('任务1（高优先级）:', highPriorityTask.name);
  console.log('任务2（中优先级）:', mediumPriorityTask.name);
  console.log('任务3（低优先级）:', lowPriorityTask.name);
  console.log();

  // 检查配额
  const check = canExecuteLLMRequest();
  console.log('配额检查:', check.canExecute ? '✅ 可用' : '❌ 有限制');

  // 顺序执行（观察优先级效果）
  const results = [];
  
  // 高优先级任务
  const r1 = await multiAgentSystem.executeTask(highPriorityTask);
  results.push(r1);
  console.log('任务1完成:', r1.success ? '✅' : '❌');

  // 中优先级任务
  const r2 = await multiAgentSystem.executeTask(mediumPriorityTask);
  results.push(r2);
  console.log('任务2完成:', r2.success ? '✅' : '❌');

  // 低优先级任务
  const r3 = await multiAgentSystem.executeTask(lowPriorityTask);
  results.push(r3);
  console.log('任务3完成:', r3.success ? '✅' : '❌');

  console.log('\n执行结果:');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.success ? '✅' : '❌'} ${r.output?.substring(0, 50)}`);
  });

  console.log('\n最终统计:');
  const stats = getLLMUsageStats();
  console.log('  总请求数:', stats.totalRequests);
  console.log('  成功率:', stats.successRate);
  console.log('  队列大小:', stats.queueSize);
}

async function demoCostControl() {
  console.log('\n=== 成本控制示例 ===\n');

  await multiAgentSystem.initialize();

  // 设置较低的配额来模拟有限配额场景
  const rateLimiter = getGlobalRateLimiter({
    maxRequestsPerHour: 5,      // 每小时5个请求
    maxRequestsPerMinute: 1,       // 每分钟1个请求（严格限制）
    maxConcurrentRequests: 1,     // 单线程
  });

  console.log('严格配额模式:');
  console.log('  - 每小时:', rateLimiter['config'].maxRequestsPerHour, '次');
  console.log('  - 每分钟:', rateLimiter['config'].maxRequestsPerMinute, '次');
  console.log('  - 并发:', rateLimiter['config'].maxConcurrentRequests, '个');

  const tasks = [
    { id: 'cost-1', name: 'Analyze requirements', type: 'custom' as any, config: { custom: { taskType: 'user-story', title: 'Feature A', role: 'user', want: 'to use', benefit: 'benefit' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'cost-2', name: 'Write code', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Writing code..."' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'cost-3', name: 'Write tests', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Writing tests..."' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'cost-4', name: 'Run tests', type: 'script' as any, config: { script: { language: 'bash', script: 'echo "Running tests..."' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'cost-5', name: 'Deploy', type: 'custom' as any, config: { custom: { opsType: 'deploy', serviceName: 'app', version: 'v1.0' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
    { id: 'cost-6', name: 'Monitor', type: 'custom' as any, config: { custom: { opsType: 'monitor', serviceId: 'service-1' } }, validation: { enabled: false }, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'demo' },
  ];

  console.log('\n尝试执行6个任务（受严格配额限制）...\n');

  const startTime = Date.now();
  
  // 顺序执行，观察限流效果
  for (let i = 0; i < tasks.length; i++) {
    console.log(`\n[任务 ${i + 1}/${tasks.length}] ${tasks[i].name}`);
    
    // 检查配额
    const check = canExecuteLLMRequest();
    console.log('  配额:', check.canExecute ? '✅' : '❌');
    
    if (!check.canExecute && check.waitTime) {
      console.log('  等待:', Math.ceil(check.waitTime / 1000), '秒');
    }
    
    const result = await multiAgentSystem.executeTask(tasks[i] as any);
    console.log('  结果:', result.success ? '✅' : '❌');
    
    // 查看统计
    const stats = getLLMUsageStats();
    console.log('  已用:', stats.requestsThisHour, '/', stats.hourlyLimit, '本小时');
    console.log('  队列:', stats.queueSize, '个');
  }

  const duration = Date.now() - startTime;
  
  console.log('\n=== 执行完成 ===');
  console.log('总耗时:', duration, 'ms');
  console.log('平均每个任务:', Math.round(duration / tasks.length), 'ms');

  const finalStats = getLLMUsageStats();
  console.log('\n最终统计:');
  console.log('  成功:', finalStats.processedRequests - finalStats.rejectedRequests, '/', finalStats.totalRequests);
  console.log('  队列:', finalStats.queueSize, '个');
  console.log('  成本节省:', finalStats.queuedRequests, '个请求被排队/拒绝');
}

// 运行所有示例
async function runAllDemos() {
  console.log('🚀 Rate Limit 功能演示\n');
  
  try {
    await demoRateLimit();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoPriorityBasedExecution();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await demoCostControl();
  } catch (error) {
    console.error('Demo执行出错:', error);
  }
  
  console.log('\n✅ 所有演示完成！');
}

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllDemos().catch(console.error);
}

export { demoRateLimit, demoPriorityBasedExecution, demoCostControl };