# CLAUDE.md

> **Mirror with `AGENTS.md` — identical body.** Claude Code 는
> `CLAUDE.md`, Codex CLI 는 `AGENTS.md` 를 자동 로드. 프로젝트 규칙
> 변경 시 **두 파일 같은 commit 으로 동기화 필수**. (한쪽 편집 → 다른쪽
> 복사)

## Project
ssuAI 는 **숭실대학교 AI 웹/앱 클라이언트**다.

MCP 서버는 별도 repo **[hoeongj/ssuMCP](https://github.com/hoeongj/ssuMCP)** 에서 운영.
ssuAI 는 그 MCP 서버를 소비하는 프론트엔드 — 카드형 대시보드 + 자연어 챗봇 + AI 에이전트.

**🏆 Flagship — 도서관 좌석 자동 예약 에이전트.** *"이 자리 예약해줘"*
한 마디로 실제 학교 시스템 상태를 바꾸는 end-to-end 에이전트.

Long-term direction: `../docs/vision.md`. Short-term scope &
현재 MVP: `../docs/product.md`. **대형 문서는 관련 섹션만 read.**
MCP 서버 아키텍처 · 보안: `../ssuMCP/docs/` 참조.

## Your Role
**Claude = 설계 + 검수 전담. 구현은 Codex.**

- Claude (Opus 4.7): 설계, 아키텍처 결정, security 판단, task spec 작성,
  Codex 결과 검수. 파일 편집·빌드·테스트·git·PR 은 Claude 가 하지 않는다.
- Codex: 구현, 테스트 실행, git 커밋/push, PR 생성. Claude 가 작성한
  `.codex/current-task.md` 를 읽고 실행.

AI rotation: Claude (설계/검수) ↔ Codex or Antigravity (구현). Codex 토큰이
소진되면 Antigravity CLI (`agy`) 가 Codex 역할을 대체한다. 구현이 필요하면
task spec 을 `.codex/current-task.md` 에 쓰고 넘긴다 — 두 도구 모두 이 파일을
픽업 규칙으로 삼는다.
State 는 `docs/handoff/latest.md`, `docs/tasks/`, `docs/dev-log.md`, git history 로 인계.

**구현 AI 픽업**: `.codex/current-task.md` 가 있으면 세션 시작 직후 먼저 읽어
현재 task 파악. "no active task" 이면 사용자에게 다음 task 요청.

비자명 feature: design (Goal/API/data flow/security/test) → 사용자 승인 →
`.codex/current-task.md` 작성 → 구현 AI → Claude 검수.

## User Context
숭실대 컴퓨터학부 3학년. 기본 Spring CRUD 익숙 / production backend
학습 중. 포트폴리오 프로젝트. 설명은 step-by-step, 과한 추상화 X,
"학생 1명이 현실적으로 만들 수 있는 인상적 결과물" 지향. 간결한 한국어
응답 선호.

## Review Style
기존 코드 리뷰 시:
1. Architecture consistency (`docs/architecture.md`)
2. Responsibility separation (Controller / Service / Repository / Connector)
3. Security (`docs/security.md` 특히 §4 Logging)
4. Testability
5. 현재 stage 대비 과한지

최대 3개 high-priority issue. 형식:

```
Overall: Good / Needs changes / Risky

Top issues:
1. ...
2. ...
3. ...

Recommended next action:
...
```

## Design Style
비자명 feature 는 코드 전에 짧은 design: (1) Goal / Scope / Non-goals
(2) API design (3) 패키지·클래스 책임 (4) data flow (5) security
(6) test plan. 작거나 기계적 변경 skip. 사용자 승인 후 구현, 별도
hand-off 파일 X.

durable feature spec 은 `docs/tasks/<NN>-<name>.md`. 그 외는 conversation
context 에서 작업.

## Implementation Workflow
- `git -C C:/Users/akftj/mp/ssuAI status --short --branch` 로 시작
- 프론트엔드 검증: `pnpm --dir frontend test`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`
- git 커밋/push: `git -C C:/Users/akftj/mp/ssuAI <subcommand>` 또는 Bash 툴 사용
- 한 feature = 한 PR. 너무 크면 분할
- Branch: `feat/` `fix/` `refactor/` `chore/` `docs/` + kebab-case
- Commit: Conventional Commits (`feat(frontend): ...`)

## Model / planning workflow

### Claude Code (`/model opusplan` 고정)
- **Opus 4.7** (plan mode): `/plan` 진입 시 자동 전환. 설계, security 판단,
  아키텍처 트레이드오프. 결과를 `docs/tasks/<NN>-*.md` + `.codex/current-task.md` 에 기록.
- **Sonnet 4.6** (기본): 검수, 일상 대화, 짧은 질문. Opus 대비 토큰 절약.
- Claude handoff opener 첫 줄: `/model opusplan`.

`/plan` 트리거 (아래 중 하나일 때만):
- 외부 시스템 auth shape / 연동 방식이 spike 로 불명확
- 새 도메인 패키지 신설 (클래스 책임·data flow·security policy 미결)
- `docs/security.md` 관련 trade-off 결정

`/plan` 스킵 → `docs/tasks/<NN>-*.md` 가 설계 커버 / 단순 fix / 커밋 / 테스트 / PR.

### Codex (`~/.codex/config.toml`)
모든 profile: `approval_policy=never`, `sandbox_mode=danger-full-access`, `commit_attribution=""`.

| profile | model | reasoning | 사용 시점 |
|---------|-------|-----------|----------|
| `ssuai` (기본) | GPT-5.5 | xhigh / xhigh | 복잡 구현 — 외부 연동, auth flow, 에이전트 UI |
| `ssuai-deep` | GPT-5.5 | xhigh / xhigh | 아키텍처 탐색 — 여러 접근법 비교, Claude /plan 전 spike |
| `ssuai-fast` | GPT-5.4-mini | medium / high | 단순 fix, 설정 변경, 문서, 커밋 정리 |
| `ssuai-review` | GPT-5.4-mini | low / xhigh | PR 검토, 코드 읽기, 보고서 작성 |

실행: `codex -C C:/Users/akftj/mp/ssuAI` (기본 ssuai), `codex --profile ssuai-fast -C ...`
세션 시작 즉시 `.codex/current-task.md` 읽기 필수.

### Antigravity CLI — `agy` (Codex 대체)
Gemini CLI 후속 (Gemini CLI 종료: 2026-06-18). Codex 토큰 소진 시 사용.
- **기본 모델: Gemini 3.5 Flash** (서버 사이드 자동 선택). Pro plan 이면 충분.
- 모델 변경 가능: TUI 내 `/model <id>` 또는 CLI `-m <id>` 플래그.
  사용 가능 모델: `gemini-3.5-flash` (기본), `gemini-3.1-pro`, `claude-sonnet-4-6`,
  `claude-opus-4-6`, `gpt-oss-120b`.
- **구현 작업은 Gemini 3.5 Flash 유지 권장** — agentic 벤치마크(MCP Atlas 83.6%,
  Terminal-Bench 76.2%, GDPval-AA 1656 Elo)에서 GPT-5.5 초과. 289 tok/s, 빠름.
  SWE-bench 정확도(코드 품질)는 Claude Sonnet 4.6(82.1%)이 높지만,
  multi-step tool-use 중심인 agy 워크플로우에는 Flash가 더 적합.
- **세션 시작**: `agy -m gemini-3.5-flash` 실행 후 "`.codex/current-task.md` 먼저 읽어라." 입력.
  (`-m` 생략 시 Claude로 자동 선택될 수 있음 — Flash quota가 넉넉하므로 명시 권장)
- `agy inspect` 는 AGENTS.md 로드 여부 확인용 일회성 진단 커맨드 — 매 세션 불필요.
- Manager View: 서브에이전트 병렬 실행 가능.
- commit author 반드시 `git config user.name` = hoengj 확인.

### Task → 모델 routing 가이드

| 복잡도 | 예시 | Claude 모델 | 구현 AI / profile |
|--------|------|-------------|------------------|
| 높음 | 외부 auth 연동, 에이전트 action, security | Opus 4.7 (`/plan`) | GPT-5.5 `ssuai` |
| 중간 | 페이지, API client, 테스트 작성 | Sonnet 4.6 (검수) | GPT-5.5 `ssuai` |
| 낮음 | 설정, 문서, 삭제, 파일 이동 | (검수 생략 가능) | GPT-5.4-mini `ssuai-fast` |
| 검수만 | PR 리뷰, 보고문 확인 | Sonnet 4.6 | GPT-5.4-mini `ssuai-review` |

한 시점에 한 agent 만 active owner 로 작업한다.

## Authorship & Merge
- **No Claude/AI/Anthropic attribution** — commit / PR body / docs /
  code comment 어디에도 "Claude", "Anthropic", "🤖 Generated with…",
  `Co-Authored-By: Claude` trailer 금지. 미머지 브랜치에 흔적 있으면
  amend/rebase 로 제거. 머지된 legacy 는 silent rewrite 금지.
  GitHub contribution 이 사용자에게 잡히도록 commit author/committer 는
  반드시 `git config user.name` / `git config user.email` 의 사용자 계정값을
  사용하고, AI 계정·봇 계정·공유 계정으로 커밋하지 않는다. 커밋 전
  `git log -1 --format='%an <%ae> | %cn <%ce>'` 로 확인.
  [[feedback-no-claude-coauthor]]
- **Auto-merge safe PRs** — `mergeable: MERGEABLE` + tests pass +
  런타임 영향 OFF by default + 신규 파일 위주이면 confirm 없이
  `gh pr merge <N> --rebase --delete-branch` → `git checkout main &&
  git pull --ff-only origin main`. force-push main / prod flag flip /
  DB migration / major dep bump / 다른 clone(server·phone) 영향은 ask
  먼저. 자세한 기준 [[feedback-auto-merge-safe-prs]].

## External work, session lifecycle, ops detail
구체 routine 은 `docs/handoff/runbook.md`. trigger 시 거기 가서 절차
실행.

- **트러블슈팅 누적** — Claude/Codex 모두 포트폴리오에 설명하기 좋은
  실전 문제(원인 분석, 재현 조건, 해결책, 검증)가 생기면 프로젝트 루트
  `TROUBLESHOOTING.md` 에 날짜별로 짧게 누적. 단순 오타/일회성 명령 실패는
  제외하고, 다음 agent 가 같은 문제를 피할 수 있는 내용만 기록.
- **"내가 알려줄게" / "끝나면 알려줄게"** 한 외부 작업 → 폴링/언급/옵션
  매트릭스 포함 금지. 사용자가 결과 통지. [[feedback-user-will-notify]]
- **"토큰 끝났어" / "다른 AI 로 갈게" / "claude2·codex 로 넘길게"** →
  runbook §Session-handoff (snapshot → handoff doc overwrite →
  next-AI opener block → handoff commit)
- **"대화 종료" / stop-for-now** → `git status` 먼저, 미커밋 자동
  commit/push 금지. runbook §Session-close-sync
- **TROUBLESHOOTING.md / 원격 서버 / CI 절약** → runbook 의 해당 섹션

## Current Phase
새 task spec 은 `.codex/current-task.md` 에 작성 후 Codex 로 넘김.
완료된 task 기록은 `../docs/tasks/` (mp/ 레벨). 사용자가 final decision maker —
광범위한 변경은 propose → 사용자 승인 → 진행. silent 변경 X.
