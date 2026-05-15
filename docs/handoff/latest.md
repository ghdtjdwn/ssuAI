# Session handoff — 2026-05-16 late night

> Single rolling handoff file (CLAUDE.md / AGENTS.md "Session handoff
> to a different AI" 정책). 이전 dated handoff (`2026-05-16-evening.md`)
> 는 이 commit 에서 삭제 — git log 가 보존. 다음 핸드오프도 이 파일을
> overwrite 한다.

## TL;DR

- **Task 14 (u-SAINT 인증) 완전 종료**. backend 4 PR + frontend 1 PR +
  logout PR. SmartID SSO → ssuAI JWT 파이프라인 라이브.
- **Phase 2 (도서관 도구) 라이브 상태 그대로** — Task 12 좌석 mock +
  Task 15 도서 검색 real (Pyxis JSON), prod `library-book: real`.
- **새 워크플로우 lock-in (PR #93/#95)** — claude1/claude2/codex 3-AI
  rotation. CLAUDE.md + AGENTS.md 가 identical mirror. 정책 변경 시
  두 파일 같은 commit 으로 sync 강제.
- **모든 문서 사실 동기화** (PR #96/#97/#98) — ADR 0001-0013 status
  flip + Phase 2/3 진행 반영 + README 의 "두 분리된 제품" framing
  채택 (MCP 서버 + ssuAI 웹/앱).
- **Task 16 spec 만 lock-in** (PR #103). 코드는 아직 없음. 다음 세션이
  PR 16a 부터 바로 시작 가능.

## 이번 세션 머지/푸시 (2026-05-16, 12 PR)

| PR | 내용 | base | 비고 |
|----|------|------|------|
| #93 | 3-AI rotation + session-handoff 정책 | main | CLAUDE.md 신규 섹션. 이 doc 의 출처. |
| #94 | Task 14 PR 14b-3 — SaintSsoService | main | saint 2-phase 인증 + 7 테스트 |
| #95 | AGENTS.md mirror | main | Codex CLI 자동 로드. 두 파일 byte-identical |
| #96 | Phase 2 + Task 14 facts refresh + ADR status flip | main | 14 파일 갱신 (mcp-tools, README, vision, architecture, security, ADR 0007-0013) |
| #97 | CLAUDE/AGENTS 의 final-goal 을 README L3-19 인용으로 | main | docs-only |
| #98 | 두 제품 framing (MCP 서버 + ssuAI 웹/앱) | main | README + CLAUDE + AGENTS + vision + product |
| #99 | Task 14 PR 14b-4a — JwtAuthFilter + /me | main | `Authorization: Bearer` 파싱 + request attrs |
| #100 | Task 14 PR 14b-4b — SSO callback + refresh + ADR 0014 | main | redirect-callback 패턴 |
| #101 | Task 14 PR 14c — Frontend /auth/login + /auth/return + useSaintAuth | main | 38 frontend tests |
| #102 | Task 14 PR 14d — POST /api/auth/logout | main | refresh cookie clear |
| #103 | Task 16 spec — u-SAINT realtime data tools | main | spec only, no code |
| #104 | 모바일 CSS 1차 패스 (dashboard + chat header) | main | 실제 브라우저 검증 안 됨 |

backend 257 tests + frontend 38 tests 모두 그린. 자동 머지 정책으로
사람 review 없이 직접 머지.

## 열린 PR

| PR | 브랜치 | 내용 | 상태 |
|----|--------|------|------|
| #81 | `chore/spike-ssotoken-ttl-script` | Task 13 ssotoken TTL spike script | 사용자가 PC 에서 실행 중. 결과 가져오면 사용자가 머지. **폴링 금지** ([[feedback-user-will-notify]]) |

## 외부 의존 — 사용자 직접 (폴링 금지)

1. **SmartID `apiReturnUrl` whitelist spike** — Task 14 spec §7 #1.
   `https://smartid.ssu.ac.kr/Symtra_sso/smln.asp?apiReturnUrl=https%3A%2F%2Fexample.com`
   에서 실제 SSU 로그인하고 SmartID 가 example.com 으로 302 하는지
   거부하는지 확인. negative 면 Task 14 §10 stop-and-flag #1 발동 (web
   port 자체 collapse, browser extension / iOS-Android 앱 / SSU IT 협상
   fallback). backend/frontend 코드는 결과 무관 동작.
2. **TTL spike #81** — PR #81 결과가 Task 13 §12 storage 결정 (in-memory
   vs AES-GCM persistent vs sliding-refresh) 입력. 결정 후 PR 13c
   (manual paste UI) 시작 가능.
3. **모바일 CSS 실제 브라우저 검증** — PR #104 는 정적 클래스 리뷰만.
   실제 375-414px 화면에서 깨진 부분 있으면 follow-up PR 필요.
4. **Task 16 PR 16a 의 30분 u-SAINT spike** — Task 16 spec §3, §7. 사용자
   본인 u-SAINT 계정으로 시간표 + 성적 페이지 URL + HTML 캡처, PII
   스크럽 후 `backend/src/test/resources/fixtures/saint/` 에 commit.
   PR 16a 코드 작성 전 선행.

이 4건 중 어느 것이든 사용자가 "결과 가져왔어" 라고 알려줄 때까지
다음 AI 가 언급/폴링 금지.

## 다음 세션 액션 (우선순위 순서)

### 1. Task 15 (Phase 3 인증 트랙 정리) 의존 후속

- 외부 의존 #1 (apiReturnUrl whitelist) 결과 받으면 Task 14 §10 처리.
  positive 면 그대로 진행. negative 면 spec §10 의 fallback 옵션 (B
  extension / 모바일 앱 등) 으로 재설계.
- 외부 의존 #2 (TTL spike #81) 결과 받으면 Task 13 spec §12 결정 +
  PR #81 머지 + Task 13 PR 13b (Real seat connector) + PR 13c (manual
  paste UI) 시작.

### 2. Task 16 (u-SAINT realtime data) 진행

외부 의존 #4 (u-SAINT 스파이크) 가 사용자 측에서 끝났을 때:

- **PR 16a** — `docs/tasks/16-usaint-realtime-data.md` §7 첫 번째 슬라이스:
  - 사용자가 commit 한 fixture 활용
  - `domain.auth.saint.SaintSessionStore` (AES-GCM, ≤30분 TTL)
  - `SaintSessionEntry` + `PortalCookies` record
  - `SaintSsoService.authenticate` 변경 — phase 2 직후
    `sessionStore.put(studentId, phase1Cookies)` 호출
  - `SaintSessionExpiredException` + `ErrorCode.SAINT_SESSION_EXPIRED`
    (HTTP 401)
  - `SaintSessionStoreTests` (encrypt round-trip, TTL, LRU, invalidate)
- **PR 16b** — `get_my_schedule` connector + service + MCP tool + REST
  endpoint. `ssuai.connector.saint-schedule: mock` default.
- **PR 16c** — `get_my_grades` 동일 구조.

PR 16a/b/c 의 패키지 layout / DTO / 의존성 / security 체크리스트 / stop-
and-flag 모두 Task 16 spec 에 자세히 들어있음. 다음 AI 는 spec 만
읽으면 곧장 시작 가능.

### 3. Task 17 spec — LMS 통합 (선택)

Task 16 이 끝나면 자연스러운 다음 단계. `get_my_assignments` 가 메인
deliverable. LMS 는 SmartID 와 별도 auth (확인 필요). 사용자가 그 시점에
"Task 17 으로 갈까?" 결정.

### 4. Phase 4 prep — 도서관 좌석 자동 예약 에이전트 (flagship)

vision.md §3 Layer 4 의 메인 deliverable. Task 16 의 SaintSessionStore
패턴이 그대로 재사용됨 (action-tool 의 credential 저장). 단 action-tool
공통 인프라 (confirmation / dry-run / audit log / 분산 lock) 가
선행되어야. 별도 ADR 예정.

## 사용자 컨텍스트 — 잊지 말 것

- **숭실대 컴퓨터학부 3학년**, 포트폴리오 프로젝트
- **3-AI rotation** — claude1/claude2/codex 토큰 사정 따라 한 명씩 active
  ([[role-3-ai-rotation]]). 정책 변경 시 CLAUDE.md + AGENTS.md 양쪽 같은
  commit 으로 sync.
- **commit/PR body 에 Claude/AI 흔적 절대 금지** (`Co-Authored-By: Claude`
  trailer X, "🤖 Generated with..." footer X). [[feedback-no-claude-coauthor]]
- **안전한 PR 자동 머지** — mergeable + tests pass + mock default 면 묻지
  말고 즉시 `gh pr merge --auto --rebase --delete-branch`.
- **외부 작업 사용자 통지 대기** — "내가 알려줄게" / "끝나면 알려줄게"
  한 작업은 그 후 언급/폴링 금지. [[feedback-user-will-notify]]
- **in-flight context 는 in-repo 파일 (이 doc / task spec / dev-log)** 에.
  auto-memory 만은 안 됨 ([[feedback-save-progress-to-project]]).
- **두 제품 framing** — "MCP 서버" 와 "ssuAI 웹/앱" 은 분리된 제품.
  ssuAI 라는 이름이 광의 (프로젝트 전체) 와 협의 (웹/앱 클라이언트
  product) 두 가지 의미. [[project-final-goal]]
- **간결한 한국어 응답 선호**.

## 보안 주의

- TTL spike (#81) 토큰은 사용자 PC 로컬, 노출 X. 다음 세션 시작 시 토큰
  값 보여 달라 하지 말 것.
- JWT secret: dev/test ephemeral random (서버 재시작마다 invalid), prod
  `SSUAI_JWT_SECRET` env 필수 (≥ 32 bytes). application-prod.yml 에 빈
  default 라 미설정 시 startup 실패.
- ssutoday `sToken`/`sIdno` 는 method-scoped — `SaintSsoService.authenticate`
  내부에서만 살아있음. 메서드 종료 후 GC. 로그/DB/세션 어디에도 안 남김.
- Task 16 시작하면 **saint portal cookies** 가 새로운 sensitive
  category 추가됨 — AES-GCM 암호화 + ≤30분 TTL 필수. `docs/security.md`
  §5 정책 그대로 적용.
- 성적 (`get_my_grades`) 은 **LLM 프롬프트에 절대 안 들어가야 함** —
  Task 16 spec §6, §8 확정. 챗봇은 tool 호출 결과를 controller path 로만
  반환, LLM compaction 거치지 않음.

## 자동 메모리

`~/.claude-personal/projects/C--Users-akftj-ssuAI/memory/`

핵심 파일 (인덱스는 `MEMORY.md` 자동 로드):
- `project-final-goal.md` — 두 제품 framing + flagship 인용
- `role-3-ai-rotation.md` — 3-AI 정책 + handoff 루틴
- `feedback-save-progress-to-project.md` — in-flight 은 in-repo 에
- `library-auth-research-2026-05-15.md` — Pyxis 헤더 인증 사실, PR 상태

(이번 세션 끝에 `MEMORY.md` 의 "Latest session handoff" 포인터를
`docs/handoff/latest.md` 로 갱신했음.)
