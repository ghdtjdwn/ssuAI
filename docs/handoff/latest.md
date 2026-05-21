# Session handoff — 2026-05-20 (PR #161 배포 후 심층 분석 완료)

> Single rolling handoff (CLAUDE.md / AGENTS.md 정책). 이전 handoff overwrite.

## TL;DR

- **main 최신**: PR #161 머지 완료 (ecc.ssu.ac.kr URL + gw-cb.php Location 추적)
- **prod 최신**: PR #161 기준 코드 배포됨 — `sha-8ca7b826e2dd1df12db7c32c86dcaf9e6c870379`
- **분석 완료**: SAINT ANON session 심층 원인 확인 + LMS canvas phase 누락 확인
- **다음 task**: `.codex/current-task.md` 작성 완료 — Codex 로 넘김

## 현재 prod 상태

| 기능 | 상태 |
|------|------|
| SmartID 로그인 | ✅ 정상 |
| 도서관 좌석 (`get_library_seat_status`) | ✅ 정상 |
| 학식/기숙사/시설/도서관 검색 | ✅ 정상 |
| 시간표 (`get_my_schedule`) | ❌ ANON session → auth gate |
| 성적 (`get_my_grades`) | ❌ ANON session → HTTP 500 |
| 과제 (`get_my_assignments`) | ❌ xn_api_token 없음 → canvas 401 |

## PR #161 결과 (배포 후 확인)

URL 변경(ecc.ssu.ac.kr)과 gw-cb.php Location 추적은 모두 정상 적용됨.
그러나 두 버그가 남아 있음:

### SAINT: 포털 쿠키가 ECC USER session 을 막음

pod log 재분석:
```
saint sso cookies stored: names=WAF,MYSAPSSO2,saplb_*,JSESSIONID,JSESSIONMARKID,PortalAlias
saint schedule connector GET final: cookieNames=WAF,MYSAPSSO2,saplb_*,JSESSIONID,JSESSIONMARKID,PortalAlias,...
sap-contextid=SID:ANON:hana-prd-ap-2_SSP_00:...-NEW
```

`eccBootstrapCookieHeader()` 가 포털 쿠키 전체를 ECC 로 전달. rusaint 는 RFC 6265 domain 필터링으로
`MYSAPSSO2`(domain=.ssu.ac.kr) 만 ECC 로 보냄. 포털 쿠키(`JSESSIONID`, `JSESSIONMARKID`, `PortalAlias`,
`saplb_*`, `WAF`)가 ECC SAP ICM 에 전달되면 ECC 가 포털 세션을 찾으려 하다 실패 → ANON 생성.

**Fix**: `eccBootstrapCookieHeader()` — MYSAPSSO2 만 추출. 두 connector 모두 동일하게 적용.

### LMS: canvas 가 별도 phase 임

pod log:
```
lms auth phase1 redirect: https://lms.ssu.ac.kr/login/callback?result=ZHDtbX2...
lms auth phase2 merged cookie names: WAF,xn_coursecatalog_api_token,laravel_token,XSRF-TOKEN,coursecatalog_session
lms canvas 401
```

`lms.ssu.ac.kr/login/callback` → HTTP 200 종료 (canvas 로 redirect 없음). Canvas 는 별도 phase:
`canvas.ssu.ac.kr/learningx/dashboard?user_login={sIdno}` 를 LMS 세션 쿠키로 방문 → canvas auth chain → xn_api_token.

**Fix**: `authenticate()` 에 phase 3 추가 — LMS auth 후 canvas dashboard 방문.

## 다음 action

Codex 가 `.codex/current-task.md` 읽고 구현 시작.

```
새 브랜치: fix/saint-portal-cookie-filter
변경:
  1. RealSaintScheduleConnector.eccBootstrapCookieHeader() — MYSAPSSO2 만
  2. RealSaintGradesConnector.eccBootstrapCookieHeader() — 동일
  3. LmsSsoService.authenticate() — phase 3 canvas fetch 추가
  4. LmsSsoServiceTests — phase 3 테스트 + 기존 테스트 큐 보완
  5. RealSaintScheduleConnectorTests — eccBootstrapCookieHeader 단위 테스트
  6. gradlew.bat test → PR → CI → kubectl 배포 → pod log 확인
```

## 배포 참고

```bash
sudo kubectl set image deployment/ssuai-backend -n ssuai-prod \
  backend=ghcr.io/hoeongj/ssuai-backend:sha-<full-40char-sha>

sudo kubectl logs -n ssuai-prod -l app=ssuai-backend --tail=100 --since=5m
```

## prod log 성공 확인 지표

SAINT 수정 성공:
- `saint schedule init POST url='...sap-contextid=SID:USER:...'` — USER session 확인
- `saint schedule fetched: studentFp=... terms=... entries=...`
- `saint grades fetched: studentFp=... terms=...`

LMS 수정 성공:
- `lms auth final cookie names: ...,xn_api_token,...`

## MCP tool 목록 (14개)

| tool | 종류 | 인증 |
|------|------|------|
| `get_today_meal` | read | 공개 |
| `get_meal_by_date` | read | 공개 |
| `get_dorm_weekly_meal` | read | 공개 |
| `search_campus_facilities` | read | 공개 |
| `get_library_seat_status` | read | Pyxis-Auth-Token |
| `search_library_book` | read | Pyxis JSON API |
| `get_my_schedule` | read | u-SAINT SSO |
| `get_my_grades` | read | u-SAINT SSO |
| `get_my_assignments` | read | LMS SSO |
| `get_my_library_loans` | read | 도서관 세션 |
| `get_auth_status` | read | 공개 |
| `start_auth` | action | 공개 |
| `logout_provider` | action | 공개 |
| `logout_all` | action | 공개 |

## 보안 주의

- `docs/security.md` §4: 비밀번호, 쿠키, JWT, 학생번호, 성적/과제 본문, authenticated
  upstream HTML 전체는 로그 금지.
- LMS 진단 로그: cookie 이름만 출력 (값 X).

## Next-AI opener block

### Claude 로 이어갈 때

```text
/model opusplan

ssuAI 프로젝트 이어받음. 다음 순서:

1. CLAUDE.md 읽기
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/ssuAI status --short --branch 확인

현재 상태:
- SAINT ANON session + LMS canvas phase 수정 중 (Codex 작업 예정)
- .codex/current-task.md 작성 완료
- 검수 시점: Codex last-result 파일 확인 + gradlew test 결과 확인
```

### Codex 로 이어갈 때

```text
ssuAI 프로젝트 이어받음. Codex 는 ~/.codex/config.toml 의 ssuai profile 기준으로 시작.

1. AGENTS.md 읽기
2. docs/handoff/latest.md 읽기
3. .codex/current-task.md 읽기 (현재 task 상세)
4. git -C C:/Users/akftj/ssuAI status --short --branch 확인

즉시 task: .codex/current-task.md 에 작성된 SAINT portal cookie 필터 + LMS canvas phase 3 구현.
```
