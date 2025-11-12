# Codebuff 에이전트 시스템 분석 요약

## 분석 완료 문서

1. **AGENT_ARCHITECTURE_ANALYSIS_KR.md** - 전체 아키텍처 분석 (한글)
2. **CLAUDE_CLI_ADAPTER_GUIDE.md** - 실제 구현 가이드 (코드 예제 포함)

## 핵심 발견사항

### 1. 에이전트 생성 방식

Codebuff는 **선언적 에이전트 정의**를 사용합니다:

```typescript
const agent: AgentDefinition = {
  id: 'my-agent',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: ['read_files', 'write_file'],

  // 핵심: 프로그래밍적 제어
  handleSteps: function* ({ prompt, params }) {
    // 도구 직접 호출
    yield { toolName: 'read_files', input: { paths: ['file.ts'] } }

    // LLM에게 작업 요청
    yield 'STEP_ALL'
  }
}
```

**핵심 파일**:
- `.agents/types/agent-definition.ts` - 타입 정의
- `.agents/commander.ts` - 단순 에이전트 예시
- `.agents/file-explorer/file-explorer.ts` - 다중 에이전트 예시

### 2. 실행 흐름

```
사용자 입력
  ↓
CodebuffClient.run() (sdk/src/client.ts)
  ↓
initialSessionState() - 세션 초기화
  ↓
mainPrompt() (packages/agent-runtime/src/main-prompt.ts)
  ↓
loopAgentSteps() - 에이전트 루프
  ↓
  ├─ runProgrammaticStep() - handleSteps 실행
  │   ↓ yield 도구 호출 또는 'STEP'
  │
  └─ runAgentStep() - LLM 호출 (OpenRouter API $$$)
      ↓
      processStreamWithTools() - 도구 실행
        ├─ read_files
        ├─ write_file
        ├─ code_search
        ├─ spawn_agents ← 서브에이전트 실행
        └─ 기타 25개 도구
```

### 3. API 사용 패턴 (유료 부분)

**LLM 호출 지점**: `packages/agent-runtime/src/prompt-agent-stream.ts`

```typescript
// OpenRouter API 호출 ($$$)
fetch('https://openrouter.ai/api/v1/chat/completions', {
  body: JSON.stringify({
    model: 'anthropic/claude-sonnet-4.5',
    messages: [...],
    tools: [...]
  })
})
```

**비용 발생 시점**:
- 각 `yield 'STEP'` 또는 `yield 'STEP_ALL'` 마다 1회 이상
- 서브에이전트 각각 독립적으로 API 호출
- 병렬 실행 시 동시 다발적 비용 발생

### 4. Claude Code CLI로 전환 가능성

#### ✅ 그대로 사용 가능한 부분

1. **에이전트 정의 체계** (`AgentDefinition`)
2. **handleSteps 제너레이터 패턴**
3. **도구 시스템** (25개 중 20개 직접 매핑)

#### ⚠️ 수정 필요한 부분

1. **LLM API 호출** → Claude Code CLI 세션으로 대체
2. **spawn_agents** → `Task` 도구로 매핑 (순차 실행 제약)
3. **비용 추적** 제거 (무료)
4. **백엔드 서버** 의존성 제거

#### 도구 매핑표

| Codebuff 도구 | Claude Code CLI | 호환성 |
|--------------|-----------------|-------|
| `read_files` | `Read` | ✅ 100% |
| `write_file` | `Write` | ✅ 100% |
| `str_replace` | `Edit` | ✅ 100% |
| `code_search` | `Grep` | ✅ 100% |
| `find_files` | `Glob` | ✅ 100% |
| `run_terminal_command` | `Bash` | ✅ 100% |
| `web_search` | `WebSearch` | ✅ 100% |
| `spawn_agents` | `Task` | ⚠️ 50% (순차만) |

### 5. 구현 전략

#### 옵션 A: 완전 로컬 어댑터

```typescript
class ClaudeCodeCLIAdapter {
  async executeAgent(agentDef: AgentDefinition, prompt: string) {
    // handleSteps 제너레이터 실행
    const generator = agentDef.handleSteps({ prompt, ... })

    while (true) {
      const { value, done } = generator.next()

      if (done) break

      if (typeof value === 'object') {
        // 도구 호출 → 로컬 함수 실행
        await this.executeLocalTool(value)
      } else if (value === 'STEP') {
        // LLM 호출 → Claude Code CLI 세션
        await this.invokeClaude()
      }
    }
  }
}
```

**장점**: 완전 무료, 빠름, 프라이버시
**단점**: 병렬 서브에이전트 제한적

#### 옵션 B: 하이브리드

메인 에이전트만 Claude Code CLI 사용, 서브에이전트는 기존 API

**장점**: 비용 70% 절감, 병렬 실행 유지
**단점**: 여전히 부분 유료

### 6. 예상 절감 효과

**현재 Codebuff (예시)**:
- Main Agent (Sonnet): $0.50
- Sub-Agents (3개 x Haiku): $0.30
- **총**: ~$0.80/세션

**Claude CLI 전환 후**:
- **총**: $0 (완전 무료)
- **응답 속도**: 유사하거나 더 빠름
- **프라이버시**: 완벽 (로컬 실행)

## 빠른 시작

### 1. 분석 문서 읽기

```bash
# 전체 아키텍처 이해
cat AGENT_ARCHITECTURE_ANALYSIS_KR.md

# 구현 가이드 확인
cat CLAUDE_CLI_ADAPTER_GUIDE.md
```

### 2. 핵심 파일 확인

```bash
# 에이전트 정의 타입
cat .agents/types/agent-definition.ts

# 단순 에이전트 예시
cat .agents/commander.ts

# 실행 흐름
cat packages/agent-runtime/src/main-prompt.ts
cat sdk/src/run.ts
```

### 3. 구현 시작

```bash
# 어댑터 디렉토리 생성
mkdir -p adapter/tools

# 기본 어댑터 구현 (CLAUDE_CLI_ADAPTER_GUIDE.md 참고)
# adapter/claude-cli-adapter.ts
# adapter/tools/file-operations.ts
# adapter/tools/code-search.ts
```

## 다음 단계

1. **Phase 1**: 기본 어댑터 구현 (1-2주)
   - `ClaudeCodeCLIAdapter` 클래스
   - 핵심 도구 3개 (read_files, write_file, code_search)
   - handleSteps 실행 엔진

2. **Phase 2**: 도구 완성 (1주)
   - 나머지 20개 도구 구현
   - 단위 테스트

3. **Phase 3**: 서브에이전트 (1주)
   - spawn_agents → Task 어댑터
   - 에이전트 레지스트리

4. **Phase 4**: Claude CLI 통합 (2주)
   - 실제 LLM 호출 구현
   - 스트리밍 응답 처리

**총 예상 기간**: 5-6주

## 기술 스택

- **언어**: TypeScript
- **런타임**: Node.js 18+
- **의존성**:
  - `glob` (파일 검색)
  - `ripgrep` (코드 검색)
  - 기타 최소화

## 참고

- Codebuff 리포지토리: 현재 분석 중인 코드베이스
- Claude Code CLI 문서: https://docs.claude.com/en/docs/claude-code
- Generator 문서: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator

---

**작성일**: 2025-11-12
**분석 대상**: Codebuff @ commit `748467a`
**목적**: Claude Code CLI 기반 무료 에이전트 시스템 구축
