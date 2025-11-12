# Claude Code CLI 어댑터 구현 가이드

## 목차
1. [개요](#개요)
2. [핵심 어댑터 설계](#핵심-어댑터-설계)
3. [도구 매핑 구현](#도구-매핑-구현)
4. [handleSteps 실행 엔진](#handlesteps-실행-엔진)
5. [서브에이전트 처리](#서브에이전트-처리)
6. [예제 코드](#예제-코드)

---

## 개요

이 문서는 Codebuff의 에이전트 정의를 Claude Code CLI로 실행하기 위한 어댑터 구현 방법을 설명합니다.

### 핵심 아이디어

```
Codebuff AgentDefinition
         ↓
    Adapter Layer
         ↓
Claude Code CLI Tools
         ↓
    실행 결과
```

### 주요 변경 사항

| 항목 | Codebuff | Claude CLI Adapter |
|-----|----------|-------------------|
| LLM 호출 | OpenRouter API ($) | Claude Code 내부 세션 (무료) |
| 도구 실행 | 자체 구현 | Claude Code CLI 도구 |
| 서브에이전트 | `spawn_agents` (병렬) | `Task` 도구 (순차) |
| 상태 관리 | 백엔드 서버 | 로컬 메모리/파일 |

---

## 핵심 어댑터 설계

### 1. 기본 타입 정의

```typescript
// types/adapter.ts

import type { AgentDefinition } from './.agents/types/agent-definition'

/**
 * Claude Code CLI 도구 호출 결과
 */
export interface ClaudeToolResult {
  type: 'text' | 'json' | 'error'
  content: string | Record<string, any>
}

/**
 * 어댑터 설정
 */
export interface AdapterConfig {
  // 작업 디렉토리
  cwd: string

  // 환경 변수
  env?: Record<string, string>

  // 최대 스텝 수 (무한 루프 방지)
  maxSteps?: number

  // 디버그 모드
  debug?: boolean

  // 로거
  logger?: (message: string) => void
}

/**
 * 에이전트 실행 컨텍스트
 */
export interface AgentExecutionContext {
  agentId: string
  parentId?: string
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  stepsRemaining: number
  output?: Record<string, any>
}
```

### 2. 메인 어댑터 클래스

```typescript
// adapter/claude-cli-adapter.ts

import type { AgentDefinition, ToolCall } from '../.agents/types/agent-definition'
import type { AdapterConfig, AgentExecutionContext, ClaudeToolResult } from '../types/adapter'

export class ClaudeCodeCLIAdapter {
  private config: AdapterConfig
  private contexts: Map<string, AgentExecutionContext> = new Map()

  constructor(config: AdapterConfig) {
    this.config = {
      maxSteps: 20,
      debug: false,
      ...config
    }
  }

  /**
   * 에이전트 실행 메인 함수
   */
  async executeAgent(
    agentDef: AgentDefinition,
    prompt: string,
    params?: Record<string, any>,
    parentContext?: AgentExecutionContext
  ): Promise<{ output: any; messageHistory: any[] }> {
    // 실행 컨텍스트 생성
    const context: AgentExecutionContext = {
      agentId: crypto.randomUUID(),
      parentId: parentContext?.agentId,
      messageHistory: parentContext?.messageHistory ?? [],
      stepsRemaining: this.config.maxSteps!,
      output: undefined
    }

    this.contexts.set(context.agentId, context)

    try {
      // handleSteps 제너레이터가 있으면 프로그래밍적 실행
      if (agentDef.handleSteps) {
        return await this.executeWithHandleSteps(agentDef, prompt, params, context)
      }

      // 없으면 순수 LLM 모드
      return await this.executePureLLM(agentDef, prompt, context)
    } finally {
      this.contexts.delete(context.agentId)
    }
  }

  /**
   * handleSteps 제너레이터를 사용한 프로그래밍적 실행
   */
  private async executeWithHandleSteps(
    agentDef: AgentDefinition,
    prompt: string,
    params: Record<string, any> | undefined,
    context: AgentExecutionContext
  ): Promise<{ output: any; messageHistory: any[] }> {
    const logger = this.config.logger ?? (() => {})

    // 제너레이터 시작
    const generator = agentDef.handleSteps!({
      agentState: {
        agentId: context.agentId,
        runId: crypto.randomUUID(),
        parentId: context.parentId,
        messageHistory: context.messageHistory,
        output: context.output
      },
      prompt,
      params,
      logger: {
        info: (msg: any) => logger(`[INFO] ${JSON.stringify(msg)}`),
        debug: (msg: any) => this.config.debug && logger(`[DEBUG] ${JSON.stringify(msg)}`),
        warn: (msg: any) => logger(`[WARN] ${JSON.stringify(msg)}`),
        error: (msg: any) => logger(`[ERROR] ${JSON.stringify(msg)}`)
      }
    })

    let toolResult: any = undefined
    let stepsComplete = false

    while (context.stepsRemaining > 0) {
      const { value, done } = generator.next({
        agentState: {
          agentId: context.agentId,
          runId: crypto.randomUUID(),
          parentId: context.parentId,
          messageHistory: context.messageHistory,
          output: context.output
        },
        toolResult,
        stepsComplete
      })

      if (done) {
        stepsComplete = true
        break
      }

      // 도구 직접 호출
      if (typeof value === 'object' && 'toolName' in value) {
        logger(`Executing tool: ${value.toolName}`)
        toolResult = await this.executeToolCall(value as ToolCall, context)
        continue
      }

      // LLM 단일 스텝 실행
      if (value === 'STEP') {
        logger('Executing STEP (single LLM turn)')
        const result = await this.executeLLMStep(agentDef, context, false)
        stepsComplete = result.endTurn
        context.stepsRemaining--
        continue
      }

      // LLM 완료까지 실행
      if (value === 'STEP_ALL') {
        logger('Executing STEP_ALL (LLM until completion)')
        const result = await this.executeLLMStep(agentDef, context, true)
        stepsComplete = result.endTurn
        break
      }

      // STEP_TEXT (텍스트 출력)
      if (typeof value === 'object' && value.type === 'STEP_TEXT') {
        logger(`Output: ${value.text}`)
        context.messageHistory.push({
          role: 'assistant',
          content: value.text
        })
        continue
      }
    }

    return {
      output: context.output,
      messageHistory: context.messageHistory
    }
  }

  /**
   * 순수 LLM 모드 실행
   */
  private async executePureLLM(
    agentDef: AgentDefinition,
    prompt: string,
    context: AgentExecutionContext
  ): Promise<{ output: any; messageHistory: any[] }> {
    // 시스템 프롬프트 구성
    const systemPrompt = [
      agentDef.systemPrompt,
      agentDef.instructionsPrompt
    ].filter(Boolean).join('\n\n')

    // 사용자 메시지 추가
    context.messageHistory.push({
      role: 'user',
      content: prompt
    })

    // NOTE: 여기서는 실제 Claude Code CLI 세션을 시뮬레이션
    // 실제 구현에서는 Claude Code CLI와 통신하는 로직 필요
    const response = await this.invokeClaude({
      systemPrompt,
      messages: context.messageHistory,
      tools: agentDef.toolNames ?? []
    })

    context.messageHistory.push({
      role: 'assistant',
      content: response
    })

    return {
      output: { type: 'lastMessage', value: response },
      messageHistory: context.messageHistory
    }
  }

  /**
   * LLM 단일 스텝 실행
   */
  private async executeLLMStep(
    agentDef: AgentDefinition,
    context: AgentExecutionContext,
    runUntilComplete: boolean
  ): Promise<{ endTurn: boolean }> {
    // 시스템 프롬프트 구성
    const systemPrompt = [
      agentDef.systemPrompt,
      agentDef.instructionsPrompt,
      agentDef.stepPrompt
    ].filter(Boolean).join('\n\n')

    let endTurn = false

    if (runUntilComplete) {
      // STEP_ALL: end_turn 도구 사용까지 계속 실행
      while (context.stepsRemaining > 0) {
        const response = await this.invokeClaude({
          systemPrompt,
          messages: context.messageHistory,
          tools: agentDef.toolNames ?? []
        })

        context.messageHistory.push({
          role: 'assistant',
          content: response
        })

        // end_turn 도구 감지 (간단한 휴리스틱)
        if (response.includes('end_turn') || response.includes('DONE')) {
          endTurn = true
          break
        }

        // 도구 호출이 없으면 종료
        if (!response.includes('tool_call')) {
          endTurn = true
          break
        }

        context.stepsRemaining--
      }
    } else {
      // STEP: 단일 턴만 실행
      const response = await this.invokeClaude({
        systemPrompt,
        messages: context.messageHistory,
        tools: agentDef.toolNames ?? []
      })

      context.messageHistory.push({
        role: 'assistant',
        content: response
      })

      // 도구 호출이 없으면 end_turn으로 간주
      endTurn = !response.includes('tool_call')
    }

    return { endTurn }
  }

  /**
   * Claude Code CLI 호출 (시뮬레이션)
   *
   * 실제 구현에서는 아래 방법 중 하나 사용:
   * 1. Claude Code CLI의 내부 API 사용 (가능한 경우)
   * 2. 파일 기반 통신 (입력/출력 파일 교환)
   * 3. stdin/stdout 파이프
   */
  private async invokeClaude(params: {
    systemPrompt: string
    messages: any[]
    tools: string[]
  }): Promise<string> {
    // TODO: 실제 Claude Code CLI 통합
    // 현재는 플레이스홀더
    return `[Claude Response Placeholder]\nReceived ${params.messages.length} messages`
  }

  /**
   * 도구 호출 실행
   */
  private async executeToolCall(
    toolCall: ToolCall,
    context: AgentExecutionContext
  ): Promise<any> {
    const { toolName, input } = toolCall

    switch (toolName) {
      case 'read_files':
        return await this.toolReadFiles(input)

      case 'write_file':
        return await this.toolWriteFile(input)

      case 'str_replace':
        return await this.toolStrReplace(input)

      case 'code_search':
        return await this.toolCodeSearch(input)

      case 'find_files':
        return await this.toolFindFiles(input)

      case 'run_terminal_command':
        return await this.toolRunTerminal(input)

      case 'spawn_agents':
        return await this.toolSpawnAgents(input, context)

      case 'set_output':
        context.output = input.output
        return [{ type: 'json', value: { success: true } }]

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  // 도구 구현 메서드들은 다음 섹션에서...
}
```

---

## 도구 매핑 구현

### 1. 파일 작업 도구

```typescript
// adapter/tools/file-operations.ts

import { promises as fs } from 'fs'
import path from 'path'

export class FileOperationsTools {
  constructor(private cwd: string) {}

  /**
   * read_files 도구
   * Codebuff: read_files({ paths: string[] })
   * Claude CLI: Read tool (file_path: string)
   */
  async readFiles(input: { paths: string[] }) {
    const results: Record<string, string | null> = {}

    for (const filePath of input.paths) {
      try {
        const fullPath = path.resolve(this.cwd, filePath)
        const content = await fs.readFile(fullPath, 'utf-8')
        results[filePath] = content
      } catch (error) {
        results[filePath] = null
      }
    }

    return [
      {
        type: 'json',
        value: results
      }
    ]
  }

  /**
   * write_file 도구
   * Codebuff: write_file({ path: string, content: string })
   * Claude CLI: Write tool (file_path: string, content: string)
   */
  async writeFile(input: { path: string; content: string }) {
    try {
      const fullPath = path.resolve(this.cwd, input.path)

      // 디렉토리 생성
      await fs.mkdir(path.dirname(fullPath), { recursive: true })

      // 파일 쓰기
      await fs.writeFile(fullPath, input.content, 'utf-8')

      return [
        {
          type: 'json',
          value: { success: true, path: input.path }
        }
      ]
    } catch (error: any) {
      return [
        {
          type: 'json',
          value: { success: false, error: error.message }
        }
      ]
    }
  }

  /**
   * str_replace 도구
   * Codebuff: str_replace({ path, old_string, new_string })
   * Claude CLI: Edit tool (file_path, old_string, new_string)
   */
  async strReplace(input: {
    path: string
    old_string: string
    new_string: string
  }) {
    try {
      const fullPath = path.resolve(this.cwd, input.path)

      // 파일 읽기
      let content = await fs.readFile(fullPath, 'utf-8')

      // 문자열 대체
      const newContent = content.replace(input.old_string, input.new_string)

      // 변경 사항이 없으면 경고
      if (content === newContent) {
        return [
          {
            type: 'json',
            value: {
              success: false,
              error: 'old_string not found in file'
            }
          }
        ]
      }

      // 파일 쓰기
      await fs.writeFile(fullPath, newContent, 'utf-8')

      return [
        {
          type: 'json',
          value: { success: true, path: input.path }
        }
      ]
    } catch (error: any) {
      return [
        {
          type: 'json',
          value: { success: false, error: error.message }
        }
      ]
    }
  }
}
```

### 2. 코드 검색 도구

```typescript
// adapter/tools/code-search.ts

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export class CodeSearchTools {
  constructor(private cwd: string) {}

  /**
   * code_search 도구
   * Codebuff: code_search({ query: string, file_pattern?: string })
   * Claude CLI: Grep tool (pattern: string, glob?: string)
   */
  async codeSearch(input: {
    query: string
    file_pattern?: string
    case_sensitive?: boolean
  }) {
    try {
      // ripgrep 사용 (Claude Code CLI와 동일)
      const args = [
        'rg',
        '--json',
        input.case_sensitive ? '' : '-i',
        input.file_pattern ? `--glob "${input.file_pattern}"` : '',
        `"${input.query}"`,
        this.cwd
      ].filter(Boolean)

      const { stdout } = await execAsync(args.join(' '))

      // JSON Lines 파싱
      const results = stdout
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
        .filter(item => item.type === 'match')
        .map(item => ({
          path: item.data.path.text,
          line_number: item.data.line_number,
          line: item.data.lines.text.trim()
        }))

      return [
        {
          type: 'json',
          value: { results, total: results.length }
        }
      ]
    } catch (error: any) {
      // ripgrep exit code 1 = no matches (정상)
      if (error.code === 1) {
        return [
          {
            type: 'json',
            value: { results: [], total: 0 }
          }
        ]
      }

      return [
        {
          type: 'json',
          value: { error: error.message }
        }
      ]
    }
  }

  /**
   * find_files 도구
   * Codebuff: find_files({ pattern: string })
   * Claude CLI: Glob tool (pattern: string)
   */
  async findFiles(input: { pattern: string; cwd?: string }) {
    try {
      const searchDir = input.cwd
        ? path.resolve(this.cwd, input.cwd)
        : this.cwd

      // glob 패키지 사용 (또는 fast-glob)
      const { glob } = await import('glob')
      const files = await glob(input.pattern, {
        cwd: searchDir,
        nodir: true,
        absolute: false
      })

      return [
        {
          type: 'json',
          value: { files, total: files.length }
        }
      ]
    } catch (error: any) {
      return [
        {
          type: 'json',
          value: { error: error.message }
        }
      ]
    }
  }
}
```

### 3. 터미널 도구

```typescript
// adapter/tools/terminal.ts

import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class TerminalTools {
  constructor(
    private cwd: string,
    private env?: Record<string, string>
  ) {}

  /**
   * run_terminal_command 도구
   * Codebuff: run_terminal_command({ command, timeout_seconds })
   * Claude CLI: Bash tool (command: string, timeout?: number)
   */
  async runTerminalCommand(input: {
    command: string
    mode?: 'user' | 'agent'
    process_type?: 'SYNC' | 'ASYNC'
    timeout_seconds?: number
    cwd?: string
  }) {
    try {
      const execCwd = input.cwd
        ? path.resolve(this.cwd, input.cwd)
        : this.cwd

      const timeout = input.timeout_seconds
        ? input.timeout_seconds * 1000
        : 30000

      const { stdout, stderr } = await execAsync(input.command, {
        cwd: execCwd,
        env: { ...process.env, ...this.env },
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      })

      return [
        {
          type: 'text',
          text: `$ ${input.command}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ''}`
        }
      ]
    } catch (error: any) {
      return [
        {
          type: 'text',
          text: `$ ${input.command}\nError: ${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`
        }
      ]
    }
  }
}
```

---

## handleSteps 실행 엔진

### 완전한 제너레이터 실행 예시

```typescript
// adapter/handle-steps-executor.ts

import type { AgentDefinition, AgentStepContext } from '../.agents/types/agent-definition'

export class HandleStepsExecutor {
  /**
   * handleSteps 제너레이터를 완전히 실행
   */
  async execute(
    agentDef: AgentDefinition,
    context: AgentStepContext,
    toolExecutor: (toolCall: any) => Promise<any>,
    llmExecutor: (mode: 'STEP' | 'STEP_ALL') => Promise<{ endTurn: boolean }>
  ): Promise<void> {
    if (!agentDef.handleSteps) {
      throw new Error('No handleSteps defined for this agent')
    }

    const generator = agentDef.handleSteps(context)

    let lastToolResult: any = undefined
    let stepsComplete = false
    let iterationCount = 0
    const maxIterations = 100 // 무한 루프 방지

    while (iterationCount < maxIterations) {
      iterationCount++

      // 제너레이터 다음 단계
      const { value, done } = generator.next({
        agentState: context.agentState,
        toolResult: lastToolResult,
        stepsComplete
      })

      // 완료
      if (done) {
        break
      }

      // 도구 호출
      if (typeof value === 'object' && 'toolName' in value) {
        lastToolResult = await toolExecutor(value)

        // set_output 도구는 특별 처리
        if (value.toolName === 'set_output') {
          context.agentState.output = value.input.output
        }

        continue
      }

      // LLM 단일 스텝
      if (value === 'STEP') {
        const result = await llmExecutor('STEP')
        stepsComplete = result.endTurn

        if (stepsComplete) {
          break
        }

        continue
      }

      // LLM 완료까지
      if (value === 'STEP_ALL') {
        await llmExecutor('STEP_ALL')
        stepsComplete = true
        break
      }

      // 텍스트 출력
      if (typeof value === 'object' && value.type === 'STEP_TEXT') {
        console.log(value.text)
        context.agentState.messageHistory.push({
          role: 'assistant',
          content: value.text
        })
        continue
      }

      // 알 수 없는 값
      console.warn('Unknown handleSteps yield value:', value)
    }

    if (iterationCount >= maxIterations) {
      throw new Error('HandleSteps exceeded maximum iterations (possible infinite loop)')
    }
  }
}
```

---

## 서브에이전트 처리

### spawn_agents → Task 도구 어댑터

```typescript
// adapter/tools/spawn-agents.ts

import type { AgentDefinition } from '../../.agents/types/agent-definition'
import type { ClaudeCodeCLIAdapter } from '../claude-cli-adapter'

export class SpawnAgentsAdapter {
  constructor(
    private adapter: ClaudeCodeCLIAdapter,
    private agentRegistry: Map<string, AgentDefinition>
  ) {}

  /**
   * spawn_agents 도구 구현
   *
   * Codebuff: 병렬 실행 (Promise.allSettled)
   * Claude CLI: 순차 실행 (Task 도구 제약)
   */
  async spawnAgents(input: {
    agents: Array<{
      agent_type: string
      prompt: string
      params?: Record<string, any>
    }>
  }, parentContext: any) {
    const results = []

    // NOTE: Claude Code CLI의 Task 도구는 병렬 실행을 지원하지 않으므로
    // 순차 실행으로 대체 (성능 트레이드오프)
    for (const agentSpec of input.agents) {
      try {
        // 에이전트 정의 조회
        const agentDef = this.agentRegistry.get(agentSpec.agent_type)

        if (!agentDef) {
          results.push({
            agentType: agentSpec.agent_type,
            agentName: agentSpec.agent_type,
            value: { errorMessage: `Agent not found: ${agentSpec.agent_type}` }
          })
          continue
        }

        // 서브에이전트 실행
        const { output } = await this.adapter.executeAgent(
          agentDef,
          agentSpec.prompt,
          agentSpec.params,
          parentContext
        )

        results.push({
          agentType: agentSpec.agent_type,
          agentName: agentDef.displayName,
          value: output
        })

      } catch (error: any) {
        results.push({
          agentType: agentSpec.agent_type,
          agentName: agentSpec.agent_type,
          value: { errorMessage: error.message }
        })
      }
    }

    return [
      {
        type: 'json',
        value: results
      }
    ]
  }

  /**
   * 병렬 실행 버전 (실험적)
   *
   * Claude Code CLI가 여러 세션 동시 실행을 지원한다면 사용 가능
   */
  async spawnAgentsParallel(input: {
    agents: Array<{
      agent_type: string
      prompt: string
      params?: Record<string, any>
    }>
  }, parentContext: any) {
    const promises = input.agents.map(async (agentSpec) => {
      const agentDef = this.agentRegistry.get(agentSpec.agent_type)

      if (!agentDef) {
        return {
          agentType: agentSpec.agent_type,
          agentName: agentSpec.agent_type,
          value: { errorMessage: `Agent not found: ${agentSpec.agent_type}` }
        }
      }

      const { output } = await this.adapter.executeAgent(
        agentDef,
        agentSpec.prompt,
        agentSpec.params,
        parentContext
      )

      return {
        agentType: agentSpec.agent_type,
        agentName: agentDef.displayName,
        value: output
      }
    })

    const results = await Promise.allSettled(promises)

    return [
      {
        type: 'json',
        value: results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            return {
              agentType: input.agents[index].agent_type,
              agentName: input.agents[index].agent_type,
              value: { errorMessage: result.reason }
            }
          }
        })
      }
    ]
  }
}
```

---

## 예제 코드

### 전체 사용 예시

```typescript
// examples/run-agent.ts

import { ClaudeCodeCLIAdapter } from './adapter/claude-cli-adapter'
import commanderAgent from './.agents/commander'
import type { AgentDefinition } from './.agents/types/agent-definition'

async function main() {
  // 어댑터 초기화
  const adapter = new ClaudeCodeCLIAdapter({
    cwd: process.cwd(),
    maxSteps: 20,
    debug: true,
    logger: (msg) => console.log(`[Adapter] ${msg}`)
  })

  // 에이전트 실행
  const result = await adapter.executeAgent(
    commanderAgent,
    'Show me the git status',
    { command: 'git status' }
  )

  console.log('Output:', result.output)
  console.log('Message History:', result.messageHistory)
}

main().catch(console.error)
```

### 커스텀 에이전트 정의 및 실행

```typescript
// examples/custom-agent.ts

import type { AgentDefinition } from '../.agents/types/agent-definition'
import { ClaudeCodeCLIAdapter } from '../adapter/claude-cli-adapter'

// 커스텀 에이전트 정의
const codeReviewer: AgentDefinition = {
  id: 'code-reviewer',
  displayName: 'Code Reviewer',
  model: 'claude-sonnet-4-5',
  toolNames: ['read_files', 'code_search'],

  systemPrompt: `You are an expert code reviewer focused on:
- Code quality and best practices
- Security vulnerabilities
- Performance issues
- Maintainability`,

  handleSteps: function* ({ prompt, params }) {
    // 1. 파일 찾기
    const { toolResult: searchResult } = yield {
      toolName: 'code_search',
      input: {
        query: params.query || 'TODO|FIXME',
        file_pattern: params.pattern || '**/*.ts'
      }
    }

    // 2. 관련 파일 읽기
    const files = searchResult[0].value.results
      .map((r: any) => r.path)
      .slice(0, 5) // 최대 5개 파일

    if (files.length > 0) {
      yield {
        toolName: 'read_files',
        input: { paths: files }
      }
    }

    // 3. LLM에게 코드 리뷰 요청
    yield 'STEP_ALL'
  }
}

// 실행
async function reviewCode() {
  const adapter = new ClaudeCodeCLIAdapter({
    cwd: '/path/to/project',
    debug: true
  })

  const result = await adapter.executeAgent(
    codeReviewer,
    'Review the authentication code',
    {
      query: 'auth|login|password',
      pattern: '**/*.ts'
    }
  )

  console.log('Review:', result.output)
}

reviewCode().catch(console.error)
```

### 다중 에이전트 워크플로우

```typescript
// examples/multi-agent-workflow.ts

import type { AgentDefinition } from '../.agents/types/agent-definition'

// 파일 탐색 에이전트
const fileExplorer: AgentDefinition = {
  id: 'file-explorer',
  displayName: 'File Explorer',
  model: 'claude-sonnet-4-5',
  toolNames: ['find_files', 'read_files'],
  spawnableAgents: [], // 서브에이전트 없음

  handleSteps: function* ({ prompt, params }) {
    // 파일 찾기
    yield {
      toolName: 'find_files',
      input: { pattern: params.pattern }
    }

    // LLM에게 분석 요청
    yield 'STEP'
  }
}

// 오케스트레이터 에이전트
const orchestrator: AgentDefinition = {
  id: 'orchestrator',
  displayName: 'Orchestrator',
  model: 'claude-sonnet-4-5',
  toolNames: ['spawn_agents'],
  spawnableAgents: ['file-explorer', 'code-reviewer'],

  handleSteps: function* ({ prompt }) {
    // 1. 파일 탐색
    const { toolResult: explorerResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [{
          agent_type: 'file-explorer',
          prompt: 'Find all TypeScript files',
          params: { pattern: '**/*.ts' }
        }]
      }
    }

    // 2. 코드 리뷰
    yield {
      toolName: 'spawn_agents',
      input: {
        agents: [{
          agent_type: 'code-reviewer',
          prompt: 'Review the found files',
          params: {
            files: explorerResult[0].value
          }
        }]
      }
    }

    // 3. 최종 요약
    yield 'STEP'
  }
}

// 실행
import { ClaudeCodeCLIAdapter } from '../adapter/claude-cli-adapter'

async function runWorkflow() {
  const adapter = new ClaudeCodeCLIAdapter({ cwd: process.cwd() })

  // 에이전트 레지스트리에 등록
  adapter.registerAgent(fileExplorer)
  adapter.registerAgent(codeReviewer)
  adapter.registerAgent(orchestrator)

  // 오케스트레이터 실행
  const result = await adapter.executeAgent(
    orchestrator,
    'Analyze and review the codebase'
  )

  console.log(result.output)
}

runWorkflow().catch(console.error)
```

---

## 구현 체크리스트

### Phase 1: 기본 어댑터
- [ ] `ClaudeCodeCLIAdapter` 클래스 구현
- [ ] handleSteps 제너레이터 실행 엔진
- [ ] 기본 도구 매핑 (read_files, write_file, code_search)
- [ ] 로컬 상태 관리
- [ ] 에러 처리 및 로깅

### Phase 2: 도구 완성
- [ ] 모든 25개 도구 구현
- [ ] 도구별 단위 테스트
- [ ] 도구 실행 타임아웃 처리
- [ ] 대용량 출력 처리 (버퍼 관리)

### Phase 3: 서브에이전트
- [ ] spawn_agents 도구 구현
- [ ] 에이전트 레지스트리
- [ ] 순차 실행 로직
- [ ] (선택) 병렬 실행 실험
- [ ] 비용 추적 제거

### Phase 4: Claude CLI 통합
- [ ] Claude Code CLI API 조사
- [ ] 실제 LLM 호출 구현
- [ ] 스트리밍 응답 처리
- [ ] 컨텍스트 캐싱 활용

### Phase 5: 최적화
- [ ] 성능 프로파일링
- [ ] 메모리 사용량 최적화
- [ ] 병렬 처리 개선
- [ ] 캐싱 전략

---

## 다음 단계

1. **Phase 1 구현 시작**: 기본 어댑터와 핵심 도구 3개 구현
2. **테스트 작성**: Commander 에이전트로 E2E 테스트
3. **Claude CLI 통합 조사**: Claude Code CLI의 프로그래밍적 API 가능성 탐색
4. **문서화**: API 레퍼런스 및 사용 가이드 작성

---

## 참고 자료

- Codebuff 원본 코드: `packages/agent-runtime/`
- Claude Code CLI 도구 문서
- TypeScript Generator 문서: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator
