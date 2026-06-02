# AGENTS.md

> **Mirror with `CLAUDE.md` — identical body.** Claude Code 는
> `CLAUDE.md`, Codex CLI 는 `AGENTS.md` 를 자동 로드. 프로젝트 규칙
> 변경 시 **두 파일 같은 commit 으로 동기화 필수**. (한쪽 편집 → 다른쪽
> 복사)

## Project
ssuAI 는 **숭실대학교 AI 웹/앱 클라이언트**다.

MCP 서버는 별도 repo **[ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP)** 에서 운영.
ssuAI 는 그 MCP 서버를 소비하는 프론트엔드 — 카드형 대시보드 + 자연어 챗봇 + AI 에이전트.

**🏆 Flagship 목표 — 도서관 좌석 자동 예약 에이전트.** *"이 자리 예약해줘"*
현재 조회·인증 기반 위에 안전한 확인 단계와 write tool 을 추가할 후속 범위다.

Long-term direction: `docs/vision.md`. Current shipped scope:
`docs/product.md`. **대형 문서는 관련 섹션만 read.**
MCP 서버 아키텍처 · 보안: `../ssuMCP/docs/` 참조.

## Your Role
**Claude = 설계 + 검수 전담. 구현은 Codex / AGY.**

- **Claude**: 설계, 아키텍처 결정, security 판단, task spec 작성, 검수.
  파일 편집·빌드·테스트·git·PR·merge 는 Claude 가 하지 않는다.
- **Codex / AGY**: `.codex/current-task.md` 를 읽고 구현 → 테스트 →
  commit → push → PR 생성 → PR merge → main pull 까지 **전부 실행**.
  완료 후 DONE 블록 출력 (아래 § 참조). 사용자 개입 최소.

AI rotation: Claude (설계/검수) ↔ Codex or AGY (구현).
Codex 토큰 소진 → `agy -m gemini-3.5-flash` 실행 → **"task 읽어"** 한 마디.
동일한 `.codex/current-task.md` 를 읽고 즉시 이어서 작업한다.

**구현 AI 픽업**: 사용자가 **"task 읽어"** 를 입력하면 `.codex/current-task.md` 를
즉시 읽고 실행. 세션 시작 시에도 이 파일을 먼저 확인한다.
"no active task" 면 사용자에게 다음 task 요청.

비자명 feature: design (Goal/API/data flow/security/test) → 사용자 승인 →
`.codex/current-task.md` 작성 → 구현 AI → Claude 검수.

---

## 구현 AI 순환 루프 (작업 사이클)

```
1. Claude: task spec → .codex/current-task.md 에 저장
        ↓
2. 사용자: Codex / AGY 에 "task 읽어" 한 마디
        ↓
3. Codex / AGY: 구현 → 테스트 → commit → push → PR → merge → main pull
   완료 후 DONE 블록 출력 (요약 + 수정 파일 목록)
        ↓
4. 사용자: DONE 블록을 Claude 에 복사·전달
        ↓
5. Claude: 수정 파일 목록만 Read → 검수 → 다음 task 즉시 .codex/current-task.md 에 작성
        ↓
   (1 로 돌아가 반복)
```

**토큰 효율화 원칙**: Claude 는 DONE 블록의 "수정 파일" 목록에 있는 파일만 읽는다.
목록에 없는 파일은 읽지 않는다.

---

## DONE 블록 — 구현 AI 완료 출력 형식

작업이 완전히 끝난 뒤 **반드시** 아래 형식을 마지막에 출력:

```
=== DONE ===
요약: [무슨 작업을 했는지 1~2줄]
테스트: pnpm test 통과 / pnpm lint 통과 / pnpm build 통과
커밋: [short-hash] [commit message]
PR: https://github.com/ghdtjdwn/ssuAI/pull/NNN  (없으면 "없음")
머지: 완료 / 대기중

수정 파일:
  A hooks/useNewHook.ts
  M lib/api/library.ts
  D hooks/useOldHook.ts
=============
```

파일 목록 생성 명령어: `git show --stat --format="" HEAD | head -30`
(또는 `git diff --name-status HEAD~1..HEAD`)

**Claude 는 이 목록의 파일만 Read 하여 검수한다.**

---

## Credentials & 사용자 정보

구현 AI 가 credentials / 개인정보가 필요할 때 아래 순서로 조회:

1. `C:/Users/akftj/mp/myInfo.txt` — 학번, 비밀번호, 서버 IP 등 직접 수집 정보
2. `C:/Users/akftj/mp/ssuAI/.env.local` — 프론트 환경변수
3. `C:/Users/akftj/mp/ssuMCP/.env` 또는 k8s secret 이름 — 백엔드 환경변수
4. 위 파일들로 해결 안 되면 **그때만** 사용자에게 요청

사용자에게 "어떻게 해요?"를 묻기 전에 반드시 위 파일들을 먼저 확인한다.

---

## 구현 AI 자율 실행 범위

구현 AI 는 아래 작업을 **사용자 확인 없이** 모두 실행한다:

