/**
 * FREE Mode Configuration Presets
 *
 * Pre-configured settings for common use cases in FREE mode.
 * These presets provide sensible defaults for development, production, and testing.
 *
 * @module presets
 */

import { ClaudeCodeCLIAdapter } from '../claude-cli-adapter'
import type { AdapterConfig } from '../types'
import type { PresetConfig } from './free-mode-types'

// ============================================================================
// Preset Definitions
// ============================================================================

/**
 * Development preset - Verbose logging and debugging
 *
 * Use this preset when developing and debugging agents.
 * - Debug logging enabled
 * - Detailed console output
 * - Higher max steps for exploration
 * - Verbose error messages
 */
export const developmentPreset: PresetConfig = {
  debug: true,
  logger: (msg: string) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [DEV] ${msg}`)
  },
  maxSteps: 50,
  description: 'Development mode with verbose logging and debugging',
}

/**
 * Production preset - Minimal logging
 *
 * Use this preset in production environments.
 * - Debug logging disabled
 * - Minimal output
 * - Moderate max steps
 * - Only critical errors logged
 */
export const productionPreset: PresetConfig = {
  debug: false,
  logger: (msg: string) => {
    // Only log errors and warnings
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('warn')) {
      console.error(`[PROD] ${msg}`)
    }
  },
  maxSteps: 20,
  description: 'Production mode with minimal logging',
}

/**
 * Testing preset - Strict settings for tests
 *
 * Use this preset when running automated tests.
 * - Debug logging enabled for test output
 * - Lower max steps for faster tests
 * - Structured output for assertions
 * - Timeout protection
 */
export const testingPreset: PresetConfig = {
  debug: true,
  logger: (msg: string) => {
    // Prefix with test identifier
    console.log(`[TEST] ${msg}`)
  },
  maxSteps: 10,
  description: 'Testing mode with strict settings',
}

/**
 * Silent preset - No logging
 *
 * Use this preset when you want completely silent operation.
 * - All logging disabled
 * - No console output
 * - Minimal max steps
 */
export const silentPreset: PresetConfig = {
  debug: false,
  logger: () => {}, // No-op logger
  maxSteps: 20,
  description: 'Silent mode with no logging',
}

/**
 * Verbose preset - Maximum logging
 *
 * Use this preset for deep debugging and analysis.
 * - Debug logging enabled
 * - Very detailed output
 * - High max steps for complex workflows
 * - Timestamps and context in logs
 */
export const verbosePreset: PresetConfig = {
  debug: true,
  logger: (msg: string) => {
    const timestamp = new Date().toISOString()
    const stack = new Error().stack?.split('\n')[2]?.trim() || 'unknown'
    console.log(`[${timestamp}] [VERBOSE] ${msg}`)
    console.log(`  └─ ${stack}`)
  },
  maxSteps: 100,
  description: 'Verbose mode with maximum logging and debugging',
}

/**
 * Performance preset - Optimized for speed
 *
 * Use this preset when performance is critical.
 * - No debug logging
 * - No-op logger for zero overhead
 * - Lower max steps to prevent long-running operations
 */
export const performancePreset: PresetConfig = {
  debug: false,
  logger: () => {}, // No-op logger for zero overhead
  maxSteps: 15,
  description: 'Performance mode optimized for speed',
}

/**
 * All available presets
 */
export const presets = {
  development: developmentPreset,
  production: productionPreset,
  testing: testingPreset,
  silent: silentPreset,
  verbose: verbosePreset,
  performance: performancePreset,
} as const

// ============================================================================
// Preset Factory Functions
// ============================================================================

/**
 * Create an adapter with a preset configuration
 *
 * @param preset - Preset name
 * @param overrides - Optional configuration overrides
 * @returns ClaudeCodeCLIAdapter configured with preset
 *
 * @example
 * ```typescript
 * // Development mode with custom working directory
 * const adapter = createAdapterWithPreset('development', {
 *   cwd: '/path/to/project'
 * })
 *
 * // Production mode with custom max steps
 * const adapter = createAdapterWithPreset('production', {
 *   cwd: '/path/to/project',
 *   maxSteps: 30
 * })
 *
 * // Testing mode for unit tests
 * const adapter = createAdapterWithPreset('testing', {
 *   cwd: testProjectPath
 * })
 * ```
 */
export function createAdapterWithPreset(
  preset: keyof typeof presets,
  overrides?: Partial<AdapterConfig>
): ClaudeCodeCLIAdapter {
  const presetConfig = presets[preset]

  const config: AdapterConfig = {
    cwd: overrides?.cwd ?? process.cwd(),
    debug: overrides?.debug ?? presetConfig.debug,
    logger: overrides?.logger ?? presetConfig.logger,
    maxSteps: overrides?.maxSteps ?? presetConfig.maxSteps,
    env: overrides?.env ?? {},
    // Always FREE mode (no API key)
    anthropicApiKey: undefined,
    retry: overrides?.retry,
    timeouts: overrides?.timeouts,
  }

  return new ClaudeCodeCLIAdapter(config)
}

/**
 * Create a development adapter
 *
 * Convenience function for creating an adapter with the development preset.
 *
 * @param cwd - Working directory (optional, defaults to process.cwd())
 * @returns ClaudeCodeCLIAdapter with development preset
 *
 * @example
 * ```typescript
 * const adapter = createDevelopmentAdapter()
 * const adapter = createDevelopmentAdapter('/path/to/project')
 * ```
 */
export function createDevelopmentAdapter(cwd?: string): ClaudeCodeCLIAdapter {
  return createAdapterWithPreset('development', { cwd })
}

/**
 * Create a production adapter
 *
 * Convenience function for creating an adapter with the production preset.
 *
 * @param cwd - Working directory (optional, defaults to process.cwd())
 * @returns ClaudeCodeCLIAdapter with production preset
 *
 * @example
 * ```typescript
 * const adapter = createProductionAdapter()
 * const adapter = createProductionAdapter('/path/to/project')
 * ```
 */
export function createProductionAdapter(cwd?: string): ClaudeCodeCLIAdapter {
  return createAdapterWithPreset('production', { cwd })
}

/**
 * Create a testing adapter
 *
 * Convenience function for creating an adapter with the testing preset.
 *
 * @param cwd - Working directory (optional, defaults to process.cwd())
 * @returns ClaudeCodeCLIAdapter with testing preset
 *
 * @example
 * ```typescript
 * describe('Agent Tests', () => {
 *   let adapter: ClaudeCodeCLIAdapter
 *
 *   beforeEach(() => {
 *     adapter = createTestingAdapter('/path/to/test/project')
 *   })
 *
 *   it('should execute agent', async () => {
 *     const result = await adapter.executeAgent(agent, prompt)
 *     expect(result.output).toBeDefined()
 *   })
 * })
 * ```
 */
export function createTestingAdapter(cwd?: string): ClaudeCodeCLIAdapter {
  return createAdapterWithPreset('testing', { cwd })
}

/**
 * Create a silent adapter
 *
 * Convenience function for creating an adapter with the silent preset.
 *
 * @param cwd - Working directory (optional, defaults to process.cwd())
 * @returns ClaudeCodeCLIAdapter with silent preset
 *
 * @example
 * ```typescript
 * const adapter = createSilentAdapter('/path/to/project')
 * ```
 */
export function createSilentAdapter(cwd?: string): ClaudeCodeCLIAdapter {
  return createAdapterWithPreset('silent', { cwd })
}

/**
 * Create a verbose adapter
 *
 * Convenience function for creating an adapter with the verbose preset.
 *
 * @param cwd - Working directory (optional, defaults to process.cwd())
 * @returns ClaudeCodeCLIAdapter with verbose preset
 *
 * @example
 * ```typescript
 * const adapter = createVerboseAdapter()
 * ```
 */
export function createVerboseAdapter(cwd?: string): ClaudeCodeCLIAdapter {
  return createAdapterWithPreset('verbose', { cwd })
}

/**
 * Create a performance adapter
 *
 * Convenience function for creating an adapter with the performance preset.
 *
 * @param cwd - Working directory (optional, defaults to process.cwd())
 * @returns ClaudeCodeCLIAdapter with performance preset
 *
 * @example
 * ```typescript
 * const adapter = createPerformanceAdapter()
 * ```
 */
export function createPerformanceAdapter(cwd?: string): ClaudeCodeCLIAdapter {
  return createAdapterWithPreset('performance', { cwd })
}

// ============================================================================
// Preset Utilities
// ============================================================================

/**
 * Get all available preset names
 *
 * @returns Array of preset names
 *
 * @example
 * ```typescript
 * const presetNames = getAvailablePresets()
 * console.log('Available presets:', presetNames)
 * // ['development', 'production', 'testing', 'silent', 'verbose', 'performance']
 * ```
 */
export function getAvailablePresets(): string[] {
  return Object.keys(presets)
}

/**
 * Get preset configuration by name
 *
 * @param presetName - Name of the preset
 * @returns Preset configuration or undefined
 *
 * @example
 * ```typescript
 * const config = getPreset('development')
 * console.log('Max steps:', config?.maxSteps)
 * ```
 */
export function getPreset(presetName: string): PresetConfig | undefined {
  return presets[presetName as keyof typeof presets]
}

/**
 * Print preset information
 *
 * @param presetName - Name of the preset
 *
 * @example
 * ```typescript
 * printPresetInfo('development')
 * // Development preset - Verbose logging and debugging
 * //   Debug: true
 * //   Max Steps: 50
 * //   Description: Development mode with verbose logging and debugging
 * ```
 */
export function printPresetInfo(presetName: string): void {
  const preset = getPreset(presetName)

  if (!preset) {
    console.error(`Preset not found: ${presetName}`)
    return
  }

  console.log(`\n${presetName} preset`)
  console.log(`  Debug: ${preset.debug}`)
  console.log(`  Max Steps: ${preset.maxSteps}`)
  console.log(`  Description: ${preset.description}`)
}

/**
 * Print all presets
 *
 * @example
 * ```typescript
 * printAllPresets()
 * ```
 */
export function printAllPresets(): void {
  console.log('\nAvailable Presets:\n')

  Object.entries(presets).forEach(([name, config]) => {
    console.log(`${name}:`)
    console.log(`  Debug: ${config.debug}`)
    console.log(`  Max Steps: ${config.maxSteps}`)
    console.log(`  Description: ${config.description}`)
    console.log()
  })
}

/**
 * Create a custom preset
 *
 * Create a new preset configuration from scratch or by extending an existing preset.
 *
 * @param basePreset - Optional base preset to extend
 * @param overrides - Configuration overrides
 * @returns Custom preset configuration
 *
 * @example
 * ```typescript
 * // Create custom preset from scratch
 * const myPreset = createCustomPreset(undefined, {
 *   debug: true,
 *   maxSteps: 30,
 *   logger: (msg) => console.log(`[CUSTOM] ${msg}`)
 * })
 *
 * // Extend existing preset
 * const myDevPreset = createCustomPreset('development', {
 *   maxSteps: 100,
 *   logger: customLogger
 * })
 *
 * // Use custom preset
 * const adapter = new ClaudeCodeCLIAdapter({
 *   cwd: process.cwd(),
 *   ...myPreset
 * })
 * ```
 */
export function createCustomPreset(
  basePreset?: keyof typeof presets,
  overrides?: Partial<PresetConfig>
): PresetConfig {
  const base = basePreset ? presets[basePreset] : productionPreset

  return {
    debug: overrides?.debug ?? base.debug,
    logger: overrides?.logger ?? base.logger,
    maxSteps: overrides?.maxSteps ?? base.maxSteps,
    description: overrides?.description ?? base.description ?? 'Custom preset',
  }
}

// ============================================================================
// Environment-Based Preset Selection
// ============================================================================

/**
 * Automatically select preset based on NODE_ENV
 *
 * @returns Appropriate preset name for current environment
 *
 * @example
 * ```typescript
 * const presetName = getPresetForEnvironment()
 * const adapter = createAdapterWithPreset(presetName)
 * ```
 */
export function getPresetForEnvironment(): keyof typeof presets {
  const env = process.env.NODE_ENV?.toLowerCase()

  switch (env) {
    case 'development':
    case 'dev':
      return 'development'

    case 'production':
    case 'prod':
      return 'production'

    case 'test':
    case 'testing':
      return 'testing'

    default:
      return 'production' // Safe default
  }
}

/**
 * Create adapter using environment-based preset selection
 *
 * Automatically selects the appropriate preset based on NODE_ENV.
 *
 * @param cwd - Working directory (optional)
 * @param overrides - Optional configuration overrides
 * @returns ClaudeCodeCLIAdapter with environment-appropriate preset
 *
 * @example
 * ```typescript
 * // Automatically selects preset based on NODE_ENV
 * const adapter = createAdapterForEnvironment()
 *
 * // With custom working directory
 * const adapter = createAdapterForEnvironment('/path/to/project')
 *
 * // With overrides
 * const adapter = createAdapterForEnvironment('/path/to/project', {
 *   maxSteps: 50
 * })
 * ```
 */
export function createAdapterForEnvironment(
  cwd?: string,
  overrides?: Partial<AdapterConfig>
): ClaudeCodeCLIAdapter {
  const preset = getPresetForEnvironment()

  return createAdapterWithPreset(preset, {
    cwd,
    ...overrides,
  })
}
