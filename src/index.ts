import readline from 'readline';
import { getConfig } from './config.js';
import { initializeTools } from './tools/index.js';
import { SessionManager } from './session.js';
import { listSessions } from './storage.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🚀 Hello World OpenCode Agent');
  console.log('==============================\n');

  try {
    // 加载配置
    const config = getConfig();
    console.log(`✓ Config loaded`);
    console.log(`  Model: ${config.model}`);
    console.log(`  Base URL: ${config.baseUrl}\n`);

    // 初始化工具
    initializeTools();
    console.log();

    // 选择操作
    console.log('Options:');
    console.log('1. Create new session');
    console.log('2. Load existing session');
    console.log('3. Exit\n');

    const choice = await question('Select option (1-3): ');

    let sessionManager: SessionManager;

    if (choice === '1') {
      const title = await question('Session title: ');
      sessionManager = await SessionManager.create(title || 'New Session', config);
      console.log(`\n✓ Session created: ${sessionManager.getSession().id}\n`);
    } else if (choice === '2') {
      const sessions = await listSessions();
      if (sessions.length === 0) {
        console.log('No existing sessions found. Creating new session...');
        sessionManager = await SessionManager.create('New Session', config);
      } else {
        console.log('\nExisting sessions:');
        sessions.forEach((s, i) => {
          console.log(`${i + 1}. ${s.title} (${new Date(s.updatedAt).toLocaleString()})`);
        });
        const idx = parseInt(await question('\nSelect session (number): ')) - 1;
        const selected = sessions[idx];
        if (selected) {
          const loaded = await SessionManager.load(selected.id, config);
          if (loaded) {
            sessionManager = loaded;
            const msgCount = sessionManager.getSession().messages.length;
            console.log(`\n✓ Session loaded: ${sessionManager.getSession().title}`);
            console.log(`  Messages: ${msgCount} | Created: ${new Date(sessionManager.getSession().createdAt).toLocaleString()}\n`);
          } else {
            console.log('Failed to load session. Creating new session...');
            sessionManager = await SessionManager.create('New Session', config);
          }
        } else {
          sessionManager = await SessionManager.create('New Session', config);
        }
      }
    } else {
      console.log('Goodbye!');
      rl.close();
      return;
    }

    // 显示历史对话（如果是加载的会话）
    const session = sessionManager.getSession();
    if (session.messages.length > 0) {
      console.log('\n📜 Conversation History');
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const msg of session.messages) {
        if (msg.role === 'user') {
          console.log(`You: ${msg.content}\n`);
        } else if (msg.role === 'assistant') {
          console.log(`Assistant: ${msg.content}`);
          // 显示工具调用
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            for (const toolCall of msg.toolCalls) {
              console.log(`\n[Tool: ${toolCall.name}]`);
              // 显示工具结果
              const toolResult = msg.toolResults?.find(tr => tr.toolCallId === toolCall.id);
              if (toolResult) {
                console.log(toolResult.output.split('\n').slice(0, 10).join('\n'));
                if (toolResult.output.split('\n').length > 10) {
                  console.log('... (truncated)');
                }
              }
            }
          }
          console.log();
        }
      }

      console.log('═══════════════════════════════════════════════════════════\n');
    }

    // 显示当前上下文使用率
    const contextStatus = sessionManager.formatContextStatus();
    console.log(`${contextStatus}\n`);

    // 交互式对话循环
    console.log('💬 Interactive Mode');
    console.log('Commands: "exit" or "quit" to exit, "/history" to view history, "/clear" to clear screen\n');
    console.log(`Working directory: ${config.workingDir}\n`);

    while (true) {
      const input = await question('You: ');

      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye!');
        break;
      }

      if (input.toLowerCase() === '/history') {
        const session = sessionManager.getSession();
        if (session.messages.length === 0) {
          console.log('\n📜 No conversation history yet.\n');
        } else {
          console.log('\n📜 Conversation History');
          console.log('═══════════════════════════════════════════════════════════\n');

          let messageCount = 0;
          for (const msg of session.messages) {
            if (msg.role === 'user') {
              messageCount++;
              console.log(`[${messageCount}] You: ${msg.content}\n`);
            } else if (msg.role === 'assistant') {
              console.log(`[${messageCount}] Assistant: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
              if (msg.toolCalls && msg.toolCalls.length > 0) {
                console.log(`    [Used ${msg.toolCalls.length} tool(s)]`);
              }
              console.log();
            }
          }

          console.log(`═══════════════════════════════════════════════════════════`);
          console.log(`Total messages: ${session.messages.length} | Created: ${new Date(session.createdAt).toLocaleString()}`);
          
          // 显示上下文使用率
          const usage = sessionManager.getContextUsage();
          console.log(`Context: ${usage.usagePercentage}% (${usage.totalTokens.toLocaleString()}/${usage.contextLimit.toLocaleString()} tokens) | Input: ${usage.inputTokens.toLocaleString()} | Output: ${usage.outputTokens.toLocaleString()}`);
          
          console.log(`═══════════════════════════════════════════════════════════\n`);
        }
        continue;
      }

      if (input.toLowerCase() === '/clear') {
        console.clear();
        console.log('💬 Interactive Mode');
        console.log('Type "exit" or "quit" to exit, "/history" to view history\n');
        continue;
      }

      if (!input.trim()) {
        continue;
      }

      try {
        // 检查上下文警告
        const warning = sessionManager.checkContextWarning();
        if (warning) {
          console.log(`\n${warning}\n`);
        }

        // 添加用户消息
        await sessionManager.addUserMessage(input);

        // 处理消息
        console.log('\nAssistant: ');
        await sessionManager.processMessage();
        
        // 显示上下文使用率
        console.log(`\n${sessionManager.formatContextStatus()}\n`);
      } catch (error: any) {
        console.error(`\nError: ${error.message}\n`);
      }
    }

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    if (error.message.includes('GLM_API_KEY')) {
      console.log('\nPlease create a .env file with:');
      console.log('GLM_API_KEY=your-api-key');
      console.log('GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4');
      console.log('GLM_MODEL=glm-4.7');
    }
  } finally {
    rl.close();
  }
}

main();
