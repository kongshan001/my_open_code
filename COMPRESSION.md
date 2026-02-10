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

## Best Practices

### Choosing the Right Strategy

1. **Summary Strategy (Default)**
   - Best for: General conversations, mixed content types
   - Pros: Preserves conversation flow, good context retention
   - Cons: May lose some specific details
   - Use when: You want to maintain conversation continuity

2. **Sliding Window Strategy**
   - Best for: Recent-focused interactions, stateless conversations
   - Pros: Predictable, fast execution, preserves recent context
   - Cons: Loses older context entirely
   - Use when: Only recent messages matter

3. **Importance Strategy**
   - Best for: Technical discussions, code-heavy conversations
   - Pros: Intelligently selects important messages
   - Cons: More complex, may miss subtle context
   - Use when: Some messages are more valuable than others

### Configuration Recommendations

```env
# For coding/technical sessions
COMPRESSION_STRATEGY=importance
PRESERVE_TOOL_HISTORY=true
PRESERVE_RECENT_MESSAGES=15

# For general chat
COMPRESSION_STRATEGY=summary
PRESERVE_TOOL_HISTORY=false
PRESERVE_RECENT_MESSAGES=10

# For performance-critical applications
COMPRESSION_STRATEGY=sliding-window
PRESERVE_RECENT_MESSAGES=5
COMPRESSION_THRESHOLD=85
```

### Tips for Optimal Compression

1. **Adjust Thresholds Based on Context**
   - Large context models (128K+): Use 80-85% threshold
   - Medium context models (32K-64K): Use 70-75% threshold
   - Small context models (<32K): Use 60-65% threshold

2. **Preserve Recent Messages Wisely**
   - Coding sessions: 10-15 messages to maintain context
   - General chat: 5-10 messages is usually sufficient
   - Debugging: Keep more messages to track error progression

3. **Tool History Considerations**
   - Enable for development/debugging sessions
   - Disable for casual conversations to save space
   - Critical for tracking file changes and system state

## Troubleshooting

### Common Issues

1. **Compression Not Triggering**
   ```
   Problem: Context exceeds limit but compression doesn't run
   Solution: 
   - Check COMPRESSION_ENABLED=true in .env
   - Verify COMPRESSION_THRESHOLD is appropriate
   - Ensure model name matches limits in token.ts
   ```

2. **Too Much Compression**
   ```
   Problem: Important context is being lost
   Solution:
   - Increase PRESERVE_RECENT_MESSAGES
   - Switch to importance strategy
   - Lower COMPRESSION_THRESHOLD
   ```

3. **Performance Issues**
   ```
   Problem: Compression is slow
   Solution:
   - Use sliding-window strategy for faster compression
   - Reduce PRESERVE_RECENT_MESSAGES
   - Implement async compression (see implementation tips)
   ```

4. **Tool History Not Preserved**
   ```
   Problem: Tool execution history disappears
   Solution:
   - Set PRESERVE_TOOL_HISTORY=true
   - Check tool message format in types.ts
   - Verify tool calls have proper IDs
   ```

### Debug Mode

Enable debug logging to troubleshoot compression:

```bash
# Set debug environment variable
export DEBUG_COMPRESSION=true
npm run dev
```

This will show:
- When compression is triggered
- Which strategy is used
- Messages before/after counts
- Token counts and reduction percentages

### Manual Compression Commands

```bash
# Force compression regardless of threshold
/compress

# Check current compression stats
/history

# Clear context and start fresh
/clear
```

## Implementation Tips

### Async Compression with Progress

```typescript
// In your session manager
async checkAndPerformCompression() {
  if (this.shouldCompress()) {
    // Show progress indicator
    console.log('🔄 Compressing context...');
    
    // Perform compression
    const result = await this.compressionManager.compress(
      this.messages, 
      this.config.compression,
      this.modelName
    );
    
    // Apply results
    if (result.compressed) {
      this.messages = result.compressedMessages;
      this.lastCompression = result;
      console.log(`✅ ${result.message}`);
    }
    
    return result;
  }
}
```

### Compression Preview

```typescript
// Preview before applying
const preview = await compressionManager.previewCompression(
  messages, 
  config, 
  modelName
);

console.log(`Preview: ${preview.reductionPercentage}% reduction`);
console.log(`Messages: ${messages.length} → ${preview.compressedMessages.length}`);

// Apply if user confirms
if (userConfirm) {
  const result = await compressionManager.compress(messages, config, modelName);
  messages = result.compressedMessages;
}
```

### Quality Metrics

```typescript
// Track compression quality
const quality = {
  preservedToolCalls: originalTools === preservedTools,
  preservedRecentMessages: recentMessagesPreserved,
  contextContinuity: summaryIncludesKeyTopics,
  reductionRatio: reductionPercentage > 50
};
```

## Testing

Run the comprehensive test suite to verify compression functionality:

```bash
# Basic compression tests
npx tsx test-compression.ts

# Enhanced compression tests
npx tsx test-compression-comprehensive.ts

# Demo with real conversation
npx tsx demo-compression.ts
```

These tests will:
- Verify all compression strategies work correctly
- Test edge cases and error conditions
- Demonstrate compression with sample conversations
- Show token reduction and preservation statistics