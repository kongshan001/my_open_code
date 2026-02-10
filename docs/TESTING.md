# Testing Documentation

This document provides comprehensive information about the testing framework and practices used in the hello_world project.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Types](#test-types)
- [Test Utilities](#test-utilities)
- [Coverage](#coverage)
- [Performance Testing](#performance-testing)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The hello_world project uses a comprehensive testing strategy to ensure reliability, performance, and maintainability. Our testing framework is built on Vitest and includes:

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test how different components work together
- **Performance Tests**: Ensure the application meets performance benchmarks
- **Compression Feature Tests**: Validate compression strategies and functionality
- **Memory Leak Tests**: Detect and prevent memory leaks
- **Type Checking**: Ensure TypeScript type safety

## Test Structure

```
tests/
├── unit/                   # Unit tests for individual modules
│   ├── token.test.ts      # Token estimation and context usage
│   ├── compression.test.ts # Compression strategies and manager
│   ├── session.test.ts    # Session management
│   ├── config.test.ts     # Configuration loading
│   └── storage.test.ts    # File system operations
├── integration/           # Integration tests
│   ├── session-compression.test.ts # Session and compression integration
│   └── llm.test.ts        # LLM integration
├── performance/           # Performance tests
│   └── performance.test.ts # Performance benchmarks and stress tests
├── helpers/              # Test utilities and factories
│   ├── setup.ts          # Global test setup
│   ├── factories.ts      # Test data factories
│   └── mocks.ts          # Mock implementations
└── fixtures/             # Test data and fixtures
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests once
npm run test:run

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:performance

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Advanced Options

```bash
# Run tests matching a pattern
npm test -- --grep "compression"

# Run tests in specific file
npm test tests/unit/compression.test.ts

# Run tests with verbose output
npm test -- --verbose

# Run tests with custom reporter
npm test -- --reporter=verbose
```

## Test Types

### Unit Tests

Unit tests focus on testing individual functions and components in isolation. They are fast, focused, and help ensure that each piece of code works correctly on its own.

**Example: Testing Token Estimation**

```typescript
import { estimateTokens } from '../../src/token.js'

describe('estimateTokens', () => {
  it('should estimate tokens for short text', () => {
    const text = 'Hello world'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(10)
  })
})
```

### Integration Tests

Integration tests verify that different components work together correctly. They test the interactions between modules and ensure the overall system behaves as expected.

**Example: Session and Compression Integration**

```typescript
describe('Session-Compression Integration', () => {
  it('should automatically trigger compression when context limit is approached', async () => {
    // Test scenario with many messages
    const sessionManager = createSessionManager()
    
    // Add many messages to approach context limit
    for (const message of longConversation) {
      await sessionManager.addUserMessage(message.content)
      await sessionManager.processMessage()
    }
    
    // Verify compression was triggered
    expect(sessionManager.getSession().lastCompression).toBeDefined()
  })
})
```

### Performance Tests

Performance tests ensure that the application meets performance benchmarks and doesn't degrade over time. They measure execution time, memory usage, and throughput.

**Example: Compression Performance**

```typescript
it('should compress large conversations efficiently', async () => {
  const largeConversation = createLongConversation(100)
  const startTime = Date.now()
  
  const result = await compressionManager.compress(
    largeConversation,
    config,
    'test-model'
  )
  
  const endTime = Date.now()
  const compressionTime = endTime - startTime
  
  expect(compressionTime).toBeLessThan(5000) // Should complete within 5 seconds
  expect(result.compressed).toBe(true)
})
```

## Test Utilities

### Factories

Test factories provide convenient ways to create test data:

```typescript
import { 
  createTestSession,
  createTestConfig,
  createTestMessage,
  createLongConversation 
} from '../helpers/factories.js'

// Create a test session
const session = createTestSession({
  title: 'Test Session',
  messages: [createTestMessage({ content: 'Hello' })]
})

// Create test configuration
const config = createTestConfig({
  compression: { enabled: true, threshold: 75 }
})
```

### Mocks

Mocks provide controlled test environments:

```typescript
import { mockAI, mockFs } from '../helpers/mocks.js'

// Mock AI SDK
vi.mock('ai', () => mockAI)

// Mock file system
vi.mock('fs', () => mockFs)
```

### Test Scenarios

Predefined test scenarios for common use cases:

```typescript
import { createCompressionTestScenarios } from '../helpers/factories.js'

const scenarios = createCompressionTestScenarios()
// Returns object with various conversation types:
// - shortConversation
// - mediumConversation
// - longConversation
// - conversationWithCode
// - conversationWithErrors
```

## Coverage

### Coverage Goals

We aim for high test coverage across all modules:

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 95%
- **Lines**: > 90%

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in HTML format
open coverage/index.html
```

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    'node_modules/',
    'dist/',
    'tests/',
    '**/*.d.ts',
    '**/*.config.*'
  ]
}
```

## Performance Testing

### Benchmarks

We maintain performance benchmarks for key operations:

- **Message Addition**: < 50ms per message
- **Message Processing**: < 200ms per message
- **Compression**: < 1000ms per compression
- **Context Usage Calculation**: < 10ms

### Stress Tests

Stress tests verify system behavior under extreme load:

- **Large Conversations**: 1000+ messages
- **Rapid Operations**: Concurrent message additions
- **Memory Usage**: Long-running operations
- **Compression Cycles**: Repeated compressions

### Performance Regression Testing

Automated performance regression tests in CI/CD:

```yaml
- name: Check performance thresholds
  run: |
    node -e "
    const results = JSON.parse(require('fs').readFileSync('performance-results.json', 'utf8'));
    
    const thresholds = {
      messageAdd: 50,
      messageProcess: 200,
      compression: 1000,
      contextUsage: 10
    };
    
    // Validate against thresholds
    "
```

## Compression Feature Testing

### Strategy Testing

Each compression strategy is thoroughly tested:

```typescript
describe('Compression Strategies', () => {
  const strategies = ['summary', 'sliding-window', 'importance']
  
  strategies.forEach(strategy => {
    it(`should handle ${strategy} strategy correctly`, async () => {
      const result = await compressionManager.compress(
        messages,
        { ...config, strategy },
        'test-model'
      )
      
      expect(result.strategy).toBe(strategy)
      expect(result.compressed).toBeDefined()
    })
  })
})
```

### Feature Validation

Compression features are tested comprehensively:

- **Triggering Conditions**: Correct threshold-based activation
- **Preservation Rules**: Tool history, recent messages
- **Quality Metrics**: Reduction percentages, token counts
- **Error Handling**: Graceful failure recovery

## CI/CD Integration

### GitHub Actions Workflow

Our CI/CD pipeline includes:

1. **Lint and Format Check**: Code quality validation
2. **Unit Tests**: Fast feedback on code changes
3. **Integration Tests**: Component interaction validation
4. **Performance Tests**: Performance regression detection
5. **Coverage Reporting**: Code coverage tracking
6. **Security Audit**: Dependency vulnerability scanning
7. **Build Verification**: Successful compilation and packaging

### Test Matrix

Tests run across multiple Node.js versions:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]
    test-type: [unit, integration, performance]
```

### Artifact Management

Test artifacts are stored for analysis:

- **Coverage Reports**: HTML and JSON coverage data
- **Test Results**: Detailed test execution reports
- **Performance Metrics**: Performance benchmark data
- **Build Outputs**: Compiled JavaScript and TypeScript declarations

## Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Structure tests with clear setup, action, and assertion phases
3. **Test Isolation**: Ensure tests don't depend on each other
4. **Mock Appropriately**: Mock external dependencies but avoid over-mocking
5. **Edge Cases**: Test edge cases and error conditions

### Test Organization

1. **Logical Grouping**: Group related tests with `describe` blocks
2. **Factory Usage**: Use factories for consistent test data
3. **Reusable Utilities**: Share common test utilities across test files
4. **Clear Comments**: Document complex test scenarios

### Performance Testing

1. **Realistic Scenarios**: Test with realistic data volumes
2. **Multiple Runs**: Run performance tests multiple times for accuracy
3. **Baseline Comparison**: Compare against known good baselines
4. **Resource Monitoring**: Monitor memory and CPU usage

### CI/CD Best Practices

1. **Fast Feedback**: Run quick tests first for faster feedback
2. **Parallel Execution**: Run tests in parallel when possible
3. **Artifact Storage**: Store test artifacts for debugging
4. **Fail Fast**: Configure pipelines to fail fast on critical issues

## Troubleshooting

### Common Issues

#### Test Timeouts

```bash
# Increase timeout for specific tests
npm test -- --timeout=10000

# Or configure in vitest.config.ts
testTimeout: 30000
```

#### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

#### Mock Failures

```typescript
// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

// Reset modules if needed
beforeEach(() => {
  vi.resetModules()
})
```

### Debugging Tests

#### Running Single Tests

```bash
# Run specific test file
npm test tests/unit/compression.test.ts

# Run specific test
npm test -- --grep "should compress large conversations"
```

#### Debug Output

```bash
# Run with verbose output
npm test -- --verbose

# Add console.log for debugging
console.log('Debug info:', testData)
```

#### Test UI

```bash
# Run with Vitest UI for visual debugging
npm run test:ui
```

### Performance Debugging

#### Memory Profiling

```bash
# Run with memory profiling
node --inspect --expose-gc node_modules/.bin/vitest run

# Generate heap snapshots
node --heap-prof tests/performance/performance.test.ts
```

#### Performance Metrics

```typescript
// Add performance measurements
const startTime = performance.now()
await operation()
const endTime = performance.now()
console.log(`Operation took ${endTime - startTime} milliseconds`)
```

## Contributing

When adding new features:

1. **Write Tests First**: Test-driven development approach
2. **Cover All Cases**: Include success, failure, and edge cases
3. **Update Documentation**: Keep this documentation current
4. **Performance Impact**: Consider performance implications
5. **CI/CD Updates**: Update CI/CD pipeline if needed

## Conclusion

This testing framework ensures the hello_world project maintains high quality, performance, and reliability. Regular testing helps catch issues early, prevents regressions, and provides confidence in the codebase.

For questions or suggestions about testing, please open an issue or contact the development team.