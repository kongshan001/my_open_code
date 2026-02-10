import { CompressionManager } from '../../src/compression.js';
import { Message } from '../../src/types.js';
import { estimateTokens } from '../../src/token.js';

// Helper to create test messages
function createMessage(role: 'user' | 'assistant' | 'tool', content: string, toolCalls?: any[], toolResults?: any[]): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    timestamp: Date.now(),
    toolCalls,
    toolResults
  };
}

// Create test conversation with various message types
function createTestConversation(count: number): Message[] {
  const messages: Message[] = [];
  
  for (let i = 0; i < count; i++) {
    // User query
    messages.push(createMessage(
      'user',
      `This is user query #${i + 1}. I need help with implementing a feature that involves complex data processing and algorithm optimization. The feature should handle large datasets efficiently. Please provide a comprehensive solution with code examples, documentation, and best practices. Also include error handling and unit tests for the implementation. Consider performance implications and scalability issues when designing the solution. The code should be production-ready and follow industry standards.`
    ));
    
    // Assistant response with tool calls
    if (i % 3 === 0) {
      messages.push(createMessage(
        'assistant',
        `I'll help you implement this feature comprehensively. Let me start by examining the current codebase structure and then create all necessary files including the implementation, tests, and documentation.\n\nFirst, let's analyze the requirements:\n1. Data processing pipeline\n2. Algorithm optimization\n3. Large dataset handling\n4. Performance considerations\n\nI'll create several files:\n- Main implementation file\n- Unit tests\n- Integration tests\n- Documentation\n- Configuration files\n\nLet me start by creating the main implementation file with all the necessary components. This will include efficient data structures, optimized algorithms, and proper error handling mechanisms.`,
        [{ id: `tool-${i}`, name: 'write', args: { filePath: `src/feature${i}.js`, content: 'function test() {}' } }],
        [{ toolCallId: `tool-${i}`, output: 'File created successfully at src/feature.js\nImplementation completed with all required components\nUnit tests added to test suite\nDocumentation generated' }]
      ));
    } else {
      const assistantContent = `Here's the comprehensive solution for query #${i + 1}. You should implement the following approach:

## 1. Architecture Design

The solution follows a modular architecture pattern:

\`\`\`javascript
// Main processor class
class DataProcessor {
  constructor(options) {
    this.options = options;
    this.cache = new Map();
    this.metrics = new MetricsCollector();
  }
  
  async processData(data) {
    // Implementation with optimization
    return data.map(x => x * 2);
  }
}
\`\`\`

## 2. Implementation Details

### Core Logic
\`\`\`javascript
function optimizeAlgorithm(input) {
  // Optimized implementation
  return input.reduce((acc, item) => {
    acc.push(processItem(item));
    return acc;
  }, []);
}
\`\`\`

### Error Handling
\`\`\`javascript
try {
  const result = await processData(data);
  return { success: true, data: result };
} catch (error) {
  logError(error);
  return { success: false, error: error.message };
}
\`\`\`

## 3. Best Practices
- Always validate inputs
- Use proper error handling
- Implement logging
- Add unit tests
- Document the code

This comprehensive approach ensures production-ready code with proper error handling, testing, and documentation.`;
      
      messages.push(createMessage('assistant', assistantContent));
    }
    
    // Add error message occasionally
    if (i % 5 === 0) {
      const errorContent = `Error: Something went wrong while processing request #${i + 1}. Please check the following:

- Verify input parameters
- Check file permissions
- Review memory usage
- Validate configuration

Full error details:
{
  "code": "PROCESSING_ERROR",
  "message": "Failed to process data",
  "timestamp": "${new Date().toISOString()}",
  "details": {
    "inputSize": "large",
    "memoryUsage": "high",
    "suggestion": "Try reducing input size"
  }
}`;
      
      messages.push(createMessage('assistant', errorContent));
    }
  }
  
  return messages;
}

