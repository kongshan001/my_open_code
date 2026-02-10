import { SessionManager } from './src/session.js';
import { getConfig } from './src/config.js';
import { createMessage } from './src/compression.js';
import { Message } from './src/types.js';

async function runDemo() {
  console.log('🚀 Hello World OpenCode Agent - Compression Demo\n');
  
  const config = getConfig();
  console.log('✓ Configuration loaded');
  console.log(`  Model: ${config.model}`);
  console.log(`  Compression: ${config.compression?.enabled ? 'Enabled' : 'Disabled'}`);
  if (config.compression?.enabled) {
    console.log(`  Strategy: ${config.compression.strategy}`);
    console.log(`  Threshold: ${config.compression.threshold}%`);
    console.log(`  Preserve Recent: ${config.compression.preserveRecentMessages} messages`);
    console.log(`  Preserve Tools: ${config.compression.preserveToolHistory ? 'Yes' : 'No'}\n`);
  }

  // Create a new session
  const sessionManager = await SessionManager.create('Compression Demo Session', config);
  console.log(`✓ Session created: ${sessionManager.getSession().id}\n`);

  // Simulate a conversation that will trigger compression
  console.log('📝 Simulating conversation that will trigger compression...\n');
  
  // Add messages that will eventually trigger compression
  for (let i = 1; i <= 30; i++) {
    // User message
    await sessionManager.addUserMessage(`Please help me with task #${i}. I need to implement a complex feature that requires multiple steps and careful consideration of various factors.`);
    
    // Assistant response
    const assistantMsg: Message = {
      id: `msg-assistant-${i}`,
      role: 'assistant',
      content: `I'll help you with task #${i}. Here's a comprehensive solution:

## Approach
1. Analyze requirements
2. Design architecture
3. Implement solution
4. Test thoroughly

## Code Implementation
\`\`\`javascript
function solveTask${i}() {
  // Implementation details
  const result = processData();
  return optimize(result);
}
\`\`\`

This approach ensures robust and maintainable code.`,
      timestamp: Date.now(),
      toolCalls: i % 3 === 0 ? [{
        id: `tool-${i}`,
        name: 'write',
        args: { filePath: `solution${i}.js`, content: '// Code implementation' }
      }] : undefined,
      toolResults: i % 3 === 0 ? [{
        toolCallId: `tool-${i}`,
        output: `File solution${i}.js created successfully`
      }] : undefined
    };
    
    sessionManager.getSession().messages.push(assistantMsg);
    
    // Check compression every few messages
    if (i % 5 === 0) {
      console.log(`\n--- After ${i} messages ---`);
      console.log(sessionManager.formatContextStatus());
      
      const compressionResult = await sessionManager.checkAndPerformCompression();
      if (compressionResult?.compressed) {
        console.log(`📦 ${compressionResult.message}`);
      }
    }
  }

  // Final status
  console.log('\n\n--- Final Status ---');
  console.log(sessionManager.formatContextStatus());
  
  const lastCompression = sessionManager.getLastCompressionResult();
  if (lastCompression?.compressed) {
    console.log(`\nLast compression: ${lastCompression.strategy} strategy`);
    console.log(`Reduction: ${lastCompression.reductionPercentage}%`);
    console.log(`Original: ${lastCompression.originalTokenCount.toLocaleString()} tokens`);
    console.log(`Compressed: ${lastCompression.compressedTokenCount.toLocaleString()} tokens`);
  }
  
  // Test manual compression command
  console.log('\n\n--- Testing Manual Compression ---');
  const manualResult = await sessionManager.checkAndPerformCompression();
  if (manualResult?.compressed) {
    console.log(`✅ Manual compression: ${manualResult.message}`);
  } else if (manualResult) {
    console.log(`ℹ️  Manual compression: ${manualResult.message}`);
  }
  
  console.log('\n✅ Demo completed!');
}

runDemo().catch(console.error);