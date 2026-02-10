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
      `This is user query #${i + 1}. I need help with implementing a feature that involves complex data processing and algorithm optimization. The feature should handle large datasets efficiently.`
    ));
    
    // Assistant response with tool calls
    if (i % 3 === 0) {
      messages.push(createMessage(
        'assistant',
        `I'll help you implement this feature. Let me start by examining the current codebase and then create the necessary files.`,
        [{ id: `tool-${i}`, name: 'write', args: { filePath: `file${i}.js`, content: 'function test() {}' } }],
        [{ toolCallId: `tool-${i}`, output: 'File created successfully' }]
      ));
    } else {
      messages.push(createMessage(
        'assistant',
        `Here's the solution for query #${i + 1}. You should implement the following approach:\n\n1. First, analyze the requirements\n2. Design the architecture\n3. Implement the core logic\n\`\`\`javascript\nfunction processData(data) {\n  // Implementation here\n  return data.map(x => x * 2);\n}\n\`\`\`\n\nThis should solve the problem efficiently.`
      ));
    }
    
    // Add error message occasionally
    if (i % 5 === 0) {
      messages.push(createMessage(
        'assistant',
        `Error: Something went wrong while processing request #${i + 1}. Please check the logs and try again.`
      ));
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
  
  // Test with a small conversation (no compression needed)
  console.log('1️⃣  Testing with small conversation (no compression expected):');
  const smallConversation = createTestConversation(3);
  console.log(`   Messages: ${smallConversation.length}`);
  console.log(`   Estimated tokens: ${smallConversation.reduce((sum, msg) => sum + estimateTokens(msg.content), 0).toLocaleString()}`);
  
  const smallResult = await compressionManager.compress(smallConversation, testConfig, 'glm-4.7');
  console.log(`   Result: ${smallResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  console.log(`   Message: ${smallResult.message}\n`);
  
  // Test with large conversation for each strategy
  const strategies: Array<'summary' | 'sliding-window' | 'importance'> = ['summary', 'sliding-window', 'importance'];
  const largeConversation = createTestConversation(15);
  
  console.log(`2️⃣  Testing with large conversation (${largeConversation.length} messages):`);
  console.log(`   Estimated tokens: ${largeConversation.reduce((sum, msg) => sum + estimateTokens(msg.content), 0).toLocaleString()}\n`);
  
  for (const strategy of strategies) {
    console.log(`   📋 Testing ${strategy} strategy:`);
    
    const config = { ...testConfig, strategy };
    const result = await compressionManager.compress(largeConversation, config, 'glm-4.7');
    
    console.log(`      Compressed: ${result.compressed ? 'YES' : 'NO'}`);
    console.log(`      Original tokens: ${result.originalTokenCount.toLocaleString()}`);
    console.log(`      Compressed tokens: ${result.compressedTokenCount.toLocaleString()}`);
    console.log(`      Reduction: ${result.reductionPercentage}%`);
    console.log(`      Messages before: ${largeConversation.length}`);
    console.log(`      Messages after: ${result.compressedMessages?.length || largeConversation.length}`);
    
    if (result.summary) {
      console.log(`      Summary: ${result.summary.substring(0, 100)}...`);
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
    
    console.log();
  }
  
  // Test with tiny model to force compression
  console.log('3️⃣  Testing forced compression with tiny model:');
  const mediumConversation = createTestConversation(5);
  const tinyResult = await compressionManager.compress(mediumConversation, testConfig, 'tiny-test-model');
  console.log(`   Result: ${tinyResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  console.log(`   Strategy used: ${tinyResult.strategy}`);
  console.log(`   Reduction: ${tinyResult.reductionPercentage}%\n`);
  
  // Test edge cases
  console.log('4️⃣  Testing edge cases:');
  
  // Empty conversation
  const emptyResult = await compressionManager.compress([], testConfig, 'glm-4.7');
  console.log(`   Empty conversation: ${emptyResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  
  // Single message
  const singleMessage = [createMessage('user', 'Hello')];
  const singleResult = await compressionManager.compress(singleMessage, testConfig, 'glm-4.7');
  console.log(`   Single message: ${singleResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  
  // Very long messages
  const longContent = 'A'.repeat(10000);
  const longMessages = [
    createMessage('user', longContent),
    createMessage('assistant', longContent),
    createMessage('user', longContent)
  ];
  const longResult = await compressionManager.compress(longMessages, testConfig, 'glm-4.7');
  console.log(`   Long messages: ${longResult.compressed ? 'COMPRESSED' : 'NOT compressed'}`);
  console.log(`   Long content reduction: ${longResult.reductionPercentage}%\n`);
  
  // Test with different configurations
  console.log('5️⃣  Testing different configurations:');
  
  const configs = [
    { preserveToolHistory: false, preserveRecentMessages: 3 },
    { preserveToolHistory: true, preserveRecentMessages: 10 },
    { threshold: 50 }
  ];
  
  for (const configOverride of configs) {
    const config = { ...testConfig, ...configOverride };
    const result = await compressionManager.compress(largeConversation, config, 'glm-4.7');
    console.log(`   Config ${JSON.stringify(configOverride)}: ${result.compressed ? 'COMPRESSED' : 'NOT compressed'} (${result.reductionPercentage}% reduction)`);
  }
  
  console.log('\n✅ All compression tests completed!');
}

// Run the tests
testCompressionStrategies().catch(console.error);