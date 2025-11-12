/**
 * Tests for SpawnAgentsAdapter
 *
 * Validates spawn_agents tool implementation including:
 * - Sequential agent execution
 * - Agent registry lookup
 * - Error handling
 * - Result aggregation
 * - Parallel execution (experimental)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import {
  SpawnAgentsAdapter,
  createSpawnAgentsAdapter,
  type AgentRegistry,
  type AgentExecutor,
  type AgentExecutionContext,
  type SpawnAgentsParams
} from './spawn-agents'
import type { AgentDefinition } from '../../../.agents/types/agent-definition'

// ============================================================================
// Test Setup
// ============================================================================

describe('SpawnAgentsAdapter', () => {
  let agentRegistry: AgentRegistry
  let mockAgentExecutor: AgentExecutor
  let adapter: SpawnAgentsAdapter
  let parentContext: AgentExecutionContext

  // Sample agent definitions
  const filePickerAgent: AgentDefinition = {
    id: 'file-picker',
    displayName: 'File Picker',
    model: 'openai/gpt-5-mini',
    toolNames: ['find_files', 'read_files'],
    systemPrompt: 'You are a file picker agent.'
  }

  const codeReviewerAgent: AgentDefinition = {
    id: 'code-reviewer',
    displayName: 'Code Reviewer',
    model: 'openai/gpt-5',
    toolNames: ['read_files', 'code_search'],
    systemPrompt: 'You are a code reviewer agent.'
  }

  const thinkerAgent: AgentDefinition = {
    id: 'thinker',
    displayName: 'Deep Thinker',
    model: 'anthropic/claude-sonnet-4.5',
    toolNames: [],
    systemPrompt: 'You are a thinking agent.'
  }

  beforeEach(() => {
    // Create fresh agent registry
    agentRegistry = new Map([
      ['file-picker', filePickerAgent],
      ['code-reviewer', codeReviewerAgent],
      ['thinker', thinkerAgent]
    ])

    // Create mock agent executor
    mockAgentExecutor = mock(async (
      agentDef: AgentDefinition,
      prompt: string | undefined,
      params: Record<string, any> | undefined,
      context: AgentExecutionContext
    ) => {
      // Simulate successful agent execution
      return {
        output: {
          agentId: agentDef.id,
          agentName: agentDef.displayName,
          prompt,
          params,
          result: 'success'
        },
        messageHistory: [
          { role: 'user', content: prompt || 'No prompt' } as const,
          { role: 'assistant', content: `Completed task for ${agentDef.id}` } as const
        ]
      }
    })

    // Create adapter
    adapter = new SpawnAgentsAdapter(agentRegistry, mockAgentExecutor)

    // Create parent context
    parentContext = {
      agentId: 'parent-agent-123',
      parentId: undefined,
      messageHistory: [
        { role: 'user', content: 'Parent task' } as const
      ],
      stepsRemaining: 20,
      output: { parentData: 'some data' }
    }
  })

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create adapter with registry and executor', () => {
      expect(adapter).toBeInstanceOf(SpawnAgentsAdapter)
    })

    it('should work with empty registry', () => {
      const emptyAdapter = new SpawnAgentsAdapter(new Map(), mockAgentExecutor)
      expect(emptyAdapter).toBeInstanceOf(SpawnAgentsAdapter)
    })
  })

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createSpawnAgentsAdapter', () => {
    it('should create adapter instance', () => {
      const newAdapter = createSpawnAgentsAdapter(agentRegistry, mockAgentExecutor)
      expect(newAdapter).toBeInstanceOf(SpawnAgentsAdapter)
    })
  })

  // ============================================================================
  // Sequential Execution Tests
  // ============================================================================

  describe('spawnAgents (sequential)', () => {
    it('should spawn single agent successfully', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker', prompt: 'Find TypeScript files' }
        ]
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
      expect(result[0].value).toHaveLength(1)
      expect(result[0].value[0]).toMatchObject({
        agentType: 'file-picker',
        agentName: 'File Picker',
        value: expect.objectContaining({
          agentId: 'file-picker',
          result: 'success'
        })
      })
    })

    it('should spawn multiple agents sequentially', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker', prompt: 'Find files' },
          { agent_type: 'code-reviewer', prompt: 'Review code' },
          { agent_type: 'thinker', prompt: 'Think deeply' }
        ]
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result[0].value).toHaveLength(3)
      expect(result[0].value[0].agentType).toBe('file-picker')
      expect(result[0].value[1].agentType).toBe('code-reviewer')
      expect(result[0].value[2].agentType).toBe('thinker')

      // Verify executor was called 3 times
      expect(mockAgentExecutor).toHaveBeenCalledTimes(3)
    })

    it('should pass prompt and params to agent executor', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          {
            agent_type: 'file-picker',
            prompt: 'Find test files',
            params: { pattern: '*.test.ts', maxFiles: 10 }
          }
        ]
      }

      await adapter.spawnAgents(input, parentContext)

      expect(mockAgentExecutor).toHaveBeenCalledWith(
        filePickerAgent,
        'Find test files',
        { pattern: '*.test.ts', maxFiles: 10 },
        parentContext
      )
    })

    it('should pass parent context to spawned agents', async () => {
      const input: SpawnAgentsParams = {
        agents: [{ agent_type: 'thinker', prompt: 'Think' }]
      }

      await adapter.spawnAgents(input, parentContext)

      expect(mockAgentExecutor).toHaveBeenCalledWith(
        thinkerAgent,
        'Think',
        undefined,
        parentContext
      )
    })

    it('should handle agents without prompts', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker' }
        ]
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result[0].value[0].value).toBeDefined()
      expect(mockAgentExecutor).toHaveBeenCalledWith(
        filePickerAgent,
        undefined,
        undefined,
        parentContext
      )
    })

    it('should handle empty agents array', async () => {
      const input: SpawnAgentsParams = {
        agents: []
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result[0].value).toHaveLength(0)
      expect(mockAgentExecutor).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle agent not found in registry', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'non-existent-agent', prompt: 'Do something' }
        ]
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result[0].value[0]).toMatchObject({
        agentType: 'non-existent-agent',
        agentName: 'non-existent-agent',
        value: {
          errorMessage: expect.stringContaining('Agent not found in registry')
        }
      })
    })

    it('should handle agent execution failure', async () => {
      const failingExecutor = mock(async () => {
        throw new Error('Agent execution failed')
      })

      const failingAdapter = new SpawnAgentsAdapter(agentRegistry, failingExecutor)

      const input: SpawnAgentsParams = {
        agents: [{ agent_type: 'file-picker', prompt: 'Find files' }]
      }

      const result = await failingAdapter.spawnAgents(input, parentContext)

      expect(result[0].value[0]).toMatchObject({
        agentType: 'file-picker',
        agentName: 'file-picker',
        value: {
          errorMessage: expect.stringContaining('Agent execution failed')
        }
      })
    })

    it('should continue spawning after one agent fails', async () => {
      let callCount = 0
      const partiallyFailingExecutor = mock(async (agentDef: AgentDefinition) => {
        callCount++
        if (callCount === 2) {
          throw new Error('Second agent failed')
        }
        return {
          output: { success: true },
          messageHistory: []
        }
      })

      const failingAdapter = new SpawnAgentsAdapter(agentRegistry, partiallyFailingExecutor)

      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker', prompt: 'Task 1' },
          { agent_type: 'code-reviewer', prompt: 'Task 2' },
          { agent_type: 'thinker', prompt: 'Task 3' }
        ]
      }

      const result = await failingAdapter.spawnAgents(input, parentContext)

      expect(result[0].value).toHaveLength(3)
      expect(result[0].value[0].value).toEqual({ success: true })
      expect(result[0].value[1].value.errorMessage).toContain('Second agent failed')
      expect(result[0].value[2].value).toEqual({ success: true })
    })

    it('should format different error types correctly', async () => {
      const errorCases = [
        new Error('Standard error'),
        'String error message',
        { custom: 'error object' },
        42
      ]

      for (const error of errorCases) {
        const executor = mock(async () => {
          throw error
        })

        const testAdapter = new SpawnAgentsAdapter(agentRegistry, executor)
        const result = await testAdapter.spawnAgents(
          { agents: [{ agent_type: 'thinker', prompt: 'test' }] },
          parentContext
        )

        expect(result[0].value[0].value.errorMessage).toBeDefined()
        expect(typeof result[0].value[0].value.errorMessage).toBe('string')
      }
    })
  })

  // ============================================================================
  // Agent Resolution Tests
  // ============================================================================

  describe('agent resolution', () => {
    it('should resolve agent by simple ID', async () => {
      const input: SpawnAgentsParams = {
        agents: [{ agent_type: 'file-picker', prompt: 'test' }]
      }

      await adapter.spawnAgents(input, parentContext)

      expect(mockAgentExecutor).toHaveBeenCalledWith(
        filePickerAgent,
        expect.any(String),
        expect.anything(),
        expect.anything()
      )
    })

    it('should resolve agent with version suffix', async () => {
      const input: SpawnAgentsParams = {
        agents: [{ agent_type: 'file-picker@0.0.1', prompt: 'test' }]
      }

      await adapter.spawnAgents(input, parentContext)

      expect(mockAgentExecutor).toHaveBeenCalledWith(
        filePickerAgent,
        expect.any(String),
        expect.anything(),
        expect.anything()
      )
    })

    it('should resolve agent with publisher and version', async () => {
      const input: SpawnAgentsParams = {
        agents: [{ agent_type: 'codebuff/file-picker@0.0.1', prompt: 'test' }]
      }

      await adapter.spawnAgents(input, parentContext)

      expect(mockAgentExecutor).toHaveBeenCalledWith(
        filePickerAgent,
        expect.any(String),
        expect.anything(),
        expect.anything()
      )
    })
  })

  // ============================================================================
  // Parallel Execution Tests (Experimental)
  // ============================================================================

  describe('spawnAgentsParallel (experimental)', () => {
    it('should spawn multiple agents in parallel', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker', prompt: 'Task 1' },
          { agent_type: 'code-reviewer', prompt: 'Task 2' },
          { agent_type: 'thinker', prompt: 'Task 3' }
        ]
      }

      const result = await adapter.spawnAgentsParallel(input, parentContext)

      expect(result[0].value).toHaveLength(3)
      expect(mockAgentExecutor).toHaveBeenCalledTimes(3)
    })

    it('should handle mixed success and failure in parallel', async () => {
      let callCount = 0
      const mixedExecutor = mock(async (agentDef: AgentDefinition) => {
        callCount++
        if (callCount === 2) {
          throw new Error('Second agent failed')
        }
        return {
          output: { agentId: agentDef.id, success: true },
          messageHistory: []
        }
      })

      const mixedAdapter = new SpawnAgentsAdapter(agentRegistry, mixedExecutor)

      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker', prompt: 'Task 1' },
          { agent_type: 'code-reviewer', prompt: 'Task 2' },
          { agent_type: 'thinker', prompt: 'Task 3' }
        ]
      }

      const result = await mixedAdapter.spawnAgentsParallel(input, parentContext)

      expect(result[0].value).toHaveLength(3)
      expect(result[0].value[0].value).toMatchObject({ success: true })
      expect(result[0].value[1].value.errorMessage).toContain('Second agent failed')
      expect(result[0].value[2].value).toMatchObject({ success: true })
    })

    it('should handle all agents failing in parallel', async () => {
      const failingExecutor = mock(async () => {
        throw new Error('All agents fail')
      })

      const failingAdapter = new SpawnAgentsAdapter(agentRegistry, failingExecutor)

      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'file-picker', prompt: 'Task 1' },
          { agent_type: 'code-reviewer', prompt: 'Task 2' }
        ]
      }

      const result = await failingAdapter.spawnAgentsParallel(input, parentContext)

      expect(result[0].value).toHaveLength(2)
      result[0].value.forEach((agentResult: any) => {
        expect(agentResult.value.errorMessage).toContain('All agents fail')
      })
    })
  })

  // ============================================================================
  // Utility Method Tests
  // ============================================================================

  describe('utility methods', () => {
    describe('getAgentInfo', () => {
      it('should return agent definition for valid ID', () => {
        const info = adapter.getAgentInfo('file-picker')
        expect(info).toBe(filePickerAgent)
      })

      it('should return undefined for invalid ID', () => {
        const info = adapter.getAgentInfo('non-existent')
        expect(info).toBeUndefined()
      })

      it('should handle fully qualified agent references', () => {
        const info = adapter.getAgentInfo('codebuff/file-picker@0.0.1')
        expect(info).toBe(filePickerAgent)
      })
    })

    describe('listRegisteredAgents', () => {
      it('should return all registered agent IDs', () => {
        const agents = adapter.listRegisteredAgents()
        expect(agents).toHaveLength(3)
        expect(agents).toContain('file-picker')
        expect(agents).toContain('code-reviewer')
        expect(agents).toContain('thinker')
      })

      it('should return empty array for empty registry', () => {
        const emptyAdapter = new SpawnAgentsAdapter(new Map(), mockAgentExecutor)
        const agents = emptyAdapter.listRegisteredAgents()
        expect(agents).toHaveLength(0)
      })
    })

    describe('hasAgent', () => {
      it('should return true for registered agent', () => {
        expect(adapter.hasAgent('file-picker')).toBe(true)
      })

      it('should return false for unregistered agent', () => {
        expect(adapter.hasAgent('non-existent')).toBe(false)
      })

      it('should handle fully qualified references', () => {
        expect(adapter.hasAgent('codebuff/file-picker@0.0.1')).toBe(true)
      })
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('should handle complex multi-agent workflow', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          {
            agent_type: 'file-picker',
            prompt: 'Find all TypeScript test files',
            params: { pattern: '*.test.ts' }
          },
          {
            agent_type: 'code-reviewer',
            prompt: 'Review the test files for best practices'
          },
          {
            agent_type: 'thinker',
            prompt: 'Suggest improvements based on the review'
          }
        ]
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result[0].value).toHaveLength(3)

      // Verify each agent was called with correct parameters
      expect(mockAgentExecutor).toHaveBeenNthCalledWith(
        1,
        filePickerAgent,
        'Find all TypeScript test files',
        { pattern: '*.test.ts' },
        parentContext
      )

      expect(mockAgentExecutor).toHaveBeenNthCalledWith(
        2,
        codeReviewerAgent,
        'Review the test files for best practices',
        undefined,
        parentContext
      )

      expect(mockAgentExecutor).toHaveBeenNthCalledWith(
        3,
        thinkerAgent,
        'Suggest improvements based on the review',
        undefined,
        parentContext
      )
    })

    it('should preserve agent order in results', async () => {
      const input: SpawnAgentsParams = {
        agents: [
          { agent_type: 'thinker', prompt: 'First' },
          { agent_type: 'file-picker', prompt: 'Second' },
          { agent_type: 'code-reviewer', prompt: 'Third' }
        ]
      }

      const result = await adapter.spawnAgents(input, parentContext)

      expect(result[0].value[0].agentType).toBe('thinker')
      expect(result[0].value[1].agentType).toBe('file-picker')
      expect(result[0].value[2].agentType).toBe('code-reviewer')
    })
  })
})
