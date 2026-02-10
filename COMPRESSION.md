# Context Compression Feature

This feature adds automatic context compression to the hello_world OpenCode agent to handle long conversations and stay within model context limits.

## Overview

When a conversation grows large, it can exceed the model's context window. The compression feature automatically reduces the context size while preserving important information and conversation continuity.

## Features

- **Multiple Compression Strategies**: Choose from summary, sliding window, or importance-based compression
- **Configurable Thresholds**: Set custom triggers for when to compress
- **Tool History Preservation**: Optionally keep tool execution history
- **User Notifications**: Get notified before compression happens
- **Rollback Capability**: Store compression results for potential rollback

## Configuration

Add these settings to your `.env` file:

```env
# Enable/disable compression
COMPRESSION_ENABLED=true

# Trigger compression at this percentage (default: 75%)
COMPRESSION_THRESHOLD=75

# Compression strategy: summary, sliding-window, or importance
COMPRESSION_STRATEGY=summary

# Preserve tool execution history (default: true)
PRESERVE_TOOL_HISTORY=true

# Number of recent messages to always preserve (default: 10)
PRESERVE_RECENT_MESSAGES=10

# Notify user before compression (default: true)
NOTIFY_BEFORE_COMPRESSION=true
```

## Compression Strategies

### 1. Summary Strategy
- Generates a concise summary of older messages
- Keeps the summary plus recent messages
- Preserves tool history if enabled
- Good for maintaining conversation continuity

### 2. Sliding Window Strategy
- Keeps only the most recent N messages
- Also preserves tool history if enabled
- Simple and predictable
- Faster than summary generation

### 3. Importance Strategy
- Scores messages based on various factors:
  - Tool-related messages get highest priority
  - User queries are important
  - Messages with code/errors get bonus points
  - Recent messages are always preserved
- Balances between context reduction and information retention

## Usage

### Automatic Compression
Compression is automatically triggered when:
- COMPRESSION_ENABLED is true
- Context usage reaches COMPRESSION_THRESHOLD percentage
- The compression happens silently in the background

### Manual Compression
Use the `/compress` command during interactive mode to manually trigger compression:
```
You: /compress
```

### UI Indicators
- 📦 appears next to the context usage when compression is active
- Compression status is shown in the `/history` command
- Compression details are displayed after each compression event

## Implementation Details

### Key Files
- `src/compression.ts`: Core compression logic and strategies
- `src/config.ts`: Compression configuration loading
- `src/session.ts`: Integration with session management
- `src/token.ts`: Context usage calculation
- `src/index.ts`: UI updates and commands

### Flow
1. Before processing a message, check context usage
2. If usage exceeds threshold, apply configured compression strategy
3. Replace messages with compressed version
4. Save compression result to session metadata
5. Notify user (if configured)
6. Continue with normal message processing

### Preserved Information
- Recent messages (configurable count)
- Tool execution history (optional)
- Error messages and code blocks
- Important context markers

## Example Output

```
🔧 Context compression triggered: Context compressed using summary strategy. Reduced from 38,970 to 8,270 tokens (79% reduction).
   Strategy: summary
   Reduction: 79% (38,970 → 8,270 tokens)
   The conversation covered 21 user queries and 21 assistant responses.

🟡📦 Context: 45% (8,270/128,000) | Remaining: 119,730

Last compression: summary strategy, 79% reduction (38,970 → 8,270 tokens)
```

## Testing

Run the included test to verify compression functionality:

```bash
npx tsx test-compression.ts
```

This will test all compression strategies with sample messages and show the reduction results.