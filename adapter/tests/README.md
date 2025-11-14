# Claude CLI Adapter Test Suite

Comprehensive test suite for the FREE mode Claude CLI adapter, validating all functionality without requiring an Anthropic API key.

## Table of Contents

- [Overview](#overview)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Coverage Requirements](#coverage-requirements)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

This test suite validates the Claude Code CLI adapter in FREE mode, ensuring all core functionality works without requiring an API key. The tests are designed to:

- ✅ Run fast (< 30 seconds total)
- ✅ Require no external dependencies (API keys, services)
- ✅ Provide comprehensive coverage (> 70%)
- ✅ Use temporary directories (auto-cleanup)
- ✅ Test security features (path validation, injection prevention)

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Or with yarn
yarn install
```

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests verbosely (show individual test names)
npm run test:verbose

# Run tests in CI mode
npm run test:ci
```

### Running Specific Tests

```bash
# Run a specific test file
npm test -- file-operations.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should read files"

# Run tests in a specific directory
npm test -- tests/unit/tools

# Run with debugging output
npm test -- --verbose --no-coverage
```

## Test Structure

```
adapter/tests/
├── unit/                          # Unit tests
│   ├── tools/                     # Tool-specific tests
│   │   ├── file-operations.test.ts
│   │   ├── code-search.test.ts
│   │   └── terminal.test.ts
│   ├── adapter/                   # Adapter tests
│   │   └── claude-cli-adapter.test.ts
│   └── agents/                    # Agent template tests
│       └── agent-templates.test.ts
├── integration/                   # Integration tests (future)
├── utils/                         # Test utilities
│   └── test-helpers.ts
├── setup/                         # Test configuration
│   └── test-setup.ts
├── jest.config.js                 # Jest configuration
└── README.md                      # This file
```

### Test Categories

#### Unit Tests (`tests/unit/`)

Test individual components in isolation:

- **Tools** - File operations, code search, terminal execution
- **Adapter** - Main adapter class, factories, helpers
- **Agents** - Agent templates and definitions

#### Integration Tests (`tests/integration/`)

Test multiple components working together:

- End-to-end agent execution flows
- Tool composition scenarios
- Real-world use cases

## Writing Tests

### Test Template

```typescript
import { ToolClass } from '../../../src/tools/tool-name'
import {
  createTestDir,
  createTestFiles,
  assertToolSuccess,
  getToolResultValue,
} from '../../utils/test-helpers'

describe('ToolClass', () => {
  let tool: ToolClass
  let testDir: string

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await createTestDir('tool-test-')
    tool = new ToolClass(testDir)
  })

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      await createTestFiles(testDir, {
        'test.txt': 'content',
      })

      // Act
      const result = await tool.method()

      // Assert
      assertToolSuccess(result)
      const value = getToolResultValue(result)
      expect(value).toBeDefined()
    })
  })
})
```

### Best Practices

1. **Use Descriptive Test Names**
   ```typescript
   // Good
   it('should read multiple files in parallel efficiently')

   // Bad
   it('test read files')
   ```

2. **Follow AAA Pattern** (Arrange, Act, Assert)
   ```typescript
   it('should do something', async () => {
     // Arrange - Setup test data
     await createTestFiles(testDir, { 'file.txt': 'content' })

     // Act - Execute the operation
     const result = await tool.readFile('file.txt')

     // Assert - Verify the result
     expect(result).toBe('content')
   })
   ```

3. **Test Error Cases**
   ```typescript
   it('should handle non-existent files gracefully', async () => {
     const result = await tool.readFile('missing.txt')
     expect(result).toBeNull()
   })
   ```

4. **Test Security**
   ```typescript
   it('should prevent path traversal attacks', async () => {
     const result = await tool.readFile('../../../etc/passwd')
     expect(result).toBeNull()
   })
   ```

5. **Use Test Helpers**
   ```typescript
   import {
     createTestDir,
     createTestFiles,
     createMockAdapter,
     assertToolSuccess,
   } from '../../utils/test-helpers'
   ```

### Available Test Helpers

#### Directory Utilities

- `createTestDir(prefix?)` - Create temporary test directory
- `cleanupTestDir(dir)` - Clean up test directory
- `createTestFiles(dir, files)` - Create multiple test files
- `readTestFile(dir, path)` - Read test file content
- `testFileExists(dir, path)` - Check if file exists

#### Mock Utilities

- `createMockAdapter(cwd?, config?)` - Create mock adapter
- `createMockAgent(overrides?)` - Create mock agent definition
- `createMockAgentWithSteps(fn, overrides?)` - Create agent with handleSteps
- `createMockToolExecutor(results?)` - Create mock tool executor
- `createMockLLMExecutor(responses?)` - Create mock LLM executor

#### Assertion Helpers

- `assertToolSuccess(result)` - Assert tool succeeded
- `assertToolError(result)` - Assert tool had error
- `getToolResultValue(result)` - Extract JSON value from result

#### Project Utilities

- `createMockProject(dir)` - Create realistic project structure

## Coverage Requirements

The test suite enforces minimum coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Reports

Coverage reports are generated in multiple formats:

- **Text** - Terminal output
- **LCOV** - `coverage/lcov.info` (for CI tools)
- **HTML** - `coverage/lcov-report/` (for browsing)
- **JSON** - `coverage/coverage-summary.json`

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### GitLab CI

```yaml
test:
  image: node:18
  script:
    - npm ci
    - npm run test:ci
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

### Jenkins

```groovy
stage('Test') {
  steps {
    sh 'npm ci'
    sh 'npm run test:ci'
  }
  post {
    always {
      publishHTML([
        reportDir: 'coverage/lcov-report',
        reportFiles: 'index.html',
        reportName: 'Coverage Report'
      ])
    }
  }
}
```

## Troubleshooting

### Tests Timing Out

If tests are timing out, increase the timeout:

```typescript
// In individual test
it('slow test', async () => {
  // ...
}, 10000) // 10 second timeout

// Or globally in jest.config.js
testTimeout: 30000
```

### Tests Failing in CI but Passing Locally

Common causes:

1. **Different Node.js version** - Check Node.js version matches
2. **Missing dependencies** - Ensure `npm ci` is used, not `npm install`
3. **File system differences** - Use `path.join()` instead of string concatenation
4. **Timezone issues** - Avoid hardcoding dates/times

### Temp Directory Cleanup Issues

If temp directories aren't being cleaned up:

```typescript
// Manually clean up in afterEach
afterEach(async () => {
  await cleanupTestDir(testDir)
})
```

### Coverage Not Meeting Threshold

To identify uncovered code:

```bash
# Run with coverage
npm run test:coverage

# Check coverage report
open coverage/lcov-report/index.html

# Look for red/yellow lines in the HTML report
```

### TypeScript Errors in Tests

Ensure `tsconfig.json` includes test files:

```json
{
  "compilerOptions": {
    "types": ["jest", "node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

### Mock Issues

If mocks aren't working:

```typescript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})

// Or in jest.config.js
clearMocks: true
```

## Performance Tips

### Speed Up Tests

1. **Run tests in parallel** (default in Jest)
2. **Skip expensive setup** when not needed
3. **Use `--onlyChanged`** to test only modified files
4. **Disable coverage** when not needed (`npm test -- --no-coverage`)

```bash
# Fast iteration during development
npm test -- --watch --onlyChanged --no-coverage
```

### Optimize Test Data

```typescript
// Bad - Creates many files every test
beforeEach(async () => {
  for (let i = 0; i < 1000; i++) {
    await createFile(`file-${i}.txt`)
  }
})

// Good - Only create what you need
beforeEach(async () => {
  await createTestFiles(testDir, {
    'essential.txt': 'content',
  })
})
```

## Adding New Tests

When adding a new feature:

1. **Create test file** - Follow naming convention `*.test.ts`
2. **Import helpers** - Use test utilities from `test-helpers.ts`
3. **Write tests first** (TDD) or alongside implementation
4. **Run tests** - `npm run test:watch`
5. **Check coverage** - `npm run test:coverage`
6. **Update this README** if adding new test utilities

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)

## Support

For questions or issues:

1. Check this README
2. Look at existing tests for examples
3. Check Jest documentation
4. Ask the team

---

**Last Updated**: 2025-11-14
