# HandleStepsExecutor Architecture

## Overview

The HandleStepsExecutor is the core engine that drives agent execution by managing the lifecycle of generator functions defined in agent `handleSteps`.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     HandleStepsExecutor                         │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  execute(agentDef, context, toolExecutor, llmExecutor) │   │
│  └──────────────────┬─────────────────────────────────────┘   │
│                     │                                           │
│                     ▼                                           │
│  ┌────────────────────────────────────────────────────────┐   │
│  │        Initialize Generator with Context               │   │
│  │   generator = agentDef.handleSteps(context)            │   │
│  └──────────────────┬─────────────────────────────────────┘   │
│                     │                                           │
│                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                Execution Loop                            │  │
│  │          (while iteration < maxIterations)               │  │
│  │                                                          │  │
│  │  1. Get next yield: generator.next({                    │  │
│  │       agentState, toolResult, stepsComplete             │  │
│  │     })                                                   │  │
│  │                                                          │  │
│  │  2. Process yielded value:                              │  │
│  │     ┌─────────────────────────────────────────────┐    │  │
│  │     │  ToolCall?                                   │    │  │
│  │     │  ├─ Execute via toolExecutor                │    │  │
│  │     │  └─ Capture result for next iteration       │    │  │
│  │     │                                              │    │  │
│  │     │  'STEP'?                                     │    │  │
│  │     │  ├─ Execute single LLM turn via llmExecutor │    │  │
│  │     │  └─ Check endTurn flag                      │    │  │
│  │     │                                              │    │  │
│  │     │  'STEP_ALL'?                                 │    │  │
│  │     │  ├─ Execute LLM until completion             │    │  │
│  │     │  └─ Mark stepsComplete = true               │    │  │
│  │     │                                              │    │  │
│  │     │  StepText?                                   │    │  │
│  │     │  ├─ Call textOutputHandler                  │    │  │
│  │     │  └─ Add to message history                  │    │  │
│  │     └─────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  3. Update state for next iteration                     │  │
│  │                                                          │  │
│  │  4. Check termination conditions:                       │  │
│  │     - Generator done?                                   │  │
│  │     - stepsComplete and shouldTerminate?                │  │
│  │     - Max iterations reached?                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                     │                                           │
│                     ▼                                           │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Return ExecutionResult                     │   │
│  │  {                                                      │   │
│  │    agentState,                                          │   │
│  │    iterationCount,                                      │   │
│  │    completedNormally,                                   │   │
│  │    error?                                               │   │
│  │  }                                                      │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Initialization

```typescript
context: AgentStepContext {
  agentState: { agentId, runId, messageHistory, output }
  prompt: string
  params: Record<string, any>
  logger: Logger
}
```

### 2. Generator Iteration

Each iteration passes updated state back to the generator:

```typescript
const { value, done } = generator.next({
  agentState: updatedAgentState,
  toolResult: lastToolResult,
  stepsComplete: stepsComplete
})
```

### 3. Yield Processing

The executor handles four types of yields:

#### ToolCall
```typescript
yield {
  toolName: 'read_files',
  input: { paths: ['file.txt'] }
}
// → Execute tool via toolExecutor
// → Capture result in toolResult
// → Continue iteration
```

#### 'STEP'
```typescript
yield 'STEP'
// → Execute single LLM turn via llmExecutor
// → Get { endTurn, agentState }
// → Update stepsComplete if endTurn
// → Continue or terminate based on endTurn
```

#### 'STEP_ALL'
```typescript
yield 'STEP_ALL'
// → Execute LLM until completion via llmExecutor
// → Set stepsComplete = true
// → Terminate execution
```

#### StepText
```typescript
yield { type: 'STEP_TEXT', text: 'Processing...' }
// → Call textOutputHandler with text
// → Add to messageHistory
// → Continue iteration
```

## State Management

### Agent State Evolution