| 작업 | 명령 |
|------|------|
| 테스트 | `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| 커밋 | `git commit -m "..."` (Conventional Commits) |
| 푸쉬 | `git push origin <branch>` |
| PR 생성 | `gh pr create --title "..." --body "..."` |
| PR 머지 | `gh pr merge <N> --rebase --delete-branch` (auto-merge 조건 충족 시) |
| main 동기화 | `git checkout main && git pull --ff-only origin main` |
| 배포 확인 | Vercel preview URL 또는 CI 결과 확인 |

**auto-merge 조건**: tests pass + 런타임 영향 없음(off-by-default) + 신규 파일 위주.
아래 항목 중 하나라도 해당하면 **사용자에게 먼저 확인**:
- force-push main / DB 마이그레이션 / major dep bump
- prod 환경변수 변경 / 서버 재시작 필요

---

## Troubleshooting 누적 (포트폴리오)

아래 기준 중 하나라도 해당하면 **그 자리에서** `../ssuMCP/TROUBLESHOOTING.md` 에 즉시 기록.
구현 AI 도 기록 의무가 있다. 기억이 흐려지면 디테일이 사라진다.

**기록 트리거**: (1) 외부 시스템이 예상과 다르게 동작 (2) 처음 가설이 틀리고 실제 원인이 다른 레이어
(3) 테스트 green인데 prod 깨짐 (4) 프레임워크 내부 우회 (5) 설계 방향 전환 (6) 보안·인증·세션 버그

**필수 포함 항목** (누락 시 기록 무효):
- 처음 세운 가설(틀린 방향)
- 실제 원인
- 핵심 파일/커밋
- 포트폴리오 포인트(왜 어려웠는지, non-obvious했는지)
- 면접 예상 질문 2~3개

단순 오타·일회성 명령 실패는 제외.

---

## User Context
숭실대 컴퓨터학부 3학년. 기본 Spring CRUD 익숙 / production backend
학습 중. 포트폴리오 프로젝트. 설명은 step-by-step, 과한 추상화 X,
"학생 1명이 현실적으로 만들 수 있는 인상적 결과물" 지향. 간결한 한국어
응답 선호.

## Review Style
기존 코드 리뷰 시:
1. Architecture consistency (`docs/architecture.md`)
2. Responsibility separation (Controller / Service / Repository / Connector)
3. Security (`../ssuMCP/docs/security.md` 특히 §4 Logging)
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
- 일반 작업에서 읽지 말 것: `node_modules/`, `.next/`, `scratch/`,
  `.codex/`, 오래된 `docs/tasks/` 전체. 관련 태스크가 명시한 파일만 좁게 읽는다.
- 프론트엔드 검증: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
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
- `../ssuMCP/docs/security.md` 관련 trade-off 결정

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
세션 시작 즉시 `.codex/current-task.md` 읽기 필수. 사용자 트리거: **"task 읽어"**.

### Antigravity CLI — `agy` (Codex 대체, 즉시 전환)
Gemini CLI 후속 (Gemini CLI 종료: 2026-06-18). **Codex 토큰 소진 시 즉시 전환.**

전환 절차 (3단계):
```
1. agy -m gemini-3.5-flash  (ssuAI: -C C:/Users/akftj/mp/ssuAI)
2. "task 읽어"
3. 이어서 작업 — .codex/current-task.md 의 완료된 항목부터 파악 후 미완료 항목 실행
```

- **기본 모델: Gemini 3.5 Flash** — agentic 벤치마크(MCP Atlas 83.6%, Terminal-Bench 76.2%)
  에서 GPT-5.5 초과. 289 tok/s. 구현 작업은 Flash 유지 권장.
- 모델 변경: TUI 내 `/model <id>` 또는 CLI `-m <id>`.
  사용 가능: `gemini-3.5-flash`, `gemini-3.1-pro`, `claude-sonnet-4-6`, `gpt-oss-120b`.
- Manager View: 서브에이전트 병렬 실행 가능.
- commit author 반드시 `git config user.name` = ghdtjdwn 확인.

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

- **"내가 알려줄게" / "끝나면 알려줄게"** 한 외부 작업 → 폴링/언급/옵션
  매트릭스 포함 금지. 사용자가 결과 통지. [[feedback-user-will-notify]]
- **"토큰 끝났어" / "다른 AI 로 갈게" / "agy 로 갈게"** →
  현재 진행 상태를 `.codex/current-task.md` 에 업데이트 후 DONE 블록 출력.
  다음 AI 는 "task 읽어" 로 즉시 이어간다.
- **"대화 종료" / stop-for-now** → `git status` 먼저, 미커밋 자동
  commit/push 금지. runbook §Session-close-sync
- **TROUBLESHOOTING.md / 원격 서버 / CI 절약** → runbook 의 해당 섹션

## Current Phase
새 task spec 은 `.codex/current-task.md` 에 작성 후 Codex / AGY 로 넘김.
완료된 task 기록은 `docs/tasks/` (historical archive). 사용자가 final decision maker —
광범위한 변경은 propose → 사용자 승인 → 진행. silent 변경 X.
