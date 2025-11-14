#!/usr/bin/env node
/**
 * Example Runner CLI Tool
 *
 * Run examples from the command line easily.
 *
 * Usage:
 *   npm run example file-reader
 *   npm run example todo-finder
 *   npm run example -- --list
 *   npm run example -- --help
 */

import * as path from 'path'

// Import all example agents
const examples: Record<string, { run: () => Promise<void>, description: string }> = {
  'file-reader': {
    run: async () => {
      const { runFileReaderExample } = await import('./free-mode-agents/01-file-reader')
      await runFileReaderExample()
    },
    description: 'Read files and return their contents',
  },
  'file-writer': {
    run: async () => {
      const { runFileWriterExample } = await import('./free-mode-agents/02-file-writer')
      await runFileWriterExample()
    },
    description: 'Write files and generate from templates',
  },
  'file-editor': {
    run: async () => {
      const { runFileEditorExample } = await import('./free-mode-agents/03-file-editor')
      await runFileEditorExample()
    },
    description: 'Edit files using string replacement',
  },
  'todo-finder': {
    run: async () => {
      const { runTodoFinderExample } = await import('./free-mode-agents/04-todo-finder')
      await runTodoFinderExample()
    },
    description: 'Find all TODO/FIXME comments',
  },
  'import-analyzer': {
    run: async () => {
      const { runImportAnalyzerExample } = await import('./free-mode-agents/05-import-analyzer')
      await runImportAnalyzerExample()
    },
    description: 'Analyze import statements and dependencies',
  },
  'code-search': {
    run: async () => {
      const { runCodeSearchExample } = await import('./free-mode-agents/06-code-search')
      await runCodeSearchExample()
    },
    description: 'Search for code patterns using regex',
  },
  'file-finder': {
    run: async () => {
      const { runFileFinderExample } = await import('./free-mode-agents/07-file-finder')
      await runFileFinderExample()
    },
    description: 'Find files using glob patterns',
  },
  'terminal-executor': {
    run: async () => {
      const { runTerminalExecutorExample } = await import('./free-mode-agents/08-terminal-executor')
      await runTerminalExecutorExample()
    },
    description: 'Execute terminal commands',
  },
  'project-structure': {
    run: async () => {
      const { runProjectStructureExample } = await import('./free-mode-agents/09-project-structure')
      await runProjectStructureExample()
    },
    description: 'Analyze project directory structure',
  },
  'dependency-list': {
    run: async () => {
      const { runDependencyListExample } = await import('./free-mode-agents/10-dependency-list')
      await runDependencyListExample()
    },
    description: 'List all npm dependencies',
  },
  'test-counter': {
    run: async () => {
      const { runTestCounterExample } = await import('./free-mode-agents/11-test-counter')
      await runTestCounterExample()
    },
    description: 'Count test files and test cases',
  },
  'security-scanner': {
    run: async () => {
      const { runSecurityScannerExample } = await import('./free-mode-agents/12-security-scanner')
      await runSecurityScannerExample()
    },
    description: 'Scan for security vulnerabilities',
  },
  'code-metrics': {
    run: async () => {
      const { runCodeMetricsExample } = await import('./free-mode-agents/13-code-metrics')
      await runCodeMetricsExample()
    },
    description: 'Calculate code metrics (LOC, comments)',
  },
  'documentation-generator': {
    run: async () => {
      const { runDocumentationGeneratorExample } = await import('./free-mode-agents/14-documentation-generator')
      await runDocumentationGeneratorExample()
    },
    description: 'Generate API documentation',
  },
  'git-analyzer': {
    run: async () => {
      const { runGitAnalyzerExample } = await import('./free-mode-agents/15-git-analyzer')
      await runGitAnalyzerExample()
    },
    description: 'Analyze git repository',
  },
  'ts-project-analyzer': {
    run: async () => {
      const { runTsProjectAnalyzer } = await import('./real-projects/analyze-typescript-project')
      await runTsProjectAnalyzer()
    },
    description: 'Complete TypeScript project analysis',
  },
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
Example Runner - Run FREE mode adapter examples

Usage:
  npm run example <example-name>
  npm run example -- --list
  npm run example -- --help

Examples:
  npm run example file-reader        # Run file reader example
  npm run example todo-finder        # Run TODO finder example
  npm run example ts-project-analyzer  # Run full project analysis

Options:
  --list, -l    List all available examples
  --help, -h    Show this help message

Available examples: ${Object.keys(examples).length}
Run with --list to see all examples with descriptions.
`)
}

/**
 * List all available examples
 */
function listExamples() {
  console.log('\n📋 Available Examples:\n')

  const sortedExamples = Object.entries(examples).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  for (const [name, { description }] of sortedExamples) {
    console.log(`  ${name.padEnd(25)} - ${description}`)
  }

  console.log('\n💡 Usage: npm run example <example-name>\n')
}

/**
 * Run an example by name
 */
async function runExample(name: string) {
  const example = examples[name]

  if (!example) {
    console.error(`\n❌ Error: Example "${name}" not found\n`)
    console.log('Available examples:')
    listExamples()
    process.exit(1)
  }

  try {
    console.log(`\n🚀 Running example: ${name}\n`)
    await example.run()
  } catch (error) {
    console.error(`\n❌ Error running example "${name}":`)
    console.error(error)
    process.exit(1)
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2)

  // No arguments
  if (args.length === 0) {
    showHelp()
    return
  }

  const command = args[0]

  // Handle flags
  if (command === '--help' || command === '-h') {
    showHelp()
    return
  }

  if (command === '--list' || command === '-l') {
    listExamples()
    return
  }

  // Run example
  await runExample(command)
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { examples, runExample, listExamples }
