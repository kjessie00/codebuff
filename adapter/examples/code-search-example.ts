/**
 * Example: Using CodeSearchTools
 *
 * This example demonstrates how to use the CodeSearchTools class
 * to search code and find files in a project.
 */

import { createCodeSearchTools } from '../src/tools/code-search'
import * as path from 'path'

async function main() {
  // Create tools instance with project root directory
  const projectRoot = path.join(__dirname, '../..')
  const tools = createCodeSearchTools(projectRoot)

  console.log('='.repeat(60))
  console.log('Code Search Tools Example')
  console.log('='.repeat(60))
  console.log()

  // ============================================================================
  // Example 1: Search for a pattern in the codebase
  // ============================================================================
  console.log('Example 1: Search for "export class" in TypeScript files')
  console.log('-'.repeat(60))

  const searchResult = await tools.codeSearch({
    query: 'export class',
    file_pattern: '*.ts',
    case_sensitive: false
  })

  if (searchResult[0].type === 'json') {
    const data = searchResult[0].value
    console.log(`Found ${data.total} matches`)
    console.log()

    // Show first 5 results
    const results = data.results.slice(0, 5)
    for (const result of results) {
      console.log(`  ${result.path}:${result.line_number}`)
      console.log(`    ${result.line}`)
    }

    if (data.total > 5) {
      console.log(`  ... and ${data.total - 5} more`)
    }
  }
  console.log()

  // ============================================================================
  // Example 2: Search with case sensitivity
  // ============================================================================
  console.log('Example 2: Case-sensitive search for "TODO"')
  console.log('-'.repeat(60))

  const todoResult = await tools.codeSearch({
    query: 'TODO',
    case_sensitive: true,
    maxResults: 10
  })

  if (todoResult[0].type === 'json') {
    const data = todoResult[0].value
    console.log(`Found ${data.total} TODO comments`)

    if (data.total > 0) {
      console.log()
      for (const result of data.results) {
        console.log(`  ${result.path}:${result.line_number}`)
        console.log(`    ${result.line.trim()}`)
      }
    }
  }
  console.log()

  // ============================================================================
  // Example 3: Find files matching a glob pattern
  // ============================================================================
  console.log('Example 3: Find all TypeScript test files')
  console.log('-'.repeat(60))

  const testFiles = await tools.findFiles({
    pattern: '**/*.test.ts'
  })

  if (testFiles[0].type === 'json') {
    const data = testFiles[0].value
    console.log(`Found ${data.total} test files`)
    console.log()

    // Show first 10 files
    const files = data.files.slice(0, 10)
    for (const file of files) {
      console.log(`  ${file}`)
    }

    if (data.total > 10) {
      console.log(`  ... and ${data.total - 10} more`)
    }
  }
  console.log()

  // ============================================================================
  // Example 4: Find files in a specific directory
  // ============================================================================
  console.log('Example 4: Find all TypeScript files in adapter/src')
  console.log('-'.repeat(60))

  const adapterFiles = await tools.findFiles({
    pattern: '**/*.ts',
    cwd: 'adapter/src'
  })

  if (adapterFiles[0].type === 'json') {
    const data = adapterFiles[0].value
    console.log(`Found ${data.total} TypeScript files in adapter/src`)
    console.log()

    for (const file of data.files) {
      console.log(`  ${file}`)
    }
  }
  console.log()

  // ============================================================================
  // Example 5: Search in a specific directory
  // ============================================================================
  console.log('Example 5: Search for "interface" in adapter/src')
  console.log('-'.repeat(60))

  const interfaceSearch = await tools.codeSearch({
    query: 'interface',
    cwd: 'adapter/src',
    file_pattern: '*.ts',
    maxResults: 10
  })

  if (interfaceSearch[0].type === 'json') {
    const data = interfaceSearch[0].value
    console.log(`Found ${data.total} matches for "interface"`)
    console.log()

    // Group by file
    const byFile = data.by_file
    for (const [filePath, matches] of Object.entries(byFile as Record<string, any[]>)) {
      console.log(`  ${filePath}: ${matches.length} matches`)
    }
  }
  console.log()

  // ============================================================================
  // Example 6: Handle no matches gracefully
  // ============================================================================
  console.log('Example 6: Search for a non-existent pattern')
  console.log('-'.repeat(60))

  const noMatchResult = await tools.codeSearch({
    query: 'ThisShouldNeverMatchAnything12345',
    file_pattern: '*.ts'
  })

  if (noMatchResult[0].type === 'json') {
    const data = noMatchResult[0].value
    console.log(`Found ${data.total} matches`)
    if (data.message) {
      console.log(`Message: ${data.message}`)
    }
  }
  console.log()

  // ============================================================================
  // Example 7: Verify ripgrep is available
  // ============================================================================
  console.log('Example 7: Check ripgrep availability')
  console.log('-'.repeat(60))

  const isRgAvailable = await tools.verifyRipgrep()
  console.log(`Ripgrep available: ${isRgAvailable}`)

  if (isRgAvailable) {
    const version = await tools.getRipgrepVersion()
    console.log(`Ripgrep version: ${version}`)
  }
  console.log()

  console.log('='.repeat(60))
  console.log('Example completed!')
  console.log('='.repeat(60))
}

// Run the example
main().catch(error => {
  console.error('Error running example:', error)
  process.exit(1)
})
