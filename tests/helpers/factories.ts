import { vi } from 'vitest';
import { Message, Config, Session, Tool, ToolContext } from '../../src/types.js'

/**
 * Test utilities and helpers for hello_world project
 */

// UUID generator for tests
export function generateTestId(): string {
  return `test-${Math.random().toString(36).substr(2, 9)}`
}

// Message factory
export function createTestMessage(overrides: Partial<Message> = {}): Message {
  const timestamp = Date.now()
  return {
    id: generateTestId(),
    role: 'user',
    content: 'Test message',
    timestamp,
    ...overrides
  }
}

export function createTestUserMessage(content: string = 'Test user message'): Message {
  return createTestMessage({
    role: 'user',
    content
  })
}

export function createTestAssistantMessage(
  content: string = 'Test assistant message',
  toolCalls?: any[]
): Message {
  return createTestMessage({
    role: 'assistant',
    content,
    toolCalls
  })
}

export function createTestToolMessage(
  toolCallId: string,
  toolName: string,
  output: string = 'Tool output'
): Message {
  return createTestMessage({
    role: 'tool',
    content: `[${toolName}]: ${output}`,
    toolResults: [{
      toolCallId,
      name: toolName,
      output
    }]
  })
}

// Config factory
export function createTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.com',
    model: 'test-model',
    workingDir: '/test/workdir',
    compression: {
      enabled: true,
      threshold: 75,
      strategy: 'summary',
      preserveToolHistory: true,
      preserveRecentMessages: 10,
      notifyBeforeCompression: true,
      ...overrides.compression
    },
    ...overrides
  }
}

// Session factory
export function createTestSession(overrides: Partial<Session> = {}): Session {
  const timestamp = Date.now()
  return {
    id: generateTestId(),
    title: 'Test Session',
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

export function createTestSessionWithMessages(
  messageCount: number = 5,
  overrides: Partial<Session> = {}
): Session {
  const messages: Message[] = []
  
  for (let i = 0; i < messageCount; i++) {
    if (i % 2 === 0) {
      messages.push(createTestUserMessage(`User message ${i + 1}`))
    } else {
      messages.push(createTestAssistantMessage(`Assistant message ${i + 1}`))
    }
  }
  
  return createTestSession({
    messages,
    ...overrides
  })
}

// Tool context factory
export function createTestToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sessionId: generateTestId(),
    messageId: generateTestId(),
    workingDir: '/test/workdir',
    ...overrides
  }
}

// Tool factory
export function createTestTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'test-tool',
    description: 'A test tool',
    parameters: {} as any,
    execute: vi.fn().mockResolvedValue({ output: 'Tool executed successfully' }),
    ...overrides
  }
}

// Create a valid Zod schema for testing
export function createTestToolSchema() {
  const { z } = require('zod');
  return z.object({
    action: z.string().optional(),
    data: z.any().optional()
  });
}

// Message collection factories for different test scenarios
export function createLongConversation(messageCount: number = 50): Message[] {
  const messages: Message[] = []
  
  for (let i = 0; i < messageCount; i++) {
    if (i % 3 === 0) {
      messages.push(createTestUserMessage(`This is a longer user message ${i + 1} with more content to simulate real conversations.`))
    } else if (i % 3 === 1) {
      messages.push(createTestAssistantMessage(
        `This is a detailed assistant response ${i + 1} with helpful information and maybe some code examples.\n\n\`\`\`javascript\nconsole.log('Example code ${i + 1}');\n\`\`\``
      ))
    } else {
      // Add tool calls occasionally
      messages.push(createTestAssistantMessage(
        `I'll help you with that ${i + 1}`,
        [{
          id: generateTestId(),
          name: 'test-tool',
          arguments: { action: 'execute', index: i + 1 }
        }]
      ))
      messages.push(createTestToolMessage(
        generateTestId(),
        'test-tool',
        `Tool execution result ${i + 1} completed successfully.`
      ))
    }
  }
  
  return messages
}

