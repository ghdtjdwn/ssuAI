# Session handoff — 2026-05-18 낮 (Codex/Claude rotation 정리 + Phase 4 직전)

> Single rolling handoff (CLAUDE.md / AGENTS.md 정책). 이전 handoff overwrite.

## TL;DR

- **main 최신**: `0797f8b` (`origin/main` 과 동기화), 현재 워크트리 clean.
- **MCP 서버 10개 tool 구현 완료**: 공개 6개 + 인증 필요 4개. 대시보드도 10개 카드 구성.
- **Phase 3 개인 도구는 코드 기준 구현됨**: u-SAINT 시간표/성적, LMS 과제, 도서관 대출 현황.
- **최근 작업은 prod auth/세션 안정화**: SmartID → saint/LMS 세션, cross-site cookie, 도서관 credential login, ecc auth-gate 진단.
- **다음 큰 작업**: Phase 4 도서관 좌석 자동 예약 에이전트. Pyxis 예약 POST shape spike 와 action-tool 인프라 설계부터.

## 완성된 MCP tool 목록 (10개)

| tool | 종류 | 인증 |
|------|------|------|
| `get_today_meal` | read | 공개 |
| `get_meal_by_date` | read | 공개 |
| `get_dorm_weekly_meal` | read | 공개 |
| `search_campus_facilities` | read | 공개 |
| `get_library_seat_status` | read | 공개 (real Pyxis seat API) |
| `search_library_book` | read | 공개 (Pyxis JSON API) |
| `get_my_schedule` | read | u-SAINT SSO |
| `get_my_grades` | read | u-SAINT SSO |
| `get_my_assignments` | read | LMS SSO |
| `get_my_library_loans` | read | 도서관 세션 연동 |

## 최근 main 커밋

| SHA | 내용 |
|-----|------|
| `0797f8b` | fix(saint): Phase 2 portal cookies 를 `PortalCookies` 저장값에 merge |
| `b9e26eb` | fix(saint): ecc auth gate 진단용 HTML snippet logging |
| `0d17047` | fix(session): prod `JSESSIONID SameSite=None` 설정 |
| `23384ce` | fix(test): `LibraryCredentialLoginService` 로 인한 contextLoads 실패 해결 |
| `a80e0d1` | fix(saint): SAP connector User-Agent + 5xx 진단 logging |
| `f4cf61c` | feat(library): oasis login AES-CBC password encryption |
| `7c99d5a` | feat(library): 학번+비밀번호 도서관 credential login modal |
| `e570f39` | fix(auth): SmartID 1회 로그인으로 LMS 세션 동시 발급 + 만료 UX |
| `91d34eb` | chore: frontend staleTime/useMemo/session summary 정리 |
| `7e1e762` | feat(frontend): header auth chips, logout, simplified library modal |
| `9420342` | fix(library): 실제 좌석 층을 2/5/6 으로 정리 |

## CI / PR 상태

- 최근 `main` push 기준 CI / Security / Deploy 모두 success.
- 열린 PR은 Dependabot 3개:
  - `#140` backend Gradle wrapper 9.5.1
  - `#141` `azure/setup-kubectl` 5
  - `#142` frontend minor/patch dependency group

## 현재 코드 상태 요약

- Backend: Spring Boot 단일 JVM. REST + MCP SSE 동시 운영. Controller → Service → Connector 책임 분리 유지.
- Connector: `mock | real` property switch. dev/test 기본 mock, prod 기본 real. 외부 학교 사이트 호출은 connector 내부로 제한.
- Auth: SmartID SSO callback 으로 ssuAI JWT 발급. saint portal cookies / LMS cookies 는 서버 side encrypted session store 로 보관.
- Chat: LLM provider fallback + MCP tool discovery. 인증 필요 tool 은 chat path 에서 context 바인딩 후 service 직접 dispatch. 성적/시간표/과제/대출 응답은 LLM 전달 전에 compact 처리.
- Frontend: Next.js dashboard 10개 카드. Header 에 SmartID 로그인, 도서관 연동, 사용자 greeting/logout.
- Deploy: Oracle k3s backend + Vercel frontend. Helm / ArgoCD / deploy scripts 존재.

## 보안 주의

- `docs/security.md` §4 기준: 비밀번호, 쿠키, JWT, 학생번호, 성적/과제 본문, authenticated upstream HTML 전체는 로그 금지.
- `b9e26eb` / `a80e0d1` 의 snippet logging 은 진단 목적의 임시 성격. Phase 4 진입 전 장기 운영용으로 남길지 재검토 권장.
- `backend/.env` 는 로컬 파일이며 커밋 금지. 서버/SSH/토큰/실제 학생 데이터는 handoff 에 쓰지 않는다.
- Codex/Claude commit/PR body 에 Claude/AI/Anthropic attribution 금지.

## 다음 세션 액션

1. `git -C C:/Users/akftj/ssuAI status --short --branch` 로 clean/main 최신 확인.
2. `docs/adr/0015-action-tool-infrastructure.md`, `docs/mcp-tools.md` §8, `docs/security.md` §4/§6 관련 부분만 읽기.
3. Phase 4 설계 세션으로 시작: Pyxis 예약 POST endpoint/body/response shape spike 계획, `action_audit` schema, MVP `ActionLock` 범위 제안.
4. 구현 전 사용자 승인 필요. Phase 4 는 write tool + DB migration + 외부 시스템 상태 변경이라 silent 구현 금지.
5. 별도 작은 fix 로 먼저 할 만한 것: README/vision 의 진행상황이 현재 10-tool 상태보다 뒤처져 있으므로 docs refresh 가능.

## 사용자 컨텍스트

- 숭실대 컴퓨터학부 3학년. 포트폴리오 프로젝트.
- 설명은 간결한 한국어, step-by-step, 과한 추상화 X.
- 안전한 PR은 자동 머지 가능. 단 DB migration, prod flag flip, major dep bump, 서버/phone clone 영향은 먼저 ask.
- 외부 작업은 사용자가 "내가 알려줄게" 라고 하면 polling 금지.

## Next-AI opener block

### Claude 로 이어갈 때

```text
/model opusplan

ssuAI 프로젝트 이어받음. 다음 순서대로:

1. CLAUDE.md Project + Model / planning workflow + Implementation Workflow 읽기
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/ssuAI status --short --branch 로 main/clean 확인

현재 상태:
- main = 0797f8b, 최근 CI/Security/Deploy success
- MCP 10개 tool 구현 완료, 대시보드 10개 카드
- 다음 큰 작업은 Phase 4 도서관 좌석 자동 예약 에이전트
- write tool 이므로 Pyxis 예약 POST spike + action_audit/confirm_action 설계 제안부터, 사용자 승인 전 구현 금지
```

### Codex 로 이어갈 때

```text
ssuAI 프로젝트 이어받음. Codex 는 ~/.codex/config.toml 의 ssuai profile 기준(GPT-5.5, medium reasoning, approval never)으로 시작.

1. AGENTS.md Project + Model / planning workflow + Implementation Workflow 읽기
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/ssuAI status --short --branch 로 main/clean 확인

현재 상태:
- main = 0797f8b, 최근 CI/Security/Deploy success
- MCP 10개 tool 구현 완료, 대시보드 10개 카드
- 다음 큰 작업은 Phase 4 도서관 좌석 자동 예약 에이전트
- 설계 세션이면 codex --profile ssuai-deep -C C:/Users/akftj/ssuAI 로 시작하는 게 적합
- write tool 이므로 Pyxis 예약 POST spike + action_audit/confirm_action 설계 제안부터, 사용자 승인 전 구현 금지
```
