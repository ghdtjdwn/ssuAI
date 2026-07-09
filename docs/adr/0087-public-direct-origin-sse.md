# ADR 0087 — 공개 조회와 도서관 좌석 SSE의 backend origin 직접 호출

- **Status**: Accepted — 구현
- **Date**: 2026-07-10
- **Scope**: `lib/api/*` public fetch 경계, `hooks/useLibrarySeatSse.ts`, backend CORS 경계
- **Backend pair**: ssuMCP ADR 0087 — 공개 REST/SSE no-credentials CORS

## 배경

기존 ssuAI 브라우저 경로는 `/api/*`를 same-origin으로 호출하고 Next.js rewrite가 ssuMCP로
전달했다. 이 방식은 refresh cookie, library `JSESSIONID`, SmartID/LMS Bearer, agent key
주입처럼 자격증명이 필요한 경로에는 맞다. 하지만 학식·공지·시설·학사일정·도서관 좌석
상태 같은 공개 조회도 같은 Vercel Function/rewrite 경로를 탄다.

도서관 좌석 SSE는 홈 화면에서 기본으로 열리고 floor별 연결을 유지한다. 공개 SSE 연결까지
Vercel을 경유하면 사용자 수에 비례해 함수 동시성·duration을 점유한다. 챗봇 stream route는
`maxDuration = 60`으로 긴 응답이 절단될 수 있지만, 이 경로는 서버 전용 agent proxy와 세션
경계가 있어 이번 유닛에서는 그대로 프록시에 남긴다.

참고한 공식 문서:

- Vercel Functions duration은 invocation 종료 경계다:
  <https://vercel.com/docs/functions/configuring-functions/duration>
- Spring MVC CORS는 credentials를 민감한 쿠키/CSRF 신뢰 경계로 다룬다:
  <https://docs.spring.io/spring-framework/reference/web/webmvc-cors.html>
- EventSource `withCredentials` 기본값은 false다:
  <https://developer.mozilla.org/en-US/docs/Web/API/EventSource/withCredentials>

## 대안

### A. 전부 same-origin 프록시 유지

가장 단순하지만 C2 문제를 해결하지 못한다. 공개 SSE와 공개 GET이 계속 Vercel 경로를 점유한다.

### B. 공개 조회와 공개 좌석 SSE만 backend origin 직접 호출

채택했다. 공개 GET/SSE는 `NEXT_PUBLIC_BACKEND_ORIGIN`을 우선 사용하고, 기존 배포 호환을 위해
`NEXT_PUBLIC_SSUAI_API_BASE`를 fallback으로 쓴다. 두 env가 없으면 빈 base URL이라 기존처럼
same-origin `/api/*` 프록시로 돌아간다.

### C. 모든 API를 backend origin 직접 호출

쿠키·JWT·library session·agent key 경계를 모두 cross-origin으로 다시 열어야 한다. 이번 목표는
공개 트래픽의 Vercel 부하 제거이므로 범위가 과하다.

## 선택

API client를 두 갈래로 나눴다.

- `fetchJson`: 기존 same-origin/proxy 경로. 인증·세션·agent helper가 계속 사용한다.
- `fetchPublicJson` / `fetchPublicJsonParsed`: 공개 조회 전용 backend-origin 경로.

직접 origin으로 이동한 frontend helper:

- `getTodayMeal`, `getWeeklyMeals`
- `getDormThisWeekMeal`
- `getNotices`
- `searchFacilities`
- `getAcademicCalendar`
- `getLibrarySeatStatus`
- `searchLibraryBooks`
- `getLibrarySeatEventsUrl` / `useLibrarySeatSse`

프록시에 남긴 helper:

- auth: `refreshAccessToken`, `fetchMe`, `callLogout`, SSO init URL
- private school data: SAINT schedule/grades/chapel/graduation/scholarships, LMS assignments
- library session/private data: login/logout, loans, reservation recommend/prepare/confirm/wait/current
- MCP web session: `createMcpWebSession`
- chatbot: `/api/agent/stream`, `/api/agent/resume`

## 구현 선택

- **명시적 public fetcher 추가**: 호출부에서 public/private 경계가 보이도록 `fetchPublicJson`을
  별도로 만들었다. `fetchJson`에 boolean option을 섞으면 실수로 인증 호출을 origin으로 보내는
  회귀를 찾기 어렵다.
- **public fetch credentials omit**: origin env가 없어서 same-origin `/api/*` fallback을 타더라도
  공개 helper는 `credentials: "omit"`을 강제한다. 공개 조회가 브라우저 cookie 상태에 기대지
  않는다는 계약을 테스트로 고정한다.
- **env fallback 순서**: `NEXT_PUBLIC_BACKEND_ORIGIN` → `NEXT_PUBLIC_SSUAI_API_BASE` → `""`.
  새 env는 의미가 명확하고, 기존 env fallback은 현재 배포가 바로 동작하게 한다. 둘 다 없으면
  로컬 개발에서 same-origin proxy가 유지된다.
- **SSE credentials 비활성화**: `EventSource(getLibrarySeatEventsUrl(floor), { withCredentials: false })`.
  공개 SSE는 backend CORS no-credentials 경계와 맞춘다.
- **chatbot stream은 문서화만**: `app/api/agent/stream/route.ts`는 이미 `maxDuration = 60`과
  Pro 300초 주석이 있다. agent key/세션 경계가 있어 이번 유닛에서 origin 직접 호출로 옮기지 않는다.

## 트레이드오프

- 공개 조회는 backend origin이 브라우저 네트워크 패널에 직접 보인다. 원래 공개 endpoint이고,
  credentials를 보내지 않으므로 session 경계에는 영향이 없다.
- 새 env를 쓰면 의미가 명확하지만, 기존 env fallback이 있어 `NEXT_PUBLIC_SSUAI_API_BASE`가 설정된
  로컬/배포에서는 공개 조회가 바로 direct-origin으로 바뀐다. direct 호출을 원하지 않는 로컬은
  두 public env를 비우면 된다.
- public/private 호출 경계가 API helper별로 분산된다. 그래서 helper-level unit test로 public은
  origin, cookie/Bearer helper는 same-origin을 고정했다.

## 검증

- `lib/api/client.test.ts`: public-origin env, legacy env fallback, env 미설정 same-origin fallback.
- `lib/api/public-origin.test.ts`: 공개 helper는 backend origin, auth/library/session helper는
  same-origin path 유지.
- `hooks/useLibrarySeatSse.test.ts`: SSE URL이 env 설정/미설정 모두에서 의도한 URL로 해석됨.

## 예상 면접 질문

1. **왜 공개 endpoint만 직접 origin으로 보내고 인증 endpoint는 프록시에 남겼나?**
2. **`NEXT_PUBLIC_BACKEND_ORIGIN`과 `NEXT_PUBLIC_SSUAI_API_BASE`를 둘 다 지원한 이유는?**
3. **SSE에서 `withCredentials: false`를 명시한 이유와 backend CORS `allowCredentials(false)`의 관계는?**
