/**
 * FREE Mode Usage Examples
 *
 * Comprehensive examples demonstrating how to use the FREE mode base code
 * foundation for the Claude CLI adapter.
 *
 * This file shows:
 * - Basic adapter creation
 * - Using pre-built agent templates
 * - Error handling patterns
 * - Sequential and parallel execution
 * - Configuration presets
 * - Custom agents
 *
 * Run with:
 *   npx tsx adapter/examples/free-mode-usage.ts
 */

import {
  // Factory functions
  createFreeAdapter,
  createAdapterForCwd,
  createAdapterWithPreset,

  // Agent templates
  fileExplorerAgent,
  codeSearchAgent,
  terminalAgent,
  todoFinderAgent,
  codeReviewerAgent,
  allAgents,

  // Helper functions
  executeWithErrorHandling,
  executeAndExtract,
  executeSequence,
  executeParallel,
  getFreeModeTools,
  getToolAvailability,
  validateAgentForFreeMode,
  prettyPrintResult,

  // Types
  type AgentDefinition,
  type Result,
} from '../src/free-mode'

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

async function example1_BasicUsage() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 1: Basic Usage')
  console.log('='.repeat(60) + '\n')

  // Create adapter
  const adapter = createFreeAdapter({
    cwd: process.cwd(),
    debug: true,
  })

  // Register agent
  adapter.registerAgent(fileExplorerAgent)

  // Execute agent
  const result = await adapter.executeAgent(
    fileExplorerAgent,
    'Find all TypeScript files in the adapter/src directory'
  )

  console.log('\n✅ Execution completed')
  console.log('Output:', JSON.stringify(result.output, null, 2))
}

// ============================================================================
// Example 2: Error Handling
// ============================================================================

async function example2_ErrorHandling() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 2: Error Handling')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()
  adapter.registerAgent(codeSearchAgent)

  // Execute with error handling
  const result = await executeWithErrorHandling(
    adapter,
    codeSearchAgent,
    'Search for TODO comments in the codebase'
  )

  if (result.success) {
    console.log('\n✅ Search completed successfully')
    console.log('Found results:', result.data.output)
  } else {
    console.error('\n❌ Search failed')
    console.error('Error:', result.error)
    console.error('Details:', result.details)
  }
}

// ============================================================================
// Example 3: Output Extraction
// ============================================================================

async function example3_OutputExtraction() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 3: Output Extraction')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()
  adapter.registerAgent(todoFinderAgent)

  // Execute and extract specific data
  const result = await executeAndExtract(
    adapter,
    todoFinderAgent,
    'Find all TODO comments',
    (output) => {
      // Extract todo list from output
      if (typeof output === 'object' && output !== null && 'todos' in output) {
        return (output as any).todos
      }
      return []
    }
  )

  if (result.success) {
    console.log('\n✅ Found TODOs:')
    const todos = result.data as any[]
    todos.forEach((todo, i) => {
      console.log(`  ${i + 1}. ${todo.message} (${todo.file}:${todo.line})`)
    })
  } else {
    console.error('\n❌ Failed to extract TODOs:', result.error)
  }
}

// ============================================================================
// Example 4: Sequential Execution
// ============================================================================

async function example4_SequentialExecution() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 4: Sequential Execution')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()
  adapter.registerAgents([fileExplorerAgent, codeSearchAgent, codeReviewerAgent])

  // Execute multiple agents in sequence
  const results = await executeSequence(adapter, [
    {
      agent: fileExplorerAgent,
      prompt: 'Find all TypeScript files in src',
      name: 'File Discovery',
    },
    {
      agent: codeSearchAgent,
      prompt: 'Search for error handling patterns',
      name: 'Pattern Search',
    },
    {
      agent: codeReviewerAgent,
      prompt: 'Review the main adapter file',
      name: 'Code Review',
    },
  ])

  console.log('\n✅ Sequential execution completed')
  results.forEach((result, i) => {
    console.log(`\nTask ${i + 1}: ${result.success ? '✅ Success' : '❌ Failed'}`)
    if (!result.success) {
      console.log(`  Error: ${result.error}`)
    }
  })
}

// ============================================================================
// Example 5: Parallel Execution
// ============================================================================

async function example5_ParallelExecution() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 5: Parallel Execution')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()
  adapter.registerAgent(codeSearchAgent)

  // Execute multiple searches in parallel
  const startTime = Date.now()

  const results = await executeParallel(adapter, [
    { agent: codeSearchAgent, prompt: 'Search for TODO comments', name: 'TODOs' },
    { agent: codeSearchAgent, prompt: 'Search for FIXME comments', name: 'FIXMEs' },
    { agent: codeSearchAgent, prompt: 'Search for HACK comments', name: 'HACKs' },
  ])

  const duration = Date.now() - startTime

  console.log(`\n✅ Parallel execution completed in ${duration}ms`)
  results.forEach((result, i) => {
    console.log(`Search ${i + 1}: ${result.success ? '✅ Success' : '❌ Failed'}`)
  })
}

// ============================================================================
// Example 6: Using Configuration Presets
// ============================================================================

async function example6_ConfigurationPresets() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 6: Configuration Presets')
  console.log('='.repeat(60) + '\n')

  // Development mode - verbose logging
  console.log('Creating adapter with development preset...')
  const devAdapter = createAdapterWithPreset('development', {
    cwd: process.cwd(),
  })

  // Production mode - minimal logging
  console.log('Creating adapter with production preset...')
  const prodAdapter = createAdapterWithPreset('production', {
    cwd: process.cwd(),
  })

  // Testing mode - strict settings
  console.log('Creating adapter with testing preset...')
  const testAdapter = createAdapterWithPreset('testing', {
    cwd: process.cwd(),
  })

  console.log('\n✅ All presets created successfully')
  console.log('Available presets: development, production, testing, silent, verbose, performance')
}

