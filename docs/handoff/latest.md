# Session handoff — 2026-05-18 저녁 (MYSAPSSO2 fix 배포 완료, 진단 로그 정리 대기)

> Single rolling handoff (CLAUDE.md / AGENTS.md 정책). 이전 handoff overwrite.

## TL;DR

- **main 최신**: `96b9e8c` (`origin/main` 과 동기화), 워크트리 `TROUBLESHOOTING.md` / `readseongju.txt` 수정 중.
- **prod 배포**: sha-96b9e8c8add4003989af79deefb355cdad83d85f, pod Running 1/1.
- **SmartID 로그인 정상**: "안녕하세요 홍성주학생" 확인됨.
- **남은 즉시 작업**: 진단 로그 (MYSAPSSO2 prefix) 제거 커밋 → prod 에서 시간표/성적 확인 후 진행.
- **다음 큰 작업**: Phase 4 도서관 좌석 자동 예약 에이전트.

## 이번 세션 작업 요약

| 커밋 | 내용 |
|------|------|
| `96b9e8c` | fix: RestClient 302 silent redirect 로 MYSAPSSO2 누락 → HttpClient Redirect.NEVER + 수동 hop 누적. **핵심 fix** |
| `ad83a99` | fix: MYSAPSSO2 prefix 24자 진단 로그 추가 (임시, 제거 예정) |
| `72a00fb` | fix: Grades/Schedule connector 4xx 응답 body 진단 로그 추가 |
| `405c288` | fix: Next.js 16 proxy Set-Cookie header stripping → `cookies.set()` 로 교체 |
| `a1e74a1` | fix: SSO callback을 App Router route 대신 proxy.ts middleware 에서 처리 |
| `ccc0c30` | fix: same-origin API proxy, WebDynpro Form_Request flow, Oasis loans path fix |

## 현재 prod 상태

- pod: `ssuai-backend-5785f6d68c-4nqsg` (Running 1/1)
- URL: `https://ssuai.vercel.app`
- SmartID SSO: 정상
- 시간표/성적 카드: **사용자 확인 필요** (본 세션에서 미확인)
- KUBE_CONFIG 미설정 → CI Deploy 워크플로우 미반영, 매 배포 수동 필요:
  `kubectl set image deployment/ssuai-backend "backend=ghcr.io/hoeongj/ssuai-backend:sha-<40자 full SHA>" -n ssuai-prod`
  (short SHA 7자 쓰면 NotFound — 반드시 full 40자)

## 진단 로그 제거 대상 (prod 시간표/성적 확인 후 즉시 제거)

### 1. `SaintSsoService.java:114-116` + `L300-310` (extractCookiePrefix 메서드)
```java
// 제거 대상 — L114-116
// Temporary diagnostic: log MYSAPSSO2 prefix to compare with browser value
String mysapPrefix = extractCookiePrefix(mergedCookies, "MYSAPSSO2", 24);
log.info("saint sso mysapsso2 prefix(24)={}", mysapPrefix);

// 제거 대상 — L300-310 (메서드 전체)
private static String extractCookiePrefix(String cookieHeader, String name, int prefixLen) { ... }
```

### 2. 유지 vs 제거 판단 필요한 로그 (error path — 장기 운영 관점으로 재검토)
- `RealSaintGradesConnector.java:235-237` — 4xx body log (`log.warn`)
- `RealSaintGradesConnector.java:267-268` — auth gate htmlSnippet log
- `RealSaintScheduleConnector.java:267-269` — 4xx body log (`log.warn`)
- `RealSaintScheduleConnector.java:288-289` — auth gate htmlSnippet log
- bootstrap no-secure-id snippet logs (grades L104, schedule L121) — error path, 유지 추천

## 완성된 MCP tool 목록 (10개)

| tool | 종류 | 인증 |
|------|------|------|
| `get_today_meal` | read | 공개 |
| `get_meal_by_date` | read | 공개 |
| `get_dorm_weekly_meal` | read | 공개 |
| `search_campus_facilities` | read | 공개 |
| `get_library_seat_status` | read | 공개 (Pyxis-Auth-Token) |
| `search_library_book` | read | 공개 (Pyxis JSON API) |
| `get_my_schedule` | read | u-SAINT SSO |
| `get_my_grades` | read | u-SAINT SSO |
| `get_my_assignments` | read | LMS SSO |
| `get_my_library_loans` | read | 도서관 세션 연동 |

## 다음 세션 액션

1. `git -C C:/Users/akftj/ssuAI status --short --branch` 로 clean/main 확인.
2. prod 에서 시간표/성적 카드 동작 확인 (사용자 직접) + kubectl 로그 확인:
   ```
   kubectl logs -n ssuai-prod -l app=ssuai-backend --tail=100 | grep -E "saint sso|mysapsso2"
   ```
   → `mysapsso2 prefix(24)=...` 가 보이면 fix 정상 동작 중.
3. **확인 후 즉시**: `SaintSsoService.java` 진단 로그 2줄 + `extractCookiePrefix` 메서드 제거, 커밋.
4. 4xx body / htmlSnippet 로그 유지 여부 결정 (error path 이므로 유지 권장).
5. **Phase 4 설계**: Pyxis 좌석 예약 POST endpoint/body/response spike → `action_audit` schema → MVP `ActionLock` 범위 제안. write tool 이므로 설계 후 사용자 승인 필수.

## 보안 주의

- `docs/security.md` §4 기준: 비밀번호, 쿠키, JWT, 학생번호, 성적/과제 본문, authenticated upstream HTML 전체는 로그 금지.
- 4xx body 로그 (`log.warn`) 는 학교 서버 응답 HTML 일부를 담을 수 있어 운영 장기 유지 시 §4 위반 가능 — 제거 또는 길이 cap 검토.
- `backend/.env` 는 로컬 파일, 커밋 금지.

## Next-AI opener block

### Claude 로 이어갈 때

```text
/model opusplan

ssuAI 프로젝트 이어받음. 다음 순서대로:

1. CLAUDE.md Project + Model / planning workflow + Implementation Workflow 읽기
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/ssuAI status --short --branch 로 main/clean 확인

현재 상태:
- main = 96b9e8c, prod Running (SmartID SSO 정상)
- 즉시 할 일: prod 시간표/성적 카드 확인 → SaintSsoService 진단 로그 제거 커밋
- 이후: Phase 4 도서관 좌석 자동 예약 에이전트 설계
- write tool 이므로 Pyxis 예약 POST spike + action_audit/confirm_action 설계 제안부터, 사용자 승인 전 구현 금지
```

### Codex 로 이어갈 때

```text
ssuAI 프로젝트 이어받음. Codex 는 ~/.codex/config.toml 의 ssuai profile 기준으로 시작.

1. AGENTS.md Project + Model / planning workflow + Implementation Workflow 읽기
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/ssuAI status --short --branch 로 main/clean 확인

현재 상태:
- main = 96b9e8c, prod Running (SmartID SSO 정상)
- 즉시 할 일: prod 시간표/성적 카드 확인 → SaintSsoService 진단 로그 제거 커밋
- 이후: Phase 4 도서관 좌석 자동 예약 에이전트 설계 (설계 세션이면 codex --profile ssuai-deep 추천)
- write tool 이므로 사용자 승인 전 구현 금지
```
