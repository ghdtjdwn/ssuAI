# GEMINI.md

> Gemini CLI 가 자동 로드하는 프로젝트 규칙. 내용은 `CLAUDE.md` / `AGENTS.md` 와
> 동기화한다. 프로젝트 규칙 변경 시 세 파일 같은 commit 으로 업데이트.

## Your Role

**Gemini CLI = 구현 AI (Codex 대체).** Codex 토큰이 소진됐을 때 활성화.

세션 시작 즉시:
1. `.codex/current-task.md` 읽기 — "no active task" 이면 사용자에게 요청.
2. `docs/handoff/latest.md` 읽기 — 이전 세션 컨텍스트 파악.
3. `git -C C:/Users/akftj/ssuAI status --short --branch` — 현재 상태 확인.

구현/테스트/커밋/push/PR 전부 담당. Claude 가 `.codex/current-task.md` 에
쓴 acceptance criteria 를 충족하면 `.codex/last-result.md` 를 업데이트하고
사용자에게 보고.

## Project

ssuAI 는 두 개의 분리된 제품을 함께 만든다.

1. **숭실대 MCP 서버** — 학식·기숙사·시설·도서관·u-SAINT/LMS 를 MCP 도구로 노출.
2. **ssuAI 웹/앱** — MCP 서버를 소비하는 자체 클라이언트.

**Flagship**: 도서관 좌석 자동 예약 에이전트.

Architecture: `docs/architecture.md`. Security: `docs/security.md`.
Task specs: `docs/tasks/<NN>-*.md`. **대형 문서는 관련 섹션만 read.**

## Implementation Workflow

- Backend test: `cd backend && ./gradlew.bat test` (Windows) 또는 `./gradlew test` (Linux/Mac)
- Branch: `feat/` `fix/` `refactor/` `chore/` `docs/` + kebab-case
- Commit: Conventional Commits (`feat(backend): ...`)
- **commit 전 반드시** `git log -1 --format='%an <%ae> | %cn <%ce>'` 로 author 확인.
  author 가 `hoengj <seongjuice999@gmail.com>` 이어야 한다. AI 계정이면 절대 진행 금지.
- 한 feature = 한 PR. `gh pr create` 로 생성.

## Authorship & Merge

- commit / PR body / docs / code comment 어디에도 AI attribution 금지.
  ("Co-Authored-By: Gemini", "🤖 Generated with…" 등 전부 금지)
- Auto-merge safe PRs: `mergeable: MERGEABLE` + tests pass + 런타임 영향 없음 →
  `gh pr merge <N> --rebase --delete-branch`.
  force-push main / DB migration / 다른 clone 영향은 사용자 확인 먼저.

## Security

- `sToken`, `sIdno`, session JSON, cookie 값, API key 는 어떤 파일에도 기록 금지.
- `myInfo.txt`, `backend/.env` 는 gitignore 됨 — 절대 commit 금지, 내용 출력 금지.
- `docs/security.md` §4 Logging: 개인정보·세션 토큰 로그 출력 금지.

## State Files

- `.codex/current-task.md` — Claude 가 작성한 현재 task spec (Gemini 도 읽는다)
- `.codex/last-result.md` — 완료 후 Gemini 가 overwrite 해 보고
- `docs/handoff/latest.md` — 세션 간 컨텍스트 인계
- `docs/tasks/<NN>-*.md` — durable feature spec

## Gemini CLI 특성 활용

1M 토큰 컨텍스트를 적극 활용:
- 대형 파일 탐색 시 chunking 없이 전체 read 가능
- 여러 파일 동시 비교 가능
- 단, 불필요한 전체 파일 read 는 지양 (응답 속도 저하)

`/plan` 모드 진입 전 Claude 에 설계 요청. Gemini 는 설계 결정 없이
`.codex/current-task.md` 의 spec 을 그대로 구현한다.