// ============================================================================
// Example 7: Tool Availability
// ============================================================================

async function example7_ToolAvailability() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 7: Tool Availability')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()

  console.log('FREE Mode Tools:')
  const freeModeTools = getFreeModeTools()
  freeModeTools.forEach((tool) => {
    console.log(`  ✅ ${tool}`)
  })

  console.log('\nTool Availability Details:')
  const availability = getToolAvailability(adapter)
  Object.entries(availability).forEach(([tool, info]) => {
    const status = info.available ? '✅' : '❌'
    const apiKeyNote = info.requiresApiKey ? ' (requires API key)' : ''
    console.log(`  ${status} ${tool}${apiKeyNote}`)
    console.log(`      ${info.description}`)
  })
}

// ============================================================================
// Example 8: Agent Validation
// ============================================================================

async function example8_AgentValidation() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 8: Agent Validation')
  console.log('='.repeat(60) + '\n')

  // Validate pre-built agents
  console.log('Validating pre-built agents for FREE mode compatibility:\n')

  const agentsToValidate = [
    fileExplorerAgent,
    codeSearchAgent,
    terminalAgent,
    codeReviewerAgent,
  ]

  agentsToValidate.forEach((agent) => {
    const validation = validateAgentForFreeMode(agent)
    if (validation.success) {
      console.log(`✅ ${agent.displayName} - Compatible with FREE mode`)
    } else {
      console.log(`❌ ${agent.displayName} - Requires PAID mode`)
      console.log(`   Reason: ${validation.error}`)
    }
  })
}

// ============================================================================
// Example 9: Custom Agent
// ============================================================================

async function example9_CustomAgent() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 9: Custom Agent')
  console.log('='.repeat(60) + '\n')

  // Define custom agent
  const customAgent: AgentDefinition = {
    id: 'custom-package-analyzer',
    version: '1.0.0',
    displayName: 'Package Analyzer',
    model: 'anthropic/claude-sonnet-4.5',

    systemPrompt: `You are a package.json analyzer. Help users understand their project dependencies.`,

    instructionsPrompt: `When analyzing package.json:
1. Read the package.json file
2. List all dependencies and devDependencies
3. Check for outdated or unused packages
4. Provide recommendations`,

    toolNames: ['read_files', 'code_search', 'run_terminal_command'],
    outputMode: 'structured_output',
    outputSchema: {
      type: 'object',
      properties: {
        dependencies: { type: 'array', items: { type: 'string' } },
        devDependencies: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
    },
  }

  // Validate custom agent
  const validation = validateAgentForFreeMode(customAgent)
  if (validation.success) {
    console.log('✅ Custom agent is FREE mode compatible\n')

    // Use custom agent
    const adapter = createFreeAdapter()
    adapter.registerAgent(customAgent)

    console.log('Registered custom agent:', customAgent.displayName)
    console.log('Tools:', customAgent.toolNames?.join(', '))
  } else {
    console.error('❌ Custom agent requires PAID mode:', validation.error)
  }
}

// ============================================================================
// Example 10: Register All Pre-built Agents
// ============================================================================

async function example10_AllAgents() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 10: Register All Pre-built Agents')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()

  // Register all pre-built agents at once
  adapter.registerAgents(allAgents)

  // List registered agents
  const registeredAgents = adapter.listAgents()

  console.log(`✅ Registered ${registeredAgents.length} agents:\n`)
  registeredAgents.forEach((agentId, i) => {
    const agent = adapter.getAgent(agentId)
    if (agent) {
      console.log(`  ${i + 1}. ${agent.displayName} (${agentId})`)
      console.log(`     Tools: ${agent.toolNames?.join(', ') || 'none'}`)
    }
  })
}

// ============================================================================
// Example 11: Pretty Print Results
// ============================================================================

async function example11_PrettyPrintResults() {
  console.log('\n' + '='.repeat(60))
  console.log('Example 11: Pretty Print Results')
  console.log('='.repeat(60) + '\n')

  const adapter = createFreeAdapter()
  adapter.registerAgent(fileExplorerAgent)

  const result = await executeWithErrorHandling(
    adapter,
    fileExplorerAgent,
    'Find all markdown files'
  )

  // Pretty print with metadata
  prettyPrintResult(result, {
    includeMetadata: true,
    includeHistory: false,
  })
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('\n' + '█'.repeat(60))
  console.log('  FREE Mode Usage Examples')
  console.log('  Production-Ready Base Code Foundation')
  console.log('█'.repeat(60))

  try {
    await example1_BasicUsage()
    await example2_ErrorHandling()
    await example3_OutputExtraction()
    await example4_SequentialExecution()
    await example5_ParallelExecution()
    await example6_ConfigurationPresets()
    await example7_ToolAvailability()
    await example8_AgentValidation()
    await example9_CustomAgent()
    await example10_AllAgents()
    await example11_PrettyPrintResults()

    console.log('\n' + '█'.repeat(60))
    console.log('  ✅ All Examples Completed Successfully!')
    console.log('█'.repeat(60) + '\n')
  } catch (error: any) {
    console.error('\n❌ Example failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

// Export for use in other files
export {
  example1_BasicUsage,
  example2_ErrorHandling,
  example3_OutputExtraction,
  example4_SequentialExecution,
  example5_ParallelExecution,
  example6_ConfigurationPresets,
  example7_ToolAvailability,
  example8_AgentValidation,
  example9_CustomAgent,
  example10_AllAgents,
  example11_PrettyPrintResults,
}
