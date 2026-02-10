import { SessionManager } from '../../src/session.js';
import { getConfig } from '../../src/config.js';
import { Message } from '../../src/types.js';

async function triggerCompressionTest() {
  console.log('🚀 Triggering Compression with High Token Count\n');
  
  const config = getConfig();
  const sessionManager = await SessionManager.create('High Token Test', config);
  
  console.log(`✓ Session created\n`);
  
  // Create messages with long content to reach the threshold faster
  console.log('Generating messages with long content...\n');
  
  for (let i = 0; i < 150; i++) {
    // User message with long content
    const userContent = `I need help with task #${i + 1}. This is a complex problem that requires a comprehensive solution. 

The requirements are:
1. Implement a scalable architecture
2. Ensure high performance
3. Add comprehensive error handling
4. Include unit tests
5. Document everything properly
6. Consider security implications
7. Optimize for production use
8. Make it maintainable for future developers

Please provide detailed code examples, explanations, and best practices for each step. The solution should be production-ready and follow industry standards.

Additional context: This will be used in a high-traffic environment with thousands of concurrent users, so performance and scalability are critical. We need to handle edge cases properly and implement proper monitoring and logging.

The codebase currently uses modern JavaScript/TypeScript, React for the frontend, Node.js for the backend, and PostgreSQL for the database. We're using Docker for containerization and Kubernetes for orchestration.

Please consider all these factors when providing your solution.`;
    
    const userMessage: Message = {
      id: `user-${i}`,
      role: 'user',
      content: userContent,
      timestamp: Date.now() - (150 - i) * 1000
    };
    
    sessionManager.getSession().messages.push(userMessage);
    
    // Assistant message with code and explanations
    const assistantContent = `I'll help you implement task #${i + 1} with a comprehensive solution.

## Architecture Design

For this high-traffic, scalable system, I recommend a microservices architecture:

\`\`\`typescript
// Main service interface
interface ServiceInterface {
  initialize(): Promise<void>;
  process(data: RequestData): Promise<ResponseData>;
  cleanup(): Promise<void>;
}

// Base implementation
abstract class BaseService implements ServiceInterface {
  protected logger: Logger;
  protected metrics: MetricsCollector;
  protected config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
    this.logger = new Logger(this.constructor.name);
    this.metrics = new MetricsCollector();
  }
  
  abstract initialize(): Promise<void>;
  abstract process(data: RequestData): Promise<ResponseData>;
  
  async cleanup(): Promise<void> {
    await this.logger.flush();
    await this.metrics.flush();
  }
}
\`\`\`

## Implementation Details

### Performance Optimization

\`\`\`typescript
// Optimized data processing
class DataProcessor extends BaseService {
  private cache: LRUCache<string, ProcessedData>;
  private queue: PriorityQueue<Task>;
  
  async initialize(): Promise<void> {
    this.cache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
    
    this.queue = new PriorityQueue({
      concurrency: 10,
      timeout: 30000
    });
  }
  
  async process(data: RequestData): Promise<ResponseData> {
    // Check cache first
    const cacheKey = this.generateCacheKey(data);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.increment('cache_hit');
      return cached;
    }
    
    // Process with error handling
    try {
      const result = await this.queue.add(() => 
        this.processInternal(data)
      );
      
      // Cache the result
      this.cache.set(cacheKey, result);
      this.metrics.increment('process_success');
      
      return result;
    } catch (error) {
      this.logger.error('Processing failed', error);
      this.metrics.increment('process_error');
      throw new ProcessingError(error.message);
    }
  }
  
  private async processInternal(data: RequestData): Promise<ResponseData> {
    // Complex processing logic here
    const processed = await this.transform(data);
    const validated = await this.validate(processed);
    const optimized = await this.optimize(validated);
    
    return optimized;
  }
}
\`\`\`

### Error Handling Strategy

\`\`\`typescript
// Comprehensive error handling
class ErrorHandler {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  
  async handle<T>(operation: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(operation);
    });
  }
  
  private classifyError(error: Error): ErrorType {
    if (error instanceof NetworkError) return ErrorType.TRANSIENT;
    if (error instanceof ValidationError) return ErrorType.CLIENT;
    return ErrorType.SERVER;
  }
}
\`\`\`

## Testing Strategy

### Unit Tests

\`\`\`typescript
describe('DataProcessor', () => {
  let processor: DataProcessor;
  let mockConfig: ServiceConfig;
  
  beforeEach(async () => {
    mockConfig = createMockConfig();
    processor = new DataProcessor(mockConfig);
    await processor.initialize();
  });
  
  afterEach(async () => {
    await processor.cleanup();
  });
  
  it('should process data correctly', async () => {
    const data = createMockRequestData();
    const result = await processor.process(data);
    
    expect(result).toBeDefined();
    expect(result.isValid).toBe(true);
  });
  
  it('should handle cache correctly', async () => {
    const data = createMockRequestData();
    
    // First call
    const result1 = await processor.process(data);
    
    // Second call should use cache
    const result2 = await processor.process(data);
    
    expect(result1).toEqual(result2);
  });
});
\`\`\`

### Integration Tests

\`\`\`typescript
describe('Service Integration', () => {
  let app: Application;
  let client: TestClient;
  
  beforeAll(async () => {
    app = await createTestApp();
    client = new TestClient(app);
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('should handle end-to-end flow', async () => {
    const response = await client.post('/api/process', {
      data: createTestData()
    });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
\`\`\`

## Monitoring and Logging

### Metrics Collection

\`\`\`typescript
// Custom metrics
const requestDuration = new Histogram({
  name: 'request_duration_seconds',
  help: 'Duration of requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const errorRate = new Gauge({
  name: 'error_rate',
  help: 'Current error rate',
  labelNames: ['service', 'error_type']
});
\`\`\`

## Security Considerations

1. Input validation and sanitization
2. Rate limiting
3. Authentication and authorization
4. Data encryption
5. Audit logging

## Deployment Configuration

\`\`\`yaml
# Docker configuration
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
\`\`\`

This comprehensive solution addresses all your requirements for a production-ready, scalable system.`;
    
    const assistantMessage: Message = {
      id: `assistant-${i}`,
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now() - (150 - i) * 1000,
      toolCalls: i % 3 === 0 ? [{
        id: `tool-${i}`,
        name: 'write',
        args: {
          filePath: `src/service${i}.ts`,
          content: '// Service implementation'
        }
      }] : undefined,
      toolResults: i % 3 === 0 ? [{
        toolCallId: `tool-${i}`,
        output: `File src/service${i}.ts created successfully with comprehensive implementation`
      }] : undefined
    };
    
    sessionManager.getSession().messages.push(assistantMessage);
    
    // Check compression more frequently with this dense content
    if ((i + 1) % 10 === 0) {
      console.log(`\n--- After ${i + 1} messages ---`);
      console.log(sessionManager.formatContextStatus());
      
      const compressionResult = await sessionManager.checkAndPerformCompression();
      if (compressionResult?.compressed) {
        console.log(`📦 ${compressionResult.message}`);
        console.log(`   Strategy: ${compressionResult.strategy}`);
        console.log(`   Reduction: ${compressionResult.reductionPercentage}%`);
        
        if (compressionResult.summary) {
          console.log(`   Summary: ${compressionResult.summary.substring(0, 150)}...`);
        }
      }
    }
  }
  
  // Final compression attempt
  console.log('\n\n=== Final Compression Check ===');
  const finalCompression = await sessionManager.checkAndPerformCompression();
  if (finalCompression?.compressed) {
    console.log(`✅ Final compression: ${finalCompression.message}\n`);
  }
  
  // Show final state
  console.log('=== Final State ===');
  console.log(sessionManager.formatContextStatus());
  
  const lastCompression = sessionManager.getLastCompressionResult();
  if (lastCompression?.compressed) {
    console.log(`\nCompression Statistics:`);
    console.log(`  Total compressions: Multiple`);
    console.log(`  Last strategy: ${lastCompression.strategy}`);
    console.log(`  Last reduction: ${lastCompression.reductionPercentage}%`);
  }
  
  console.log('\n✅ High token compression test completed!');
}

triggerCompressionTest().catch(console.error);