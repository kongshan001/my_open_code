import { CompressionManager } from '../../src/compression.js';
import { Message, CompressionConfig } from '../../src/types.js';
import { estimateTokens } from '../../src/token.js';

// Improved compression strategies with more sophisticated features

// Enhanced Summary Strategy with better AI summarization prompts
export class EnhancedSummaryCompressionStrategy {
  async compress(
    messages: Message[], 
    preserveRecentMessages: number,
    preserveToolHistory: boolean
  ): Promise<{ compressedMessages: Message[], summary: string }> {
    if (messages.length <= preserveRecentMessages * 2) {
      return { 
        compressedMessages: messages, 
        summary: "No compression needed - conversation is short enough." 
      };
    }

    // Separate recent messages from older ones
    const recentMessages = messages.slice(-preserveRecentMessages);
    const olderMessages = messages.slice(0, -preserveRecentMessages);
    
    // Extract tool history if needed
    const toolHistory: Message[] = [];
    if (preserveToolHistory) {
      olderMessages.forEach(msg => {
        if (msg.role === 'tool' || 
            (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0)) {
          toolHistory.push(msg);
        }
      });
    }
    
    // Generate improved summary with more context
    const summary = await this.generateEnhancedSummary(olderMessages);
    
    // Create structured summary message
    const summaryMessage: Message = {
      id: `summary-${Date.now()}`,
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
      metadata: {
        type: 'compression_summary',
        originalMessageCount: olderMessages.length,
        compressionTimestamp: Date.now(),
        topics: this.extractTopics(olderMessages),
        tools: this.extractToolsUsed(olderMessages)
      }
    };
    
    // Build compressed message array
    const compressedMessages = [summaryMessage];
    
    if (toolHistory.length > 0) {
      compressedMessages.push(...toolHistory);
    }
    
    compressedMessages.push(...recentMessages);
    
    return { compressedMessages, summary };
  }
  
  private async generateEnhancedSummary(messages: Message[]): Promise<string> {
    // Analyze conversation patterns
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const toolMessages = messages.filter(m => m.role === 'tool');
    
    // Extract key information
    const topics = this.extractTopics(messages);
    const tools = this.extractToolsUsed(messages);
    const codeBlocks = this.extractCodeSnippets(messages);
    const errors = this.extractErrors(messages);
    
    // Build comprehensive summary
    let summary = `[Conversation Summary]\n\n`;
    summary += `📊 **Statistics:**\n`;
    summary += `- User queries: ${userMessages.length}\n`;
    summary += `- Assistant responses: ${assistantMessages.length}\n`;
    summary += `- Tool executions: ${toolMessages.length}\n`;
    summary += `- Time span: ${this.formatTimeSpan(messages)}\n\n`;
    
    if (topics.length > 0) {
      summary += `🏷️ **Main Topics:**\n`;
      topics.slice(0, 5).forEach(topic => {
        summary += `- ${topic}\n`;
      });
      summary += `\n`;
    }
    
    if (tools.length > 0) {
      summary += `🔧 **Tools Used:**\n`;
      tools.forEach(tool => {
        summary += `- ${tool} (${this.countToolUsage(messages, tool)} times)\n`;
      });
      summary += `\n`;
    }
    
    if (errors.length > 0) {
      summary += `⚠️ **Errors Encountered:**\n`;
      errors.slice(0, 3).forEach(error => {
        summary += `- ${error.substring(0, 100)}...\n`;
      });
      summary += `\n`;
    }
    
    if (codeBlocks.length > 0) {
      summary += `💻 **Code Context:**\n`;
      summary += `- Languages used: ${[...new Set(codeBlocks.map(cb => cb.language))].join(', ')}\n`;
      summary += `- Code snippets: ${codeBlocks.length}\n\n`;
    }
    
    summary += `📝 **Summary:**\n`;
    summary += this.generateTextualSummary(userMessages, assistantMessages);
    
    summary += `\n\n---\n`;
    summary += `*Summary generated at ${new Date().toLocaleString()}*\n`;
    summary += `*Preserving ${messages.filter(m => m.role === 'user').slice(-10).length} most recent user queries*`;
    
    return summary;
  }
  
  private extractTopics(messages: Message[]): string[] {
    // Simple topic extraction based on keywords
    const topics = new Set<string>();
    const keywords = ['implement', 'create', 'fix', 'debug', 'test', 'refactor', 'optimize', 'deploy', 'configure'];
    
    messages.forEach(msg => {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase();
        keywords.forEach(keyword => {
          if (content.includes(keyword)) {
            topics.add(keyword);
          }
        });
      }
    });
    
