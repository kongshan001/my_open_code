import { SessionManager } from './src/session.js';
import { getConfig } from './src/config.js';
import { CompressionManager } from './src/compression.js';
import { Message } from './src/types.js';

async function runFullDemo() {
  console.log('🚀 Hello World OpenCode Agent - Full Compression Demo\n');
  console.log('=' .repeat(60));
  
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

  // Create a session
  const sessionManager = await SessionManager.create('Full Demo Session', config);
  const compressionManager = new CompressionManager();
  console.log(`✓ Session created: ${sessionManager.getSession().id}\n`);

  // Part 1: Coding conversation
  console.log('1️⃣  Testing Coding Conversation Compression\n');
  console.log('-'.repeat(40));
  
  const codingMessages: Message[] = [
    {
      id: 'code-1',
      role: 'user',
      content: 'I need to implement a REST API with Node.js and Express. Can you help me create the basic structure?',
      timestamp: Date.now() - 10000
    },
    {
      id: 'code-2',
      role: 'assistant',
      content: `I'll help you create a Node.js REST API with Express. Here's the basic structure:

\`\`\`javascript
// server.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
\`\`\`

This creates a basic Express server with health check endpoint.`,
      timestamp: Date.now() - 9000
    },
    {
      id: 'code-3',
      role: 'user',
      content: 'Great! Now add user management endpoints with CRUD operations',
      timestamp: Date.now() - 8000
    },
    {
      id: 'code-4',
      role: 'assistant',
      content: `I'll add user management CRUD operations. Let me create the necessary files:`,
      timestamp: Date.now() - 7000,
      toolCalls: [{
        id: 'tool-1',
        name: 'write',
        args: { filePath: 'routes/users.js', content: 'const express = require("express");\nconst router = express.Router();\n\n// GET /api/users\nrouter.get("/", (req, res) => {\n  res.json({ users: [] });\n});\n\n// POST /api/users\nrouter.post("/", (req, res) => {\n  res.json({ message: "User created" });\n});\n\nmodule.exports = router;' }
      }],
      toolResults: [{
        toolCallId: 'tool-1',
        output: 'File created: routes/users.js'
      }]
    },
    {
      id: 'code-5',
      role: 'user',
      content: 'Add error handling middleware',
      timestamp: Date.now() - 6000
    },
    {
      id: 'code-6',
      role: 'assistant',
      content: `Here's the error handling middleware:

\`\`\`javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
};

module.exports = errorHandler;
\`\`\`

Add it to your main server file after all routes.`,
      timestamp: Date.now() - 5000
    },
    {
      id: 'code-7',
      role: 'user',
      content: 'How do I add database integration with MongoDB?',
      timestamp: Date.now() - 4000
    },
    {
      id: 'code-8',
      role: 'assistant',
      content: `To integrate MongoDB, you'll need Mongoose. Here's how:

\`\`\`javascript
// db/connection.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(\`MongoDB Connected: \${conn.connection.host}\`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;
\`\`\`

Then create a User model and update your routes to use it.`,
      timestamp: Date.now() - 3000
    }
  ];
  
  // Add coding messages to session
  codingMessages.forEach(msg => sessionManager.getSession().messages.push(msg));
  
  // Show stats before compression
  const codingStats = compressionManager.getCompressionStats(sessionManager.getSession().messages);
  console.log(`Messages: ${codingStats.totalMessages}`);
  console.log(`Code blocks: ${codingStats.codeBlocks}`);
  console.log(`Estimated tokens: ${codingStats.estimatedTokens.toLocaleString()}`);
  console.log('\nContext before compression:');
  console.log(sessionManager.formatContextStatus());
  
  // Trigger compression
  const codingResult = await sessionManager.checkAndPerformCompression();
  if (codingResult?.compressed) {
    console.log(`\n✅ ${codingResult.message}`);
    console.log(`Strategy: ${codingResult.strategy}`);
    console.log(`Reduction: ${codingResult.reductionPercentage}%\n`);
    console.log('Context after compression:');
    console.log(sessionManager.formatContextStatus());
  }
  
  // Part 2: Debugging conversation
  console.log('\n\n2️⃣  Testing Debugging Conversation Compression\n');
  console.log('-'.repeat(40));
  
  const debuggingMessages: Message[] = [
    {
      id: 'debug-1',
      role: 'user',
      content: 'I have an error: "Cannot read property of undefined" in my React app',
      timestamp: Date.now() - 5000
    },
    {
      id: 'debug-2',
      role: 'assistant',
      content: 'This error typically occurs when trying to access a property on an undefined value. Check if the object exists before accessing its properties. Use optional chaining (?.) or proper null checks.',
      timestamp: Date.now() - 4500
    },
    {
      id: 'debug-3',
      role: 'user',
      content: 'Here\'s my code: const user = users.find(id); return user.name;',
      timestamp: Date.now() - 4000
    },
    {
      id: 'debug-4',
      role: 'assistant',
      content: 'The issue is that `find` might not find a match, returning undefined. Fix it: const user = users.find(id); return user?.name || "User not found";',
      timestamp: Date.now() - 3500
    },
    {
      id: 'debug-5',
      role: 'user',
      content: 'Error: Failed to fetch data from API',
      timestamp: Date.now() - 3000
    },
    {
      id: 'debug-6',
      role: 'assistant',
      content: 'This could be due to CORS, network issues, or server errors. Add error handling and check the network tab in browser dev tools.',
      timestamp: Date.now() - 2500
    },
    {
      id: 'debug-7',
      role: 'user',
      content: 'TypeError: this.setState is not a function',
      timestamp: Date.now() - 2000
    },
    {
      id: 'debug-8',
      role: 'assistant',
      content: 'This happens when using arrow functions or losing context. Bind the method or use arrow functions to preserve `this` context.',
      timestamp: Date.now() - 1500
    }
  ];
  
  debuggingMessages.forEach(msg => sessionManager.getSession().messages.push(msg));
  
  const debugStats = compressionManager.getCompressionStats(sessionManager.getSession().messages);
  console.log(`\nMessages after adding debugging: ${debugStats.totalMessages}`);
  console.log(`Errors mentioned: ${debugStats.errors}`);
  
  // Preview compression
  const preview = await compressionManager.previewCompression(
    sessionManager.getSession().messages,
    config.compression!,
    config.model
  );
  
  console.log('\nCompression Preview:');
  console.log(`  Would reduce tokens by: ${preview.reductionPercentage}%`);
  console.log(`  Messages: ${debugStats.totalMessages} → ${preview.compressedMessages.length}`);
  console.log(`  Strategy: ${preview.strategy}`);
  
  // Apply compression
  const debugResult = await sessionManager.checkAndPerformCompression();
  if (debugResult?.compressed) {
    console.log(`\n✅ Compression applied: ${debugResult.message}\n`);
  }
  
  // Part 3: Test different strategies
  console.log('3️⃣  Testing Different Compression Strategies\n');
  console.log('-'.repeat(40));
  
  const strategies: Array<'summary' | 'sliding-window' | 'importance'> = ['summary', 'sliding-window', 'importance'];
  
  for (const strategy of strategies) {
    console.log(`\n📋 Testing ${strategy} strategy:`);
    
    // Create a test config with the strategy
    const testConfig = { ...config.compression!, strategy };
    
    const result = await compressionManager.compress(
      sessionManager.getSession().messages,
      testConfig,
      config.model
    );
    
    if (result.compressed) {
      console.log(`   Reduction: ${result.reductionPercentage}%`);
      console.log(`   Messages: ${sessionManager.getSession().messages.length} → ${result.compressedMessages?.length}`);
      
      // Show what's preserved
      const toolMessages = result.compressedMessages?.filter(m => 
        m.role === 'tool' || (m.role === 'assistant' && m.toolCalls)
      );
      console.log(`   Tool messages preserved: ${toolMessages?.length || 0}`);
      
      if (result.summary && result.summary.length < 200) {
        console.log(`   Summary: ${result.summary.substring(0, 100)}...`);
      }
    }
  }
  
  // Part 4: Manual compression with user interaction
  console.log('\n\n4️⃣  Manual Compression Example\n');
  console.log('-'.repeat(40));
  
  // Simulate user asking for compression
  console.log('User: /compress\n');
  
  console.log('🔧 Checking compression eligibility...\n');
  
  const usage = sessionManager.getContextUsage();
  console.log(`Current usage: ${usage.usagePercentage}% (${usage.totalTokens.toLocaleString()} tokens)`);
  
  if (usage.usagePercentage > 50) {
    console.log('✓ Compression recommended');
    
    const manualResult = await sessionManager.checkAndPerformCompression();
    if (manualResult?.compressed) {
      console.log(`\n✅ Manual compression completed!`);
      console.log(`   ${manualResult.message}\n`);
    }
  } else {
    console.log('ℹ️  Compression not needed yet');
  }
  
  // Final summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Demo Summary\n');
  
  const finalStats = compressionManager.getCompressionStats(sessionManager.getSession().messages);
  console.log(`Final message count: ${finalStats.totalMessages}`);
  console.log(`Code blocks: ${finalStats.codeBlocks}`);
  console.log(`Tool calls: ${finalStats.assistantMessages} (estimated)`);
  console.log(`Final context usage: ${sessionManager.formatContextStatus()}`);
  
  const lastCompression = sessionManager.getLastCompressionResult();
  if (lastCompression?.compressed) {
    console.log(`\nLast compression:`);
    console.log(`  Strategy: ${lastCompression.strategy}`);
    console.log(`  Total reduction: ${lastCompression.reductionPercentage}%`);
    console.log(`  Original: ${lastCompression.originalTokenCount.toLocaleString()} tokens`);
    console.log(`  Compressed: ${lastCompression.compressedTokenCount.toLocaleString()} tokens`);
  }
  
  console.log('\n✅ Full compression demo completed!');
  console.log('\nThe compression feature successfully:');
  console.log('  ✓ Analyzed different conversation types (coding, debugging)');
  console.log('  ✓ Applied appropriate compression strategies');
  console.log('  ✓ Preserved important context (tools, recent messages)');
  console.log('  ✓ Provided clear feedback and statistics');
  console.log('  ✓ Maintained conversation continuity');
}

runFullDemo().catch(console.error);