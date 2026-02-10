# storage.ts - 持久化存储

## 概述

负责会话数据的持久化存储，使用 JSON 文件格式。

## 存储设计

### 为什么选择 JSON？

- **人类可读**：易于调试和手动编辑
- **无需数据库**：简化部署
- **版本控制友好**：可以 diff 查看变化
- **语言无关**：任何语言都能解析

### 目录结构

```
data/sessions/
├── abc123.json          # 会话1
├── def456.json          # 会话2
└── ghi789.json          # 会话3
```

### 文件格式

```json
{
  "id": "abc123",
  "title": "Test Session",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Hello",
      "timestamp": 1234567890
    }
  ],
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

## API 详解

### ensureDataDir(): Promise<void>

确保数据目录存在。

**逻辑：**
```typescript
try {
  await fs.mkdir(DATA_DIR, { recursive: true });
} catch (error) {
  // 目录已存在，忽略错误
}
```

**特点：**
- 使用 `recursive: true` 自动创建父目录
- 幂等操作：多次调用无副作用

### saveSession(session): Promise<void>

保存会话到文件。

**流程：**
1. 确保目录存在
2. 序列化为 JSON（带格式化）
3. 写入文件

**代码：**
```typescript
const filePath = path.join(DATA_DIR, `${session.id}.json`);
await fs.writeFile(
  filePath, 
  JSON.stringify(session, null, 2),  // 格式化缩进
  'utf-8'
);
```

**错误处理：**
- 磁盘满：抛出错误
- 权限不足：抛出错误

### loadSession(sessionId): Promise<Session | null>

加载会话数据。

**流程：**
1. 构建文件路径
2. 读取文件内容
3. 解析 JSON
4. 返回 Session 对象

**错误处理：**
```typescript
try {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
} catch (error) {
  // 文件不存在返回 null
  if (error.code === 'ENOENT') return null;
  // 其他错误抛出
  throw error;
}
```

**返回值：**
- 成功：Session 对象
- 文件不存在：`null`
- 其他错误：抛出异常

### listSessions(): Promise<Session[]>

列出所有会话。

**流程：**
1. 读取目录中的所有文件
2. 过滤 `.json` 文件
3. 并行读取所有文件
4. 按 `updatedAt` 降序排序

**性能：**
- 使用 `Promise.all` 并行读取
- 适合会话数量不多的场景（<100）
- 大量会话时需要分页或索引

**排序：**
```typescript
return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
// 最新的在前面
```

### deleteSession(sessionId): Promise<void>

删除会话文件。

**注意：**
- 文件不存在时静默处理
- 不会抛出错误

### generateId(): string

生成唯一 ID。

**实现：**
```typescript
return Date.now().toString(36) + Math.random().toString(36).substr(2);
// 示例: lxzr8p5x0.8f3k2m
```

**特点：**
- 基于时间戳：可排序
- 随机部分：避免冲突
- 无需外部依赖

## 使用场景

### 自动保存

```typescript
// 添加消息后自动保存
async addUserMessage(content: string) {
  this.session.messages.push(message);
  this.session.updatedAt = Date.now();
  await saveSession(this.session);  // 自动保存
}
```

### 会话恢复

```typescript
// 启动时加载历史会话
const sessions = await listSessions();
// 显示列表供用户选择
```

### 数据备份

```bash
# 备份所有会话
cp -r data/sessions backup/$(date +%Y%m%d)

# 导出单个会话
cat data/sessions/abc123.json
```

## 性能考虑

### 当前实现

- 每次保存都写入整个文件
- 适合：会话数据不大（<1MB）
- 不适合：超大会话（>10MB）

### 优化方案

1. **增量保存**
   ```typescript
   // 只追加新消息
   await fs.appendFile(file, newMessage);
   ```

2. **分片存储**
   ```
   data/sessions/
   ├── {id}/
   │   ├── meta.json      # 元数据
   │   └── messages/      # 消息分片
   │       ├── 001.json
   │       └── 002.json
   ```

3. **压缩**
   ```typescript
   const compressed = zlib.gzipSync(JSON.stringify(session));
   await fs.writeFile(file, compressed);
   ```

## 数据迁移

### 版本升级

```typescript
// 添加版本字段
interface Session {
  version: number;  // 新增
  // ... 其他字段
}

// 加载时检查版本
async function loadSession(id: string) {
  const session = await loadFromFile(id);
  if (session.version === 1) {
    // 迁移到 v2
    return migrateV1ToV2(session);
  }
  return session;
}
```

## 故障排除

### 问题：会话丢失

**原因：**
- 文件被删除
- 磁盘损坏

**解决：**
- 定期备份 `data/` 目录
- 使用 Git 版本控制（排除敏感信息）

### 问题：加载失败

**原因：**
- JSON 格式损坏
- 手动编辑出错

**解决：**
```bash
# 验证 JSON 格式
jsonlint data/sessions/abc123.json

# 或使用 jq
jq . data/sessions/abc123.json
```