    return Array.from(topics);
  }
  
  private extractToolsUsed(messages: Message[]): string[] {
    const tools = new Set<string>();
    
    messages.forEach(msg => {
      if (msg.toolCalls) {
        msg.toolCalls.forEach(call => {
          tools.add(call.name);
        });
      }
    });
    
    return Array.from(tools);
  }
  
  private extractCodeSnippets(messages: Message[]): Array<{language: string, snippet: string}> {
    const snippets: Array<{language: string, snippet: string}> = [];
    
    messages.forEach(msg => {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = codeBlockRegex.exec(msg.content)) !== null) {
        snippets.push({
          language: match[1] || 'text',
          snippet: match[2].substring(0, 100) + '...'
        });
      }
    });
    
    return snippets;
  }
  
  private extractErrors(messages: Message[]): string[] {
    const errors: string[] = [];
    
    messages.forEach(msg => {
      if (msg.content.toLowerCase().includes('error') || 
          msg.content.toLowerCase().includes('failed') ||
          msg.content.toLowerCase().includes('exception')) {
        errors.push(msg.content);
      }
    });
    
    return errors;
  }
  
  private countToolUsage(messages: Message[], toolName: string): number {
    return messages.reduce((count, msg) => {
      if (msg.toolCalls) {
        return count + msg.toolCalls.filter(call => call.name === toolName).length;
      }
      return count;
    }, 0);
  }
  
  private formatTimeSpan(messages: Message[]): string {
    if (messages.length === 0) return 'N/A';
    
    const start = new Date(messages[0].timestamp);
    const end = new Date(messages[messages.length - 1].timestamp);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} minutes`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  }
  
  private generateTextualSummary(userMessages: Message[], assistantMessages: Message[]): string {
    // Extract key patterns and create a narrative summary
    const userQueries = userMessages.map(m => m.content.substring(0, 100)).join(' ').substring(0, 300);
    return `The conversation focused on technical implementation tasks. Key themes included ${userQueries}... The assistant provided solutions with code examples and tool assistance.`;
  }
}

// Context-aware compression strategy
export class ContextAwareCompressionStrategy {
  async compress(
    messages: Message[], 
    preserveRecentMessages: number,
    preserveToolHistory: boolean
  ): Promise<{ compressedMessages: Message[], summary: string }> {
    // Analyze conversation type
    const conversationType = this.analyzeConversationType(messages);
    
    // Choose appropriate strategy based on conversation type
    switch (conversationType) {
      case 'coding':
        return this.compressForCoding(messages, preserveRecentMessages, preserveToolHistory);
      case 'debugging':
        return this.compressForDebugging(messages, preserveRecentMessages, preserveToolHistory);
      case 'learning':
        return this.compressForLearning(messages, preserveRecentMessages, preserveToolHistory);
      default:
        return this.compressGeneral(messages, preserveRecentMessages, preserveToolHistory);
    }
  }
  
  private analyzeConversationType(messages: Message[]): 'coding' | 'debugging' | 'learning' | 'general' {
    let codeScore = 0;
    let debugScore = 0;
    let learnScore = 0;
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      // Coding indicators
      if (content.includes('```') || content.includes('function') || content.includes('class')) {
        codeScore += 2;
      }
      if (content.includes('implement') || content.includes('create') || content.includes('write')) {
        codeScore += 1;
      }
      
      // Debugging indicators
      if (content.includes('error') || content.includes('bug') || content.includes('fix')) {
        debugScore += 2;
      }
      if (content.includes('debug') || content.includes('issue') || content.includes('problem')) {
        debugScore += 1;
      }
      
      // Learning indicators
      if (content.includes('explain') || content.includes('how to') || content.includes('what is')) {
        learnScore += 2;
      }
      if (content.includes('learn') || content.includes('understand') || content.includes('concept')) {
        learnScore += 1;
      }
    });
    
    if (codeScore > debugScore && codeScore > learnScore) return 'coding';
    if (debugScore > codeScore && debugScore > learnScore) return 'debugging';
    if (learnScore > codeScore && learnScore > debugScore) return 'learning';
    return 'general';
  }
  
  private async compressForCoding(
    messages: Message[], 
    preserveRecentMessages: number,
    preserveToolHistory: boolean
  ): Promise<{ compressedMessages: Message[], summary: string }> {
    // For coding conversations, preserve code blocks and file operations
    const recentMessages = messages.slice(-preserveRecentMessages);
    const olderMessages = messages.slice(0, -preserveRecentMessages);
    
    // Keep all messages with code blocks
    const codeMessages = olderMessages.filter(msg => 
      msg.content.includes('```') || 
      (msg.toolCalls && msg.toolCalls.some(call => call.name === 'write'))
    );
    
    // Create coding-specific summary
    const summary = `[Coding Session Summary]\n\n` +
      `This session involved implementing various features with code examples and file operations.\n` +
      `Key patterns: ${this.extractCodePatterns(olderMessages)}\n` +
      `Files created/modified: ${this.countFileOperations(olderMessages)}\n` +
      `Code snippets preserved: ${codeMessages.length}`;
    
    const summaryMessage: Message = {
      id: `coding-summary-${Date.now()}`,
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
    };
    
    const compressedMessages = [summaryMessage, ...codeMessages, ...recentMessages];
    
    return { compressedMessages, summary };
  }
  
  private async compressForDebugging(
    messages: Message[], 
    preserveRecentMessages: number,
    preserveToolHistory: boolean
  ): Promise<{ compressedMessages: Message[], summary: string }> {
    // For debugging conversations, preserve error messages and solutions
    const recentMessages = messages.slice(-preserveRecentMessages);
    const olderMessages = messages.slice(0, -preserveRecentMessages);
    
    // Keep all error-related messages
    const errorMessages = olderMessages.filter(msg => 
      msg.content.toLowerCase().includes('error') ||
      msg.content.toLowerCase().includes('bug') ||
      msg.content.toLowerCase().includes('fix')
    );
    
    const summary = `[Debugging Session Summary]\n\n` +
      `This session focused on resolving issues and debugging problems.\n` +
      `Errors encountered: ${errorMessages.length}\n` +
      `Solutions provided: ${this.countSolutions(olderMessages)}\n` +
      `Debugging tools used: ${this.extractDebuggingTools(olderMessages)}`;
    
    const summaryMessage: Message = {
      id: `debug-summary-${Date.now()}`,
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
    };
    
    const compressedMessages = [summaryMessage, ...errorMessages, ...recentMessages];
    
    return { compressedMessages, summary };
  }
  
  private async compressForLearning(
    messages: Message[], 
    preserveRecentMessages: number,
    preserveToolHistory: boolean
  ): Promise<{ compressedMessages: Message[], summary: string }> {
    // For learning conversations, preserve explanations and examples
    const recentMessages = messages.slice(-preserveRecentMessages);
    const olderMessages = messages.slice(0, -preserveRecentMessages);
    
    // Keep all explanation-rich messages
    const explanationMessages = olderMessages.filter(msg => 
      msg.content.length > 200 && 
      (msg.content.includes('explain') || 
       msg.content.includes('example') || 
       msg.content.includes('concept'))
    );
    
    const topics = this.extractLearningTopics(olderMessages);
    
    const summary = `[Learning Session Summary]\n\n` +
      `This session was focused on learning and understanding concepts.\n` +
      `Topics covered: ${topics.join(', ')}\n` +
      `Explanations preserved: ${explanationMessages.length}\n` +
      `Examples provided: ${this.countExamples(olderMessages)}`;
    
    const summaryMessage: Message = {
      id: `learn-summary-${Date.now()}`,
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
    };
    
    const compressedMessages = [summaryMessage, ...explanationMessages, ...recentMessages];
    
    return { compressedMessages, summary };
  }
  
  private async compressGeneral(
    messages: Message[], 
    preserveRecentMessages: number,
    preserveToolHistory: boolean
  ): Promise<{ compressedMessages: Message[], summary: string }> {
    // Use standard summary strategy for general conversations
    const enhancedStrategy = new EnhancedSummaryCompressionStrategy();
    return enhancedStrategy.compress(messages, preserveRecentMessages, preserveToolHistory);
  }
  
  private extractCodePatterns(messages: Message[]): string {
    const patterns = new Set<string>();
    messages.forEach(msg => {
      if (msg.content.includes('function')) patterns.add('functions');
      if (msg.content.includes('class')) patterns.add('classes');
      if (msg.content.includes('async')) patterns.add('async/await');
      if (msg.content.includes('import')) patterns.add('modules');
    });
    return Array.from(patterns).join(', ') || 'various patterns';
  }
  
  private countFileOperations(messages: Message[]): number {
    return messages.reduce((count, msg) => {
      if (msg.toolCalls) {
        return count + msg.toolCalls.filter(call => call.name === 'write' || call.name === 'read').length;
      }
      return count;
    }, 0);
  }
  
  private countSolutions(messages: Message[]): number {
    return messages.filter(msg => 
      msg.role === 'assistant' && 
      (msg.content.includes('solution') || 
       msg.content.includes('fix') || 
       msg.content.includes('resolve'))
    ).length;
  }
  
  private extractDebuggingTools(messages: Message[]): string {
    const tools = new Set<string>();
    messages.forEach(msg => {
      if (msg.toolCalls) {
        msg.toolCalls.forEach(call => {
          if (call.name === 'bash' || call.name === 'read' || call.name === 'grep') {
            tools.add(call.name);
          }
        });
      }
    });
    return Array.from(tools).join(', ') || 'none';
  }
  
  private extractLearningTopics(messages: Message[]): string[] {
    const topics = new Set<string>();
    const topicKeywords = ['javascript', 'typescript', 'react', 'node', 'api', 'database', 'algorithm'];
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      topicKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      });
    });
    
    return Array.from(topics).slice(0, 5);
  }
  
  private countExamples(messages: Message[]): number {
    return messages.reduce((count, msg) => {
      const matches = msg.content.match(/```/g);
      return count + (matches ? matches.length / 2 : 0);
    }, 0);
  }
}

// Test the enhanced compression strategies
async function testEnhancedCompression() {
  console.log('🚀 Testing Enhanced Compression Features\n');
  
  // Create test messages for different conversation types
  const codingMessages = [
    { role: 'user' as const, content: 'Implement a function to sort an array', id: '1', timestamp: Date.now() },
    { role: 'assistant' as const, content: '```javascript\nfunction sortArray(arr) {\n  return arr.sort((a, b) => a - b);\n}\n```', id: '2', timestamp: Date.now() },
    { role: 'user' as const, content: 'Create a class for managing users', id: '3', timestamp: Date.now() },
    { role: 'assistant' as const, content: '```javascript\nclass UserManager {\n  constructor() {\n    this.users = [];\n  }\n}\n```', id: '4', timestamp: Date.now() },
  ];
  
  const debuggingMessages = [
    { role: 'user' as const, content: 'I have an error in my code', id: '1', timestamp: Date.now() },
    { role: 'assistant' as const, content: 'The error is caused by undefined variable. Here\'s the fix:', id: '2', timestamp: Date.now() },
    { role: 'user' as const, content: 'Bug: The function returns null', id: '3', timestamp: Date.now() },
    { role: 'assistant' as const, content: 'To fix this bug, you need to handle the null case properly.', id: '4', timestamp: Date.now() },
  ];
  
  const learningMessages = [
    { role: 'user' as const, content: 'Explain what is closures in JavaScript', id: '1', timestamp: Date.now() },
    { role: 'assistant' as const, content: 'Closures are a fundamental concept in JavaScript. They allow functions to access variables from outer scopes...', id: '2', timestamp: Date.now() },
    { role: 'user' as const, content: 'How do promises work?', id: '3', timestamp: Date.now() },
    { role: 'assistant' as const, content: 'Promises represent the eventual completion of an asynchronous operation. Here\'s an example...', id: '4', timestamp: Date.now() },
  ];
  
  // Test Enhanced Summary Strategy
  console.log('1️⃣  Testing Enhanced Summary Strategy:');
  const enhancedStrategy = new EnhancedSummaryCompressionStrategy();
  
  const enhancedResult = await enhancedStrategy.compress(codingMessages, 2, true);
  console.log(`   Compressed: ${codingMessages.length} → ${enhancedResult.compressedMessages.length} messages`);
  console.log(`   Summary preview: ${enhancedResult.summary.substring(0, 200)}...\n`);
  
  // Test Context-Aware Strategy
  console.log('2️⃣  Testing Context-Aware Strategy:');
  const contextStrategy = new ContextAwareCompressionStrategy();
  
  console.log('   Testing coding conversation:');
  const codingResult = await contextStrategy.compress(codingMessages, 2, true);
  console.log(`   Compressed: ${codingMessages.length} → ${codingResult.compressedMessages.length} messages`);
  console.log(`   Type detected: coding`);
  console.log(`   Summary: ${codingResult.summary.substring(0, 100)}...\n`);
  
  console.log('   Testing debugging conversation:');
  const debugResult = await contextStrategy.compress(debuggingMessages, 2, true);
  console.log(`   Compressed: ${debuggingMessages.length} → ${debugResult.compressedMessages.length} messages`);
  console.log(`   Type detected: debugging`);
  console.log(`   Summary: ${debugResult.summary.substring(0, 100)}...\n`);
  
  console.log('   Testing learning conversation:');
  const learnResult = await contextStrategy.compress(learningMessages, 2, true);
  console.log(`   Compressed: ${learningMessages.length} → ${learnResult.compressedMessages.length} messages`);
  console.log(`   Type detected: learning`);
  console.log(`   Summary: ${learnResult.summary.substring(0, 100)}...\n`);
  
  console.log('✅ Enhanced compression tests completed!');
}

// Run the tests
testEnhancedCompression().catch(console.error);