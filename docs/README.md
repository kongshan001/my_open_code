# Hello World OpenCode - 模块文档

本文档目录包含每个 TypeScript 模块的详细介绍。

**← [返回主文档](../README.md)**

## 📚 文档列表

### 核心模块

| 文档 | 模块 | 说明 |
|------|------|------|
| [types.md](types.md) | types.ts | 核心类型定义（Message, Tool, Session 等） |
| [config.md](config.md) | config.ts | 配置管理（环境变量加载） |
| [token.md](token.md) | token.ts | Token 计算和上下文管理 |
| [storage.md](storage.md) | storage.ts | 持久化存储（JSON 文件） |
| [tool.md](tool.md) | tool.ts | 工具系统核心（注册、执行） |
| [llm.md](llm.md) | llm.ts | LLM 交互层（流式响应） |
| [session.md](session.md) | session.ts | 会话管理（消息处理） |
| [index.md](index.md) | index.ts | CLI 入口和用户交互 |

### 工具模块

| 文档 | 模块 | 说明 |
|------|------|------|
| [tools-bash.md](tools-bash.md) | tools/bash.ts | Bash 命令执行工具 |
| [tools-read.md](tools-read.md) | tools/read.ts | 文件读取工具 |

## 🎯 快速导航

### 想了解类型系统？
→ 阅读 [types.md](types.md)

### 想添加新工具？
→ 阅读 [tool.md](tool.md) 和 [tools-bash.md](tools-bash.md)

### 想理解对话流程？
→ 阅读 [session.md](session.md) 和 [llm.md](llm.md)

### 想修改配置？
→ 阅读 [config.md](config.md)

## 📖 阅读建议

1. **新手入门**: 先读 [types.md](types.md) 了解基础概念
2. **理解架构**: 读 [ARCHITECTURE.md](../ARCHITECTURE.md) 了解整体结构
3. **添加功能**: 读 [tool.md](tool.md) 了解如何扩展
4. **调试问题**: 查看具体模块的文档和代码

## 🔗 相关文档

- [项目 README](../hello_world/README.md) - 快速开始指南
- [扩展指南](../hello_world/EXTENSION.md) - 如何添加新工具
- [架构文档](../ARCHITECTURE.md) - 整体架构设计
