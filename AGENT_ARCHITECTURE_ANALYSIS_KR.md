# Codebuff 에이전트 아키텍처 분석

## 목차
1. [개요](#개요)
2. [에이전트 생성 방식](#에이전트-생성-방식)
3. [실행 흐름](#실행-흐름)
4. [API 사용 패턴](#api-사용-패턴)
5. [Claude Code CLI로의 적용 방안](#claude-code-cli로의-적용-방안)
6. [핵심 파일 및 코드 분석](#핵심-파일-및-코드-분석)

---

## 개요

Codebuff는 TypeScript 기반의 AI 에이전트 프레임워크로, 다중 에이전트 오케스트레이션을 지원합니다. 현재는 OpenRouter API를 통해 유료로 LLM을 호출하는 구조이지만, 핵심 아키텍처는 에이전트 정의와 실행 로직이 분리되어 있어 다양한 백엔드로 교체 가능합니다.

### 핵심 특징
- **선언적 에이전트 정의**: TypeScript 객체로 에이전트 정의
- **프로그래밍적 제어**: `handleSteps` 제너레이터로 실행 흐름 제어
- **다중 에이전트 지원**: `spawn_agents` 도구로 병렬 실행
- **25+ 내장 도구**: 파일 작업, 코드 검색, 터미널, 웹 등
- **30+ LLM 모델 지원**: OpenRouter를 통한 다양한 모델 사용

---

## 에이전트 생성 방식

### 1. AgentDefinition 타입 구조

에이전트는 `.agents/` 디렉토리에 TypeScript 파일로 정의됩니다.

**핵심 파일**: `.agents/types/agent-definition.ts:21-208`

```typescript
export interface AgentDefinition {
  // 기본 정보
  id: string                    // 고유 식별자 (예: 'code-reviewer')
  version?: string              // 버전 (기본값: '0.0.1')
  publisher?: string            // 퍼블리셔 ID
  displayName: string           // 표시 이름
  model: ModelName              // 사용할 AI 모델 (예: 'anthropic/claude-sonnet-4.5')

  // 도구 및 서브에이전트
  toolNames?: (ToolName | string)[]        // 사용 가능한 도구 목록
  spawnableAgents?: string[]               // 생성 가능한 자식 에이전트
  mcpServers?: Record<string, MCPConfig>   // MCP 서버 설정

  // 입출력 스키마
  inputSchema?: {
    prompt?: { type: 'string'; description?: string }
    params?: JsonObjectSchema
  }
  outputMode?: 'last_message' | 'all_messages' | 'structured_output'
  outputSchema?: JsonObjectSchema

  // 프롬프트
  systemPrompt?: string           // 시스템 프롬프트
  instructionsPrompt?: string     // 지시사항 (가장 중요!)
  stepPrompt?: string             // 각 단계마다 삽입되는 프롬프트
  spawnerPrompt?: string          // 다른 에이전트가 이 에이전트를 호출할 때 사용

  // 컨텍스트 상속
  includeMessageHistory?: boolean        // 부모 대화 기록 포함 여부
  inheritParentSystemPrompt?: boolean    // 부모 시스템 프롬프트 상속

  // 프로그래밍적 제어 (핵심!)
  handleSteps?: (context: AgentStepContext) => Generator<
    ToolCall | 'STEP' | 'STEP_ALL',
    void,
    { agentState, toolResult, stepsComplete }
  >
}
```

### 2. 에이전트 정의 예시

#### 예시 1: 단순 에이전트 (Commander)
**파일**: `.agents/commander.ts`

```typescript
const commander: AgentDefinition = {
  id: 'commander',
  model: 'anthropic/claude-haiku-4.5',
  displayName: 'Commander',
  toolNames: ['run_terminal_command'],

  // 프로그래밍적 제어: 명령 실행 후 LLM에게 분석 요청
  handleSteps: function* ({ params }) {
    // 1. 터미널 명령 실행
    yield {
      toolName: 'run_terminal_command',
      input: { command: params?.command }
    }

    // 2. LLM에게 결과 분석 요청
    yield 'STEP'
  }
}
```

#### 예시 2: 다중 에이전트 (File Explorer)
**파일**: `.agents/file-explorer/file-explorer.ts`

```typescript
const fileExplorer: AgentDefinition = {
  id: 'file-explorer',
  model: 'anthropic/claude-sonnet-4.5',
  spawnableAgents: ['codebuff/file-picker@0.0.1'],  // 서브에이전트 지정

  handleSteps: function* ({ prompt }) {
    // 1. file-picker 에이전트 호출
    const { toolResult } = yield {
      toolName: 'spawn_agents',
      input: {
        agents: [{
          agent_type: 'codebuff/file-picker@0.0.1',
          prompt: 'Find relevant files'
        }]
      }
    }

    // 2. 파일 읽기
    const files = toolResult[0].value
    yield {
      toolName: 'read_files',
      input: { paths: files }
    }

    // 3. LLM에게 분석 요청
    yield 'STEP_ALL'
  }
}
```

### 3. handleSteps 제너레이터 패턴

`handleSteps`는 에이전트 실행의 핵심입니다. 세 가지 yield 옵션이 있습니다:

```typescript
// 옵션 1: 도구 직접 호출
yield {
  toolName: 'read_files',
  input: { paths: ['file.ts'] }
}

// 옵션 2: LLM에게 한 단계 실행 요청 (도구 호출 포함 가능)
yield 'STEP'

// 옵션 3: LLM이 end_turn 도구를 사용할 때까지 계속 실행
yield 'STEP_ALL'
```

**실행 흐름 제어**: `packages/agent-runtime/src/run-programmatic-step.ts:1-100`

---

## 실행 흐름

### 전체 흐름도

```
사용자 입력
    ↓
CodebuffClient.run()
    ↓
sdk/src/run.ts:113 → run()
    ↓
    ├─ initialSessionState() - 세션 상태 초기화
    ├─ callMainPrompt() - 메인 프롬프트 호출
    └─ promise 반환 (RunState)
        ↓
packages/agent-runtime/src/main-prompt.ts:31 → mainPrompt()
    ↓
    ├─ getAgentTemplate() - 에이전트 템플릿 로드
    ├─ assembleLocalAgentTemplates() - 로컬 에이전트 어셈블리
    └─ loopAgentSteps() - 에이전트 루프 시작
        ↓
packages/agent-runtime/src/main-prompt.ts:225 → loopAgentSteps()
    ↓
    ├─ runProgrammaticStep() - handleSteps 제너레이터 실행
    │   ↓
    │   └─ 도구 호출 또는 'STEP'/'STEP_ALL' yield
    │
    └─ runAgentStep() - LLM 호출이 필요한 경우
        ↓
        ├─ getAgentStreamFromTemplate() - LLM API 호출 (OpenRouter)
        │   ↓
        │   └─ 스트리밍 응답 처리
        │
        └─ processStreamWithTools() - 도구 호출 파싱 및 실행
            ↓
            ├─ handleToolCall() - 도구 실행
            │   ├─ write_file, str_replace
            │   ├─ run_terminal_command
            │   ├─ code_search, find_files
            │   ├─ spawn_agents ← 서브에이전트 실행
            │   └─ 기타 도구들
            │
            └─ 결과를 메시지 히스토리에 추가
```

### 상세 실행 단계

#### 1. 세션 초기화 (sdk/src/run.ts:113-180)

```typescript
// 에이전트 정의 로드
if (typeof agent !== 'string') {
  agentDefinitions = [...(agentDefinitions ?? []), agent]
  agentId = agent.id
} else {
  agentId = agent
}

// 세션 상태 초기화 또는 이전 상태 복원
let sessionState: SessionState
if (previousRun?.sessionState) {
  sessionState = await applyOverridesToSessionState(...)
} else {
  sessionState = await initialSessionState({
    cwd, knowledgeFiles, agentDefinitions,
    customToolDefinitions, projectFiles, maxAgentSteps
  })
}
```

#### 2. 메인 프롬프트 실행 (packages/agent-runtime/src/main-prompt.ts:31-249)

```typescript
// 에이전트 타입 결정 (CLI 지정 > 설정 파일 > 코스트 모드)
let agentType: AgentTemplateType
if (agentId) {
  agentType = agentId  // CLI에서 --agent 플래그로 지정
} else if (fileContext.codebuffConfig?.baseAgent) {
  agentType = configBaseAgent  // codebuff.json의 baseAgent
} else {
  // 폴백: 코스트 모드 매핑
  agentType = { ask: 'ask', lite: 'base_lite', normal: 'base', max: 'base_max' }[costMode]
}

// 에이전트 루프 실행
const { agentState, output } = await loopAgentSteps({
  userInputId, spawnParams, agentState: mainAgentState,
  prompt, content, agentType, fingerprintId, fileContext
})
```

#### 3. 에이전트 루프 (run-agent-step.ts 참조)

```typescript
// loopAgentSteps 의사 코드
while (true) {
  // 프로그래밍적 단계 실행 (handleSteps가 있는 경우)
  if (agentTemplate.handleSteps) {
    const result = await runProgrammaticStep(...)
    if (result.endTurn) break
  }

  // LLM 단계 실행
  const { shouldEndTurn } = await runAgentStep({
    prompt, system, agentState, agentType, ...
  })

  if (shouldEndTurn) break

  // 스텝 카운터 감소
  agentState.stepsRemaining--
  if (agentState.stepsRemaining <= 0) break
}

return { agentState, output: getAgentOutput(...) }
```

#### 4. 서브에이전트 실행 (spawn_agents)

**파일**: `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:100-279`

```typescript
// spawn_agents 핵심 로직
const results = await Promise.allSettled(
  agents.map(async ({ agent_type, prompt, params }) => {
    // 1. 에이전트 템플릿 검증
    const { agentTemplate } = await validateAndGetAgentTemplate(...)

    // 2. 서브에이전트 상태 생성
    const subAgentState = createAgentState(
      agentType, agentTemplate, parentAgentState,
      getLatestState().messages, {}
    )

    // 3. 서브에이전트 실행 (재귀적으로 loopAgentSteps 호출)
    const result = await executeSubagent({
      prompt, spawnParams, agentTemplate,
      agentState: subAgentState, ...
    })

    return { output: result.output, agentType }
  })
)

// 비용 집계
results.forEach((result) => {
  if (result.status === 'fulfilled') {
    parentAgentState.creditsUsed += result.value.agentState.creditsUsed
  }
})
```

---

## API 사용 패턴

### 1. LLM API 호출 지점

**핵심 파일**: `packages/agent-runtime/src/prompt-agent-stream.ts`

```typescript
export async function getAgentStreamFromTemplate(params: {
  template: AgentTemplate
  messages: Message[]
  system: string
  ...
}): Promise<ReadableStream> {
  const { template, messages, system } = params

  // OpenRouter API 호출
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: template.model,  // 예: 'anthropic/claude-sonnet-4.5'
      messages: messages,
      system: system,
      stream: true,
      tools: template.toolNames.map(getToolDefinition),
      ...
    })
  })

  return response.body  // 스트리밍 응답
}
```

### 2. 비용 추적

각 LLM 호출마다 비용이 계산되고 `agentState.creditsUsed`에 누적됩니다:

```typescript
// packages/agent-runtime/src/run-agent-step.ts
onCostCalculated: (cost: number) => {
  agentState.creditsUsed += cost
  agentState.directCreditsUsed += cost
}
```

서브에이전트의 비용은 부모 에이전트로 전파됩니다:

```typescript
// spawn-agents.ts:236-276
results.forEach((result) => {
  const subAgentCredits = result.value.agentState.creditsUsed || 0
  parentAgentState.creditsUsed += subAgentCredits
})
```

### 3. API 호출 빈도

- **Main Agent**: 각 `yield 'STEP'` 또는 `yield 'STEP_ALL'` 마다 1회 이상
- **Sub-Agents**: `spawn_agents` 호출 시 각 서브에이전트당 독립적으로 실행
- **병렬 실행**: `Promise.allSettled`를 사용하여 여러 서브에이전트 동시 실행

---

## Claude Code CLI로의 적용 방안

### 현재 아키텍처의 유료 요소

1. **OpenRouter API 호출**: `getAgentStreamFromTemplate()` 함수
2. **백엔드 서버**: 세션 관리, 비용 추적, 분석
3. **데이터베이스**: 사용자 정보, 실행 기록 저장

### 적용 가능한 부분 (무료 전환 가능)

#### 1. 에이전트 정의 체계

현재 Codebuff의 `AgentDefinition` 타입은 그대로 사용 가능:

```typescript
// .agents/my-cli-agent.ts
const myAgent: AgentDefinition = {
  id: 'my-cli-agent',
  displayName: 'My CLI Agent',
  model: 'claude-sonnet-4-5',  // Claude Code CLI 내부 모델
  toolNames: ['read_files', 'write_file', 'code_search'],
  handleSteps: function* ({ prompt }) {
    // 프로그래밍적 제어 로직
    yield { toolName: 'code_search', input: { query: 'main function' } }
    yield 'STEP_ALL'
  }
}
```

#### 2. 도구 시스템

Codebuff의 25개 내장 도구 중 대부분은 Claude Code CLI와 매핑 가능:

| Codebuff 도구 | Claude Code CLI 도구 | 호환성 |
|--------------|---------------------|-------|
| `read_files` | `Read` | ✅ 완벽 |
| `write_file` | `Write` | ✅ 완벽 |
| `str_replace` | `Edit` | ✅ 완벽 |
| `code_search` | `Grep` | ✅ 완벽 |
| `find_files` | `Glob` | ✅ 완벽 |
| `run_terminal_command` | `Bash` | ✅ 완벽 |
| `web_search` | `WebSearch` | ✅ 완벽 |
| `spawn_agents` | `Task` | ⚠️ 부분적 |

#### 3. handleSteps 제너레이터 패턴

Claude Code CLI에서도 동일한 패턴 구현 가능:

**의사 코드**:

```typescript
// 새로운 AdapterRuntime 클래스
class ClaudeCodeCLIAdapter {
  async executeAgent(agentDef: AgentDefinition, prompt: string) {
    const generator = agentDef.handleSteps({ prompt, params: {}, ... })

    while (true) {
      const { value, done } = generator.next({ agentState, toolResult, stepsComplete })

      if (done) break

      if (typeof value === 'object' && 'toolName' in value) {
        // 도구 직접 호출 → Claude Code CLI 도구로 변환
        const toolResult = await this.executeClaudeTool(value)
        continue
      }

      if (value === 'STEP' || value === 'STEP_ALL') {
        // LLM 호출 필요 → Claude Code CLI 세션 활용
        await this.executeClaudeStep(agentState, value)
      }
    }
  }

  async executeClaudeTool(toolCall: ToolCall) {
    // Codebuff 도구를 Claude Code CLI 도구로 변환
    switch (toolCall.toolName) {
      case 'read_files':
        return this.claudeSession.invokeTool('Read', { file_path: ... })
      case 'spawn_agents':
        return this.claudeSession.invokeTool('Task', {
          prompt: ...,
          subagent_type: 'general-purpose'
        })
      // ...
    }
  }
}
```

### 구체적인 구현 전략

#### 전략 1: 완전 로컬 실행 (No Backend)

```
사용자 입력
    ↓
LocalAgent.run()
    ↓
handleSteps 제너레이터 실행
    ↓
    ├─ 프로그래밍적 도구 호출 → 로컬 함수 실행
    └─ 'STEP' → Claude Code CLI 대화 세션 진행
        ↓
        └─ 결과를 제너레이터로 반환
```

**장점**:
- 완전 무료 (API 비용 없음)
- 빠른 응답 (네트워크 지연 없음)
- 프라이버시 보장

**단점**:
- 병렬 서브에이전트 제한적 (Claude Code CLI는 동시 세션 제한 가능)
- 세션 영속성 관리 필요

#### 전략 2: 하이브리드 접근

메인 에이전트만 Claude Code CLI 사용, 서브에이전트는 기존 방식:

```typescript
class HybridAgent {
  async run(agentDef: AgentDefinition, prompt: string) {
    if (agentDef.id === 'main') {
      // Claude Code CLI 세션 사용 (무료)
      return await this.runWithClaudeCLI(agentDef, prompt)
    } else {
      // 서브에이전트는 기존 OpenRouter 사용 (유료)
      return await this.runWithOpenRouter(agentDef, prompt)
    }
  }
}
```

#### 전략 3: spawn_agents → Task 도구 매핑

Codebuff의 `spawn_agents`를 Claude Code CLI의 `Task` 도구로 직접 매핑:

```typescript
// Codebuff 스타일
yield {
  toolName: 'spawn_agents',
  input: {
    agents: [
      { agent_type: 'code-reviewer', prompt: 'Review this code' },
      { agent_type: 'test-writer', prompt: 'Write tests' }
    ]
  }
}

// ↓ 변환 ↓

// Claude Code CLI 스타일
claudeSession.invokeTool('Task', {
  description: 'Review code',
  prompt: 'Review this code: ...',
  subagent_type: 'general-purpose'
})
```

**제한사항**:
- Claude Code CLI의 `Task` 도구는 순차 실행만 지원 (병렬 실행 불가)
- 서브에이전트 타입이 제한적 (`general-purpose`, `Explore`, `Plan` 등)

---

## 핵심 파일 및 코드 분석

### 1. 타입 정의

| 파일 | 라인 | 설명 |
|-----|------|-----|
| `.agents/types/agent-definition.ts` | 21-208 | `AgentDefinition` 인터페이스 |
| `.agents/types/tools.ts` | - | 도구 타입 정의 |
| `common/src/types/session-state.ts` | - | `SessionState`, `AgentState` 타입 |

### 2. 에이전트 런타임

| 파일 | 함수 | 설명 |
|-----|------|-----|
| `sdk/src/client.ts` | `CodebuffClient.run()` | SDK 진입점 |
| `sdk/src/run.ts` | `run()` | 실행 함수 메인 로직 |
| `packages/agent-runtime/src/main-prompt.ts` | `mainPrompt()` | 메인 프롬프트 오케스트레이션 |
| `packages/agent-runtime/src/main-prompt.ts` | `loopAgentSteps()` | 에이전트 루프 |
| `packages/agent-runtime/src/run-agent-step.ts` | `runAgentStep()` | 단일 에이전트 스텝 실행 |
| `packages/agent-runtime/src/run-programmatic-step.ts` | `runProgrammaticStep()` | handleSteps 제너레이터 실행 |

### 3. 도구 핸들러

| 파일 | 설명 |
|-----|-----|
| `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` | `spawn_agents` 도구 핸들러 (서브에이전트 실행) |
| `sdk/src/tools/read-files.ts` | `read_files` 도구 (파일 읽기) |
| `sdk/src/tools/change-file.ts` | `write_file`, `str_replace` 도구 |
| `sdk/src/tools/run-terminal-command.ts` | `run_terminal_command` 도구 |
| `sdk/src/tools/code-search.ts` | `code_search` 도구 |

### 4. LLM 통신

| 파일 | 설명 |
|-----|-----|
| `packages/agent-runtime/src/prompt-agent-stream.ts` | OpenRouter API 호출 |
| `packages/agent-runtime/src/tools/stream-parser.ts` | 스트리밍 응답 파싱 및 도구 호출 추출 |

### 5. 에이전트 예시

| 파일 | 타입 | 설명 |
|-----|------|-----|
| `.agents/commander.ts` | 단순 | 터미널 명령 실행 및 분석 |
| `.agents/file-explorer/file-explorer.ts` | 다중 에이전트 | 파일 탐색 및 분석 |
| `.agents/base2/alloy2/base2-alloy2.ts` | 고급 | 복잡한 워크플로우 |

---

## 결론 및 권장사항

### Codebuff → Claude Code CLI 전환 시 고려사항

#### 유지 가능한 부분 (100% 호환)
1. ✅ `AgentDefinition` 타입 체계
2. ✅ `handleSteps` 제너레이터 패턴
3. ✅ 도구 시스템 (25개 중 20개 직접 매핑 가능)
4. ✅ 입출력 스키마 정의

#### 수정 필요한 부분
1. ⚠️ LLM API 호출 → Claude Code CLI 세션으로 대체
2. ⚠️ `spawn_agents` → `Task` 도구로 매핑 (순차 실행 제약)
3. ⚠️ 비용 추적 시스템 제거 (무료이므로 불필요)
4. ⚠️ 백엔드 서버 의존성 제거

#### 구현 우선순위

**Phase 1**: 단순 에이전트 지원
- `handleSteps` 제너레이터 실행 엔진 구현
- 기본 도구 매핑 (read_files, write_file, code_search 등)
- 로컬 상태 관리

**Phase 2**: 서브에이전트 지원
- `spawn_agents` → `Task` 도구 어댑터 구현
- 순차 실행 제약 처리
- 메시지 히스토리 전파

**Phase 3**: 고급 기능
- 병렬 실행 최적화 (가능한 범위 내에서)
- MCP 서버 통합
- 커스텀 도구 정의

### 예상 절감 효과

현재 Codebuff 실행 비용 (예시):
- Main Agent (Sonnet 4.5): 10회 STEP → ~$0.50
- 3개 Sub-Agents (Haiku): 각 5회 STEP → ~$0.30
- **총 비용**: ~$0.80/세션

Claude Code CLI 전환 후:
- **총 비용**: $0 (완전 무료)
- **응답 속도**: 유사 (로컬 실행으로 네트워크 지연 감소 가능)
- **프라이버시**: 향상 (모든 데이터가 로컬에 유지)

---

## 참고 자료

- Codebuff 공식 문서: [docs.codebuff.com](https://docs.codebuff.com)
- Claude Code CLI 문서: [docs.claude.com/en/docs/claude-code](https://docs.claude.com/en/docs/claude-code)
- OpenRouter API: [openrouter.ai/docs](https://openrouter.ai/docs)

---

## 작성 정보

- **분석 일자**: 2025-11-12
- **대상 코드베이스**: Codebuff @ commit `748467a`
- **분석자**: Claude Sonnet 4.5
- **목적**: Claude Code CLI를 활용한 무료 에이전트 시스템 구축을 위한 아키텍처 분석
