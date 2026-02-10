# Hello World OpenCode

A minimal OpenCode implementation using GLM-4.7 model.

## Features

- ✅ Interactive CLI chat
- ✅ Tool system (bash, read)
- ✅ Session persistence
- ✅ Streaming responses
- ✅ Extensible tool architecture

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your GLM API Key
```

### 3. Run

```bash
npm run dev
# or
npm start
```

## Configuration

Set in `.env`:

```env
GLM_API_KEY=your-api-key
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
GLM_MODEL=glm-4.7
```

## Usage

Start the application and you'll see a menu:
1. **Create new session** - Start a new conversation
2. **Load existing session** - Continue previous conversation
3. **Exit** - Quit the program

During conversation:
- Type messages to chat with AI
- Type `exit` or `quit` to exit
- AI can invoke tools to execute commands or read files

## Available Tools

- **bash**: Execute shell commands
  - Parameters: `command` (string), `timeout` (number, optional)
  
- **read**: Read file contents
  - Parameters: `file_path` (string), `offset` (number, optional), `limit` (number, optional)

## Project Structure

```
src/
├── types.ts          # Type definitions
├── config.ts         # Configuration management
├── storage.ts        # Persistence layer
├── tool.ts           # Tool system
├── tools/            # Tool implementations
│   ├── bash.ts
│   ├── read.ts
│   └── index.ts
├── llm.ts            # GLM interaction
├── session.ts        # Session management
├── system-prompt.ts  # System prompt
└── index.ts          # CLI entry
```

## 📚 Documentation

Detailed documentation for each module:

### Core Modules
- [types.ts](docs/types.md) - Core type definitions (Message, Tool, Session, Config)
- [config.ts](docs/config.md) - Configuration management and environment variables
- [token.ts](docs/token.md) - Token calculation and context usage tracking
- [storage.ts](docs/storage.md) - Session persistence with JSON storage
- [tool.ts](docs/tool.md) - Tool system core (registration, execution)
- [llm.ts](docs/llm.md) - LLM interaction layer with streaming responses
- [session.ts](docs/session.md) - Session management and message processing
- [index.ts](docs/index.md) - CLI entry and user interaction

### Tool Modules
- [tools/bash.ts](docs/tools-bash.md) - Bash command execution with safety checks
- [tools/read.ts](docs/tools-read.md) - File reading with path traversal protection

### Architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - Overall system architecture and design
- [EXTENSION.md](EXTENSION.md) - Guide for adding new tools

## Extension

See [EXTENSION.md](./EXTENSION.md) for how to add new tools.

## License

MIT