```
Initial State
    ↓
Generator Start
    ↓
[ToolCall] → Tool Execution → Updated State (with special handling for set_output)
    ↓
[STEP] → LLM Turn → Updated State (with new messages)
    ↓
[STEP_TEXT] → Text Output → Updated State (with output message)
    ↓
[STEP_ALL] → LLM Completion → Final State
    ↓
Return ExecutionResult
```

### Special State Handling

1. **set_output Tool**: Automatically updates `agentState.output`
2. **Message History**: Automatically updated on StepText yields
3. **Tool Results**: Stored temporarily for next generator iteration
4. **Completion Status**: Tracked via `stepsComplete` flag

## Error Handling

### MaxIterationsError

```
Iteration Count >= maxIterations
    ↓
Throw MaxIterationsError
    ↓
Caught in try-catch
    ↓
Return ExecutionResult { error: MaxIterationsError }
```

### UnknownYieldValueError

```
Unknown Yield Value
    ↓
Throw UnknownYieldValueError
    ↓
Caught in try-catch
    ↓
Return ExecutionResult { error: UnknownYieldValueError }
```

### Graceful Error Capture

All errors are captured and returned in the result:

```typescript
if (result.error) {
  // Handle error gracefully
  console.error(result.error.message)
}
```

## Integration Points

### Tool Executor Interface

```typescript
type ToolExecutor = (toolCall: ToolCall) => Promise<ToolResultOutput[]>
```

Implementer responsibilities:
- Execute the tool call
- Return properly formatted results
- Handle tool-specific errors

### LLM Executor Interface

```typescript
type LLMExecutor = (mode: 'STEP' | 'STEP_ALL') => Promise<{
  endTurn: boolean
  agentState: AgentState
}>
```

Implementer responsibilities:
- Execute LLM with appropriate mode
- Update message history
- Return completion status
- Return updated agent state

### Text Output Handler Interface

```typescript
type TextOutputHandler = (text: string) => void
```

Implementer responsibilities:
- Display or log text output
- Optional - can be undefined

## Configuration

### HandleStepsExecutorConfig

```typescript
{
  maxIterations: 100,    // Prevent infinite loops
  debug: false,          // Enable debug logging
  logger: customLogger   // Custom logger function
}
```

### Factory Functions

```typescript
// Production mode (minimal logging)
const executor = createProductionExecutor({ maxIterations: 100 })

// Debug mode (verbose logging)
const executor = createDebugExecutor({ maxIterations: 50 })

// Custom configuration
const executor = new HandleStepsExecutor({
  maxIterations: 200,
  debug: true,
  logger: myLogger
})
```

## Performance Considerations

1. **Iteration Limit**: Default 100, adjust based on agent complexity
2. **State Copying**: New state objects created each iteration (immutable pattern)
3. **Memory**: Tool results stored temporarily between iterations
4. **Logging**: Disable debug mode in production for better performance

## Best Practices

1. **Always Set Max Iterations**: Prevent runaway generators
2. **Use Debug Mode in Development**: Understand execution flow
3. **Implement Graceful Error Handling**: Check result.error
4. **Monitor Iteration Counts**: High counts may indicate inefficient agents
5. **Use Type Guards**: Validate yielded values before processing
6. **Maintain State Immutability**: Create new state objects, don't mutate

## Extension Points

The HandleStepsExecutor can be extended for:

1. **Custom Yield Types**: Add new handlers in processYieldedValue
2. **Metrics Collection**: Add instrumentation in execute method
3. **Custom Error Handling**: Override error handling logic
4. **State Transformers**: Add state transformation logic
5. **Execution Hooks**: Add before/after hooks for each iteration

## Testing Strategy

1. **Unit Tests**: Test each method in isolation
2. **Integration Tests**: Test with real agent definitions
3. **Error Tests**: Test max iterations and unknown yields
4. **State Tests**: Verify state propagation and updates
5. **Performance Tests**: Measure iteration performance

## Security Considerations

1. **Input Validation**: Validate agent definitions before execution
2. **Resource Limits**: Enforce maxIterations to prevent DoS
3. **State Isolation**: Ensure state doesn't leak between executions
4. **Error Sanitization**: Don't expose sensitive data in errors
