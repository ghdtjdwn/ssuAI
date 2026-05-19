# CLAUDE.md

> **Mirror with `AGENTS.md` — identical body.** Claude Code 는
> `CLAUDE.md`, Codex CLI 는 `AGENTS.md` 를 자동 로드. 프로젝트 규칙
> 변경 시 **두 파일 같은 commit 으로 동기화 필수**. (한쪽 편집 → 다른쪽
> 복사)

## Project
ssuAI 는 **두 개의 분리된 제품**을 함께 만든다.

1. **숭실대 MCP 서버** — 학식·기숙사·시설·도서관·u-SAINT/LMS 등 캠퍼스
   정보를 MCP 표준 도구로 노출하는 공개 서버. Claude Desktop · Cursor
   등 모든 MCP 클라이언트에서 동일하게 동작.
2. **ssuAI 웹/앱** — 위 MCP 서버를 소비하는 자체 클라이언트. 카드형
   대시보드 + 자연어 챗봇 + AI 에이전트.

**🏆 Flagship — 도서관 좌석 자동 예약 에이전트.** *"이 자리 예약해줘"*
한 마디로 실제 학교 시스템 상태를 바꾸는 end-to-end 에이전트.

Long-term direction: `README.md`, `docs/vision.md`. Short-term scope &
현재 MVP: `docs/product.md`. Architecture / Security playbook:
`docs/architecture.md`, `docs/security.md`. **대형 문서는 관련 섹션만
read** — 전체 read 는 task 범위가 정말 넓을 때만.

## Your Role
**Claude = 설계 + 검수 전담. 구현은 Codex.**

- Claude (Opus 4.7): 설계, 아키텍처 결정, security 판단, task spec 작성,
  Codex 결과 검수. 파일 편집·빌드·테스트·git·PR 은 Claude 가 하지 않는다.
- Codex: 구현, 테스트 실행, git 커밋/push, PR 생성. Claude 가 작성한
  `.codex/current-task.md` 를 읽고 실행.

3-AI rotation (claude1 / claude2 / codex) — Claude 토큰이 적어 설계/검수에만
집중. 구현이 필요하면 task spec 을 `.codex/current-task.md` 에 쓰고 Codex 로 넘긴다.
State 는 `docs/handoff/latest.md`, `docs/tasks/`, `docs/dev-log.md`, git history 로 인계.

**Codex 세션 픽업**: `.codex/current-task.md` 가 있으면 세션 시작 직후
먼저 읽어 현재 task 파악. Claude 가 여기에 task 를 써두고 넘긴다.

비자명 feature: design (Goal/API/data flow/security/test) → 사용자 승인 →
`.codex/current-task.md` 작성 → Codex 구현 → Claude 검수.

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
- `git -C C:/Users/akftj/ssuAI status --short --branch` 로 시작 (PowerShell cwd 가 backend/ 일 수 있으니 절대경로)
- 백엔드 테스트: PowerShell cwd = backend/ 기준 `.\gradlew.bat test` 또는 `.\gradlew.bat test --tests "..."`
- git 커밋/push: `git -C C:/Users/akftj/ssuAI <subcommand>` 또는 Bash 툴 사용
- 한 feature = 한 PR. 너무 크면 분할
- Branch: `feat/` `fix/` `refactor/` `chore/` `docs/` + kebab-case
- Commit: Conventional Commits (`feat(backend): ...`)
- Verify 후 done 선언: 백엔드 `.\gradlew.bat test`, 프론트 `pnpm --dir frontend test|lint|typecheck`

## Model / planning workflow
- **Claude 설계·아키텍처 결정** (`/plan` 진입) → Opus 4.7. 비자명 feature
  설계, security 판단, 아키텍처 트레이드오프. 결과를 `docs/tasks/<NN>-*.md`
  와 `.codex/current-task.md` 에 기록 후 Codex 에 넘긴다.
- **Claude 검수** → Codex 결과를 `Read` 로 파일 확인. 통째 diff/log 금지.
  acceptance criteria 충족 여부만 판단. 수정 필요 시 `.codex/current-task.md`
  에 재작업 지시를 쓰고 넘긴다.
- **Codex 기본 구현 세션** → `~/.codex/config.toml` 의 `ssuai` profile:
  GPT-5.5, `model_reasoning_effort=medium`,
  `plan_mode_reasoning_effort=xhigh`, `approval_policy=never`,
  `sandbox_mode=danger-full-access`. 구현/테스트/커밋/push/PR 전부 Codex.
- **Codex 설계 보조** → 필요 시 `codex --profile ssuai-deep -C C:/Users/akftj/ssuAI`.
  끝나면 구현은 기본 `ssuai` profile 로 돌아간다.

`/plan` 트리거 — **아래 중 하나여야 함:**
- 외부 시스템 auth shape / 연동 방식이 spike 로 불명확한 상황
- 새 도메인 패키지 신설 (클래스 책임·data flow·security policy 미결)
- `docs/security.md` 관련 trade-off 결정

**`/plan` 스킵 (task spec 작성 후 Codex 직행):**
- 해당 task 의 `docs/tasks/<NN>-*.md` spec 이 설계를 이미 커버
- 단순 fix / 커밋 / 테스트 / PR / spec 에 없는 사소한 판단

Claude handoff opener 의 첫 줄은 `/model opusplan`. Codex handoff 는
slash command 없이 시작하고, 필요 시 `ssuai-deep` profile 명을 명시한다.
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
`docs/tasks/` 에 active / pending spec. 사용자가 final decision maker —
광범위한 아키텍처 변경은 propose → 사용자 승인 → 진행. silent 변경 X.