// Test all compression strategies
async function testCompressionStrategies() {
  console.log('🧪 Testing Context Compression Features\n');
  
  const compressionManager = new CompressionManager();
  const testConfig = {
    enabled: true,
    threshold: 75,
    strategy: 'summary' as const,
    preserveToolHistory: true,
    preserveRecentMessages: 5,
    notifyBeforeCompression: true
  };
  
  // Create a much larger conversation to trigger compression
  console.log('1️⃣  Creating large test conversation...');
  const largeConversation = createTestConversation(50);
  const totalTokens = largeConversation.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  console.log(`   Messages: ${largeConversation.length}`);
  console.log(`   Estimated tokens: ${totalTokens.toLocaleString()}\n`);
  
  // Test with a test model that has smaller context
  console.log('2️⃣  Testing compression with small context model:');
  const testModelName = 'glm-test-small';
  
  const strategies: Array<'summary' | 'sliding-window' | 'importance'> = ['summary', 'sliding-window', 'importance'];
  
  for (const strategy of strategies) {
    console.log(`\n   📋 Testing ${strategy} strategy:`);
    
    const config = { ...testConfig, strategy };
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    
    console.log(`      Compressed: ${result.compressed ? 'YES' : 'NO'}`);
    console.log(`      Original tokens: ${result.originalTokenCount.toLocaleString()}`);
    console.log(`      Compressed tokens: ${result.compressedTokenCount.toLocaleString()}`);
    console.log(`      Reduction: ${result.reductionPercentage}%`);
    console.log(`      Messages before: ${largeConversation.length}`);
    console.log(`      Messages after: ${result.compressedMessages?.length || largeConversation.length}`);
    
    if (result.summary) {
      console.log(`      Summary: ${result.summary.substring(0, 200)}...`);
    }
    
    // Verify tool history preservation
    const originalToolMessages = largeConversation.filter(m => m.role === 'tool' || 
      (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0));
    const compressedToolMessages = result.compressedMessages?.filter(m => m.role === 'tool' || 
      (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0)) || [];
    
    console.log(`      Tool messages - Original: ${originalToolMessages.length}, Preserved: ${compressedToolMessages.length}`);
    
    // Verify recent messages preservation
    const recentMessages = result.compressedMessages?.slice(-config.preserveRecentMessages) || [];
    const allRecentPreserved = recentMessages.every(msg => 
      largeConversation.slice(-config.preserveRecentMessages).some(orig => orig.id === msg.id)
    );
    console.log(`      Recent messages preserved: ${allRecentPreserved ? 'YES' : 'NO'}`);
  }
  
  // Test edge cases
  console.log('\n3️⃣  Testing edge cases:');
  
  // Empty conversation
  const emptyResult = await compressionManager.compress([], testConfig, testModelName);
  console.log(`   Empty conversation: ${emptyResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  
  // Single message
  const singleMessage = [createMessage('user', 'Hello')];
  const singleResult = await compressionManager.compress(singleMessage, testConfig, testModelName);
  console.log(`   Single message: ${singleResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  
  // Very long messages
  const longContent = 'A'.repeat(50000);
  const longMessages = [
    createMessage('user', longContent),
    createMessage('assistant', longContent),
    createMessage('user', longContent)
  ];
  const longResult = await compressionManager.compress(longMessages, testConfig, testModelName);
  console.log(`   Long messages: ${longResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  console.log(`   Long content reduction: ${longResult.reductionPercentage}%`);
  
  // Test with different thresholds
  console.log('\n4️⃣  Testing different compression thresholds:');
  
  const thresholds = [25, 50, 75];
  for (const threshold of thresholds) {
    const config = { ...testConfig, threshold };
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    console.log(`   Threshold ${threshold}%: ${result.compressed ? 'COMPRESSED' : 'NOT compressed'} (${result.reductionPercentage}% reduction)`);
  }
  
  // Test different preserve settings
  console.log('\n5️⃣  Testing different preservation settings:');
  
  const preserveConfigs = [
    { preserveToolHistory: false, preserveRecentMessages: 2 },
    { preserveToolHistory: true, preserveRecentMessages: 15 },
    { preserveToolHistory: false, preserveRecentMessages: 20 }
  ];
  
  for (const configOverride of preserveConfigs) {
    const config = { ...testConfig, ...configOverride };
    const result = await compressionManager.compress(largeConversation, config, testModelName);
    console.log(`   Config ${JSON.stringify(configOverride)}: ${result.compressed ? 'COMPRESSED' : 'NOT compressed'} (${result.reductionPercentage}% reduction)`);
    if (result.compressedMessages) {
      console.log(`      Messages after compression: ${result.compressedMessages.length}`);
    }
  }
  
  // Test compression with mixed content types
  console.log('\n6️⃣  Testing with mixed content types:');
  
  const mixedConversation: Message[] = [
    createMessage('user', 'Simple question'),
    createMessage('assistant', 'Simple answer'),
    createMessage('user', '```python\ndef complex_function():\n    # Complex code here\n    pass\n```'),
    createMessage('assistant', 'Here is the analysis of your code'),
    createMessage('user', 'Error: TypeError occurred'),
    createMessage('assistant', 'The error is caused by...'),
    ...Array(10).fill(0).map((_, i) => 
      createMessage('user', `Regular message ${i}`)
    ),
    ...Array(5).fill(0).map((_, i) => 
      createMessage('assistant', `Regular response ${i}`, 
        [{ id: `tool-mixed-${i}`, name: 'bash', args: { command: `echo test${i}` } }],
        [{ toolCallId: `tool-mixed-${i}`, output: `test${i}\n` }]
      )
    )
  ];
  
  const mixedResult = await compressionManager.compress(mixedConversation, testConfig, testModelName);
  console.log(`   Mixed content: ${mixedResult.compressed ? 'COMPRESSED' : 'NOT compressed'} (${mixedResult.reductionPercentage}% reduction)`);
  
  console.log('\n✅ All compression tests completed!');
}

// Run the tests
testCompressionStrategies().catch(console.error);