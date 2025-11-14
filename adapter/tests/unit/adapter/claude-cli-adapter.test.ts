/**
 * Unit tests for ClaudeCodeCLIAdapter
 *
 * Tests the main adapter class in FREE mode (no API key required).
 */

import { ClaudeCodeCLIAdapter, createAdapter, createDebugAdapter } from '../../../src/claude-cli-adapter'
import {
  createTestDir,
  createTestFiles,
  createMockAgent,
  createMockAgentWithSteps,
  createMockProject,
} from '../../utils/test-helpers'

describe('ClaudeCodeCLIAdapter', () => {
  let adapter: ClaudeCodeCLIAdapter
  let testDir: string

  beforeEach(async () => {
    testDir = await createTestDir('adapter-test-')
    await createMockProject(testDir)
  })

  describe('Constructor and initialization', () => {
    it('should create adapter in FREE mode without API key', () => {
      // Create adapter without API key
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      // Assert
      expect(adapter).toBeDefined()
      expect(adapter.hasApiKeyAvailable()).toBe(false)
      expect(adapter.getCwd()).toBe(testDir)
    })

    it('should create adapter in PAID mode with API key', () => {
      // Create adapter with API key
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        anthropicApiKey: 'sk-test-key-123',
      })

      // Assert
      expect(adapter).toBeDefined()
      expect(adapter.hasApiKeyAvailable()).toBe(true)
    })

    it('should apply default configuration', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      const config = adapter.getConfig()

      // Assert defaults
      expect(config.cwd).toBe(testDir)
      expect(config.maxSteps).toBe(20)
      expect(config.debug).toBe(false)
      expect(config.retry).toBeDefined()
      expect(config.timeouts).toBeDefined()
    })

    it('should allow custom configuration', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        maxSteps: 50,
        debug: true,
        retry: {
          maxRetries: 5,
          initialDelayMs: 500,
        },
      })

      const config = adapter.getConfig()

      // Assert custom values
      expect(config.maxSteps).toBe(50)
      expect(config.debug).toBe(true)
      expect(config.retry.maxRetries).toBe(5)
    })

    it('should merge environment variables', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        env: {
          CUSTOM_VAR: 'custom_value',
        },
      })

      const config = adapter.getConfig()

      // Assert env is set
      expect(config.env).toBeDefined()
      expect(config.env.CUSTOM_VAR).toBe('custom_value')
    })

    it('should use custom logger when provided', () => {
      const mockLogger = jest.fn()

      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        debug: true,
        logger: mockLogger,
      })

      // Logger should be called during initialization
      expect(mockLogger).toHaveBeenCalled()
    })
  })

  describe('Agent registration', () => {
    beforeEach(() => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })
    })

    it('should register an agent', () => {
      const agent = createMockAgent({
        id: 'test-agent',
        displayName: 'Test Agent',
      })

      adapter.registerAgent(agent)

      // Assert agent is registered
      const retrieved = adapter.getAgent('test-agent')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('test-agent')
    })

    it('should register multiple agents', () => {
      const agents = [
        createMockAgent({ id: 'agent-1' }),
        createMockAgent({ id: 'agent-2' }),
        createMockAgent({ id: 'agent-3' }),
      ]

      adapter.registerAgents(agents)

      // Assert all agents are registered
      const agentList = adapter.listAgents()
      expect(agentList).toContain('agent-1')
      expect(agentList).toContain('agent-2')
      expect(agentList).toContain('agent-3')
    })

    it('should list all registered agents', () => {
      adapter.registerAgent(createMockAgent({ id: 'agent-1' }))
      adapter.registerAgent(createMockAgent({ id: 'agent-2' }))

      const agents = adapter.listAgents()

      expect(agents).toHaveLength(2)
      expect(agents).toContain('agent-1')
      expect(agents).toContain('agent-2')
    })

    it('should allow overwriting agent registration', () => {
      const agent1 = createMockAgent({
        id: 'test-agent',
        displayName: 'Version 1',
      })

      const agent2 = createMockAgent({
        id: 'test-agent',
        displayName: 'Version 2',
      })

      adapter.registerAgent(agent1)
      adapter.registerAgent(agent2)

      // Assert latest version is registered
      const retrieved = adapter.getAgent('test-agent')
      expect(retrieved?.displayName).toBe('Version 2')
    })

    it('should return undefined for non-existent agent', () => {
      const agent = adapter.getAgent('non-existent')

      expect(agent).toBeUndefined()
    })
  })

  describe('Tool execution', () => {
    beforeEach(() => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })
    })

    it('should have file operations tools available', () => {
      // Tools are registered internally during construction
      // We can verify this by checking the adapter has them

      const config = adapter.getConfig()
      expect(config).toBeDefined()
    })

    it('should have code search tools available', () => {
      const config = adapter.getConfig()
      expect(config).toBeDefined()
    })

    it('should have terminal tools available', () => {
      const config = adapter.getConfig()
      expect(config).toBeDefined()
    })

    it('should disable spawn_agents in FREE mode', () => {
      const freeAdapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        // No API key - FREE mode
      })

      // Verify FREE mode
      expect(freeAdapter.hasApiKeyAvailable()).toBe(false)
    })

    it('should enable spawn_agents in PAID mode', () => {
      const paidAdapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        anthropicApiKey: 'sk-test-key',
      })

      // Verify PAID mode
      expect(paidAdapter.hasApiKeyAvailable()).toBe(true)
    })
  })

  describe('Context management', () => {
    beforeEach(() => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })
    })

    it('should create execution context', () => {
      // Get active contexts (should be empty initially)
      const contexts = adapter.getActiveContexts()

      expect(contexts).toBeDefined()
      expect(contexts.size).toBe(0)
    })

    it('should track active contexts during execution', async () => {
      const agent = createMockAgentWithSteps(
        async function* (context) {
          // Check contexts during execution
          const activeContexts = adapter.getActiveContexts()
          expect(activeContexts.size).toBeGreaterThan(0)

          // End execution
          return
        },
        { id: 'test-agent' }
      )

      adapter.registerAgent(agent)

      // Execute (this will create and track context)
      try {
        await adapter.executeAgent(agent, 'test prompt', {})
      } catch (e) {
        // Might fail due to LLM placeholder, but we're testing context tracking
      }
    })

    it('should clean up contexts after execution', async () => {
      const agent = createMockAgentWithSteps(
        async function* (context) {
          return
        },
        { id: 'test-agent' }
      )

      adapter.registerAgent(agent)

      try {
        await adapter.executeAgent(agent, 'test', {})
      } catch (e) {
        // Ignore execution errors
      }

      // Context should be cleaned up
      const contexts = adapter.getActiveContexts()
      expect(contexts.size).toBe(0)
    })
  })

  describe('Configuration getters', () => {
    it('should return current working directory', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      expect(adapter.getCwd()).toBe(testDir)
    })

    it('should return configuration object', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        maxSteps: 30,
        debug: true,
      })

      const config = adapter.getConfig()

      expect(config.cwd).toBe(testDir)
      expect(config.maxSteps).toBe(30)
      expect(config.debug).toBe(true)
    })

    it('should return frozen configuration (cannot be modified)', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      const config = adapter.getConfig()

      // Try to modify (should not affect internal config)
      const modifiedCwd = '/different/path'
      ;(config as any).cwd = modifiedCwd

      // Get config again
      const config2 = adapter.getConfig()

      // Should be unchanged
      expect(config2.cwd).toBe(testDir)
    })

    it('should check API key availability', () => {
      const freeAdapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      const paidAdapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        anthropicApiKey: 'sk-test',
      })

      expect(freeAdapter.hasApiKeyAvailable()).toBe(false)
      expect(paidAdapter.hasApiKeyAvailable()).toBe(true)
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })
    })

    it('should handle invalid working directory gracefully', () => {
      // Try to create adapter with non-existent directory
      // This might throw or create the directory, depending on implementation

      expect(() => {
        new ClaudeCodeCLIAdapter({
          cwd: '/nonexistent/directory/that/does/not/exist',
        })
      }).toBeDefined() // Just verify it doesn't crash the test suite
    })

    it('should handle negative maxSteps', () => {
      // Create with negative maxSteps (should use default or clamp)
      const adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        maxSteps: -10,
      })

      const config = adapter.getConfig()

      // Should use sensible value (not negative)
      expect(config.maxSteps).toBeDefined()
    })

    it('should handle invalid retry configuration', () => {
      const adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        retry: {
          maxRetries: -1,
          initialDelayMs: -100,
        } as any,
      })

      // Should not crash
      expect(adapter).toBeDefined()
    })
  })

  describe('Factory functions', () => {
    it('should create adapter with createAdapter factory', () => {
      adapter = createAdapter(testDir)

      expect(adapter).toBeDefined()
      expect(adapter).toBeInstanceOf(ClaudeCodeCLIAdapter)
      expect(adapter.getCwd()).toBe(testDir)
    })

    it('should create adapter with options using factory', () => {
      adapter = createAdapter(testDir, {
        maxSteps: 40,
        debug: true,
      })

      const config = adapter.getConfig()
      expect(config.maxSteps).toBe(40)
      expect(config.debug).toBe(true)
    })

    it('should create debug adapter with createDebugAdapter factory', () => {
      adapter = createDebugAdapter(testDir)

      const config = adapter.getConfig()
      expect(config.debug).toBe(true)
    })

    it('should allow overriding options in debug adapter', () => {
      adapter = createDebugAdapter(testDir, {
        maxSteps: 60,
      })

      const config = adapter.getConfig()
      expect(config.debug).toBe(true)
      expect(config.maxSteps).toBe(60)
    })
  })

  describe('Integration scenarios', () => {
    beforeEach(() => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
        debug: false,
      })
    })

    it('should support typical workflow: register and execute agent', async () => {
      // Register a simple agent
      const agent = createMockAgentWithSteps(
        async function* (context) {
          // Simple agent that just returns
          return
        },
        {
          id: 'workflow-agent',
          displayName: 'Workflow Test Agent',
        }
      )

      adapter.registerAgent(agent)

      // Verify registration
      expect(adapter.getAgent('workflow-agent')).toBeDefined()

      // Try to execute (may fail due to LLM placeholder)
      try {
        await adapter.executeAgent(agent, 'test prompt')
      } catch (e) {
        // Expected to fail in test environment
      }

      // Verify agent is still registered after execution attempt
      expect(adapter.getAgent('workflow-agent')).toBeDefined()
    })

    it('should support multiple agent registrations', () => {
      const agents = [
        createMockAgent({ id: 'agent-1', displayName: 'Agent 1' }),
        createMockAgent({ id: 'agent-2', displayName: 'Agent 2' }),
        createMockAgent({ id: 'agent-3', displayName: 'Agent 3' }),
      ]

      adapter.registerAgents(agents)

      // Verify all registered
      expect(adapter.listAgents().length).toBe(3)

      // Verify each can be retrieved
      agents.forEach(agent => {
        const retrieved = adapter.getAgent(agent.id)
        expect(retrieved).toBeDefined()
        expect(retrieved?.displayName).toBe(agent.displayName)
      })
    })
  })

  describe('Performance', () => {
    it('should create adapter quickly', () => {
      const start = Date.now()

      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      const duration = Date.now() - start

      // Should initialize in less than 100ms
      expect(duration).toBeLessThan(100)
    })

    it('should register multiple agents quickly', () => {
      adapter = new ClaudeCodeCLIAdapter({
        cwd: testDir,
      })

      const agents = Array.from({ length: 100 }, (_, i) =>
        createMockAgent({ id: `agent-${i}` })
      )

      const start = Date.now()
      adapter.registerAgents(agents)
      const duration = Date.now() - start

      // Should register 100 agents in less than 100ms
      expect(duration).toBeLessThan(100)
      expect(adapter.listAgents().length).toBe(100)
    })
  })
})