export function createConversationWithCodeBlocks(): Message[] {
  return [
    createTestUserMessage('Can you help me write a function?'),
    createTestAssistantMessage(
      `Here's a function that might help:\n\n\`\`\`javascript\nfunction testFunction() {\n  return 'Hello, World!';\n}\n\`\`\`\n\nThis function returns a greeting.`
    ),
    createTestUserMessage('Can you add TypeScript types?'),
    createTestAssistantMessage(
      `Sure! Here's the TypeScript version:\n\n\`\`\`typescript\nfunction testFunction(): string {\n  return 'Hello, World!';\n}\n\`\`\`\n\nNow it has proper type annotations.`
    ),
    createTestUserMessage('What about error handling?'),
    createTestAssistantMessage(
      `Here's a version with error handling:\n\n\`\`\`typescript\nfunction testFunction(): string {\n  try {\n    return 'Hello, World!';\n  } catch (error) {\n    console.error('An error occurred:', error);\n    return 'Error occurred';\n  }\n}\n\`\`\``
    )
  ]
}

export function createConversationWithErrors(): Message[] {
  return [
    createTestUserMessage('I\'m getting an error in my code'),
    createTestAssistantMessage('What error are you seeing?'),
    createTestUserMessage('Error: Cannot read property \'undefined\' of null'),
    createTestAssistantMessage(
      `This error typically occurs when trying to access a property on a null or undefined value. Here's how to fix it:\n\n\`\`\`javascript\n// Before (causes error)\nconst result = data.property;\n\n// After (safe access)\nconst result = data?.property;\n\n// Or with explicit check\nconst result = data && data.property;\n\`\`\``
    ),
    createTestUserMessage('That fixed it, thank you!')
  ]
}

// Performance test helpers
export function createLargeMessage(contentLength: number): Message {
  const content = 'A'.repeat(contentLength)
  return createTestMessage({
    content,
    role: 'assistant'
  })
}

export function createLargeSession(messageCount: number, messageSize: number = 1000): Session {
  const messages: Message[] = []
  
  for (let i = 0; i < messageCount; i++) {
    const content = 'A'.repeat(messageSize)
    messages.push(createTestMessage({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `${content} - Message ${i + 1}`
    }))
  }
  
  return createTestSession({ messages })
}

// Compression test helpers
export function createCompressionTestScenarios() {
  return {
    shortConversation: createTestSessionWithMessages(5),
    mediumConversation: createTestSessionWithMessages(20),
    longConversation: createTestSessionWithMessages(100),
    veryLongConversation: createTestSessionWithMessages(500),
    conversationWithCode: createTestSession({ messages: createConversationWithCodeBlocks() }),
    conversationWithErrors: createTestSession({ messages: createConversationWithErrors() }),
    conversationWithToolCalls: createTestSession({
      messages: [
        createTestUserMessage('Execute a tool for me'),
        createTestAssistantMessage(
          'I\'ll execute that tool for you',
          [{ id: 'tool-1', name: 'test-tool', arguments: { action: 'run' } }]
        ),
        createTestToolMessage('tool-1', 'test-tool', 'Tool executed successfully'),
        createTestAssistantMessage('The tool has been executed successfully')
      ]
    })
  }
}

// Async test helpers
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createMockStreamResponse(chunks: string[]) {
  return async function* () {
    for (const chunk of chunks) {
      await delay(10) // Simulate network delay
      yield { content: chunk }
    }
  }
}

// File system helpers
export function createMockFileStructure() {
  return {
    '/test/workdir': {
      type: 'directory',
      children: {
        'test.txt': { type: 'file', content: 'Test file content' },
        'src': {
          type: 'directory',
          children: {
            'index.ts': { type: 'file', content: 'export const test = true;' }
          }
        }
      }
    }
  }
}