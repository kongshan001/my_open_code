import { SessionManager } from '../../src/session.js';
import { getConfig } from '../../src/config.js';
import { Message } from '../../src/types.js';

async function createLargeConversation() {
  console.log('🚀 Creating Large Conversation for Compression Testing\n');
  
  const config = getConfig();
  const sessionManager = await SessionManager.create('Large Test Session', config);
  
  console.log(`✓ Session created: ${sessionManager.getSession().id}\n`);
  
  // Create 100 messages to ensure compression triggers
  console.log('Generating 100 mixed messages...\n');
  
  const messageTemplates = [
    // Coding related
    {
      role: 'user' as const,
      templates: [
        'Implement a {feature} using {technology}',
        'How do I {action} in {language}?',
        'Create a {component} with {specification}',
        'Help me debug this {problem}',
        'Optimize this {code_snippet}'
      ]
    },
    {
      role: 'assistant' as const,
      templates: [
        'Here\'s how to implement {feature}:\n\n```{language}\n{implementation}\n```',
        'To {action} in {language}, you need to:\n1. {step1}\n2. {step2}\n3. {step3}',
        'I\'ll create the {component} with {specification}:',
        'The error in your {problem} is caused by {cause}. Here\'s the fix:',
        'To optimize this {code_snippet}, consider {optimization}'
      ]
    }
  ];
  
  const features = ['REST API', 'React component', 'database schema', 'authentication system', 'file upload'];
  const technologies = ['Node.js', 'React', 'Python', 'TypeScript', 'MongoDB'];
  const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go'];
  const components = ['button', 'form', 'modal', 'table', 'navbar'];
  
  // Generate messages
  for (let i = 0; i < 100; i++) {
    const isUser = i % 2 === 0;
    const templateGroup = messageTemplates[isUser ? 0 : 1];
    const template = templateGroup.templates[Math.floor(Math.random() * templateGroup.templates.length)];
    
    let content = template;
    content = content.replace('{feature}', features[Math.floor(Math.random() * features.length)]);
    content = content.replace('{technology}', technologies[Math.floor(Math.random() * technologies.length)]);
    content = content.replace('{action}', ['optimize', 'implement', 'debug', 'test', 'deploy'][Math.floor(Math.random() * 5)]);
    content = content.replace('{language}', languages[Math.floor(Math.random() * languages.length)]);
    content = content.replace('{component}', components[Math.floor(Math.random() * components.length)]);
    
    const message: Message = {
      id: `msg-${i}`,
      role: isUser ? 'user' : 'assistant',
      content: content,
      timestamp: Date.now() - (100 - i) * 1000
    };
    
    // Add tool calls occasionally
    if (!isUser && i % 5 === 0) {
      message.toolCalls = [{
        id: `tool-${i}`,
        name: ['write', 'read', 'bash'][Math.floor(Math.random() * 3)],
        args: {
          filePath: `file${i}.js`,
          content: `// Code for message ${i}`
        }
      }];
      message.toolResults = [{
        toolCallId: `tool-${i}`,
        output: `Operation completed for message ${i}`
      }];
    }
    
    sessionManager.getSession().messages.push(message);
    
    // Check compression every 20 messages
    if ((i + 1) % 20 === 0) {
      console.log(`\n--- After ${i + 1} messages ---`);
      console.log(sessionManager.formatContextStatus());
      
      const compressionResult = await sessionManager.checkAndPerformCompression();
      if (compressionResult?.compressed) {
        console.log(`📦 ${compressionResult.message}`);
        console.log(`   Strategy: ${compressionResult.strategy}`);
        console.log(`   Reduction: ${compressionResult.reductionPercentage}%`);
      }
    }
  }
  
  // Final state
  console.log('\n\n=== Final State ===');
  console.log(sessionManager.formatContextStatus());
  
  const lastCompression = sessionManager.getLastCompressionResult();
  if (lastCompression?.compressed) {
    console.log(`\nLast compression details:`);
    console.log(`  Strategy: ${lastCompression.strategy}`);
    console.log(`  Reduction: ${lastCompression.reductionPercentage}%`);
    console.log(`  Original tokens: ${lastCompression.originalTokenCount.toLocaleString()}`);
    console.log(`  Compressed tokens: ${lastCompression.compressedTokenCount.toLocaleString()}`);
    
    if (lastCompression.summary) {
      console.log(`\nSummary preview: ${lastCompression.summary.substring(0, 300)}...`);
    }
  }
  
  // Test manual compression
  console.log('\n\n=== Testing Manual Compression ===');
  const manualResult = await sessionManager.checkAndPerformCompression();
  if (manualResult?.compressed) {
    console.log(`✅ Manual compression: ${manualResult.message}`);
  } else if (manualResult) {
    console.log(`ℹ️  Manual compression: ${manualResult.message}`);
  }
  
  // Show message statistics
  const stats = {
    total: sessionManager.getSession().messages.length,
    user: sessionManager.getSession().messages.filter(m => m.role === 'user').length,
    assistant: sessionManager.getSession().messages.filter(m => m.role === 'assistant').length,
    tool: sessionManager.getSession().messages.filter(m => m.role === 'tool').length,
    withToolCalls: sessionManager.getSession().messages.filter(m => m.toolCalls).length
  };
  
  console.log('\n=== Message Statistics ===');
  console.log(`Total messages: ${stats.total}`);
  console.log(`User messages: ${stats.user}`);
  console.log(`Assistant messages: ${stats.assistant}`);
  console.log(`Tool messages: ${stats.tool}`);
  console.log(`Messages with tool calls: ${stats.withToolCalls}`);
  
  console.log('\n✅ Large conversation test completed!');
}

createLargeConversation().catch(console.error);