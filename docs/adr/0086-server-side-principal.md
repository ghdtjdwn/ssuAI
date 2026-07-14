# ADR 0086 — 에이전트 프록시에서 클라이언트발 `principal` 무조건 제거 (ssuAgent ADR 0011 짝꿍)

- **Status**: Accepted — server-verified principal 주입 구현 완료
- **Date**: 2026-07-10
- **Scope**: `lib/server/agentProxy.ts`(`/api/agent/stream`, `/api/agent/resume`가 공유하는 프록시), `lib/server/agentProxy.test.ts`
- **연관**: [ssuAgent ADR 0011](https://github.com/ghdtjdwn/ssuAgent/blob/main/docs/adr/0011-thread-stable-principal-binding.md) — 회전하는 `mcp_session_id` 대신 안정적인 `principal`로 thread 소유권을 재바인딩하는 ssuAgent 측 절반. **그 ADR의 신뢰 모델을 그대로 계승한다**: "principal은 절대 클라이언트가 주장할 수 있는 값이어서는 안 되고, 오직 ssuAI의 서버측 프록시만 주입할 수 있다."

## 배경

ssuAgent는 `AgentRequest`/`ResumeRequest`에 `principal: str | None` 필드를 이미 수용하도록 구현되었다(선제적/forward-compatible). 이 필드가 채워져 오면 재로그인·멀티기기에서도 대화 히스토리가 보존되지만, **누가 이 필드를 채우느냐**가 전체 설계의 존폐를 가른다 — 브라우저가 직접 채워 보내면 임의 학번을 주장하는 IDOR이 그대로 재현된다(ssuAgent ADR 0011 §신뢰 모델).

이 유닛(P1-8b)의 임무는 두 가지다.
1. **방어(지금 당장)**: 브라우저가 보낸 `principal`은 프록시 경계에서 무조건 버린다.
2. **주입(가능하다면)**: 이 서버가 스스로 검증한 안정 identity가 있다면 그 값을 `principal`로 주입한다.

## 탐색 — ssuAI의 Next.js 서버는 검증된 identity를 갖고 있는가?

코드를 직접 확인했다(추측 아님):

- **`lib/api/agent.ts`의 `startAgentStream`/`resumeAgentStream`**: `/api/agent/stream`, `/api/agent/resume`로 보내는 `fetch` 호출에 `Authorization` 헤더가 전혀 없다. SmartID access JWT는 `useSaintAuth`의 React state(브라우저 메모리)에만 존재하고, 이 fetch 호출에는 실리지 않는다.
- **`proxy.ts`(SSO 콜백 핸들러)**: 백엔드가 발급한 refresh-token 쿠키를 `response.cookies.set({ ..., path: "/api/auth" })`로 설정한다. **`Path=/api/auth`로 스코프가 좁혀져 있어**, 브라우저는 `/api/agent/*` 요청에는 이 쿠키를 아예 실어 보내지 않는다 — 설령 라우트 핸들러가 쿠키를 읽으려 해도 애초에 도착하지 않는다.
- **`next.config.ts`의 `rewrites()`**: `/api/auth/*`, `/api/mcp/*` 같은 인증/세션 관련 경로는 전부 백엔드(ssuMCP, `SSUAI_API_PROXY_TARGET`)로 바이트 그대로 포워딩되는 rewrite다. 즉 JWT 발급·검증은 전부 백엔드가 수행하고, **ssuAI의 Next.js 서버 코드는 JWT를 파싱하거나 검증하는 로직을 어디에도 갖고 있지 않다**(`jsonwebtoken`/`jose` 등 미사용, 확인됨). `/api/agent/*`만 실제 App Router 라우트 핸들러라 이 rewrite 대상에서 제외된다(그래서 `agentProxy.ts`가 별도로 존재).
- **`middleware.ts`**: 존재하지 않는다. 요청에 identity 헤더를 주입하는 엣지 레이어도 없다.

**초기 결론**은 위와 같았다. 이후 배선 유닛에서 브라우저가 이미 메모리에 보유한 짧은-lived access JWT를 same-origin `/api/agent/*` 요청의 `Authorization` 헤더로만 보내고, Next route handler가 ssuMCP `GET /api/auth/me`로 이를 검증하도록 연결했다. ssuAgent에는 JWT를 전달하지 않고, 검증 응답의 `studentId`만 `principal`로 주입한다.

## 대안 비교

### A. 지금 당장 억지로 identity를 만들어 주입

예: 클라이언트가 body에 `studentId`를 실어 보내게 하고 그 값을 신뢰해 `principal`로 승격.

**기각.** ssuAgent ADR 0011이 정확히 막으려는 것 — 클라이언트가 주장하는 identity를 서버가 검증 없이 신뢰하는 것 — 을 그대로 재현한다. IDOR을 없애는 게 아니라 이름만 `principal`로 바꿔 재도입하는 것.

### B. Strip만 하고 주입은 보류, 배선 필요 지점을 문서화

**초기 채택.** client-sent `principal`은 무조건 제거하고, 서버 검증 주입만 후속 유닛으로 남겼다.

**후속 구현.** 첫 번째 경로를 채택했다. `lib/api/agent.ts`는 이미 메모리에 존재하는 access JWT를 same-origin 프록시에만 전송한다. `agentProxy.ts`는 `SSUAI_API_PROXY_TARGET`(또는 기존 backend base)으로 `/api/auth/me`를 호출해 JWT를 검증하고, 성공 때만 응답의 `studentId`를 주입한다. Authorization이 없는 익명 요청만 기존 MCP-session 소유권 경로를 사용한다. Bearer가 제시된 뒤 검증이 실패하면 소유권 tier를 조용히 낮추지 않고 만료는 401, verifier 장애·잘못된 응답은 503으로 upstream 호출 전에 중단한다. refresh-cookie path를 넓히는 방법은 cross-site cookie 범위를 불필요하게 늘리므로 기각했다.

### C. 하이브리드(주입 시도 후 실패 시 session owner로 폴백)

**기각.** stable principal로 이미 귀속된 thread에 session-only 요청을 보내면 ssuAgent가 403으로 거부한다. 프론트가 이 403을 복구하며 새 thread를 만들면 사용자는 기존 대화 포인터를 잃는다. 더 중요하게는 인증 토큰을 보낸 요청의 검증 실패를 익명과 동일하게 처리하면 인증 상태를 조용히 강등한다. 따라서 bearer가 있으면 fail-closed하고, bearer 자체가 없는 요청만 session owner를 사용한다.

## 결정

`lib/server/agentProxy.ts`에 `stripAndInjectPrincipal(rawBody, serverPrincipal)` 순수 함수를 추가했다. `/api/agent/stream`, `/api/agent/resume`가 공유하는 `proxyToAgent()`가 모든 요청에 대해:

1. body를 파싱해 `principal` 키를 무조건 삭제한다(클라이언트가 무엇을 보냈든).
2. `deriveServerPrincipal(request)`가 non-null을 반환하면 그 값을 `principal`로 주입한다.
3. `deriveServerPrincipal`은 bearer가 없을 때만 `null`을 반환한다. bearer가 있으면 ssuMCP `/api/auth/me`를 3초 timeout으로 호출하고, 검증된 `studentId`만 principal로 사용한다.
4. bearer 만료·거부는 401, verifier timeout·네트워크/5xx·잘못된 subject는 503으로 종료하며 ssuAgent를 호출하지 않는다.
5. JSON 파싱에 실패하는 malformed body는 그대로 통과시킨다 — ssuAgent 자체의 pydantic 검증이 거부한다.

## 구현 선택

- **`stripAndInjectPrincipal`을 순수 함수로 분리**: `fetch`/`Request`를 모킹하지 않고도 strip/inject 조합(클라이언트 있음+서버 있음, 클라이언트 있음+서버 없음, 둘 다 없음, malformed)을 직접 단위 테스트할 수 있다. `proxyToAgent` 통합 테스트는 `vi.stubGlobal("fetch", ...)`로 별도로 얇게 덮는다(`lib/api/client.test.ts`와 동일 패턴).
- **`deriveServerPrincipal`을 이름 있는 별도 함수로 노출**: 검증 호출과 실패 정책을 한 경계에 모으고, 이 함수가 **요청 body의 `principal`을 절대 읽지 않는다**는 계약(클라이언트 주장값을 서버 검증값으로 세탁하는 경로 원천 차단)을 시그니처와 주석으로 고정한다.
- **짧은 verifier timeout + fail-closed 상태 분리**: 인증 거부는 재로그인이 가능한 401, verifier 가용성 문제는 503으로 구분한다. 둘 다 ssuAgent 호출 전에 끝내므로 ownership tier가 바뀌지 않고 60초 스트림 실행 예산을 검증 호출이 소진하지 않는다.
- **malformed JSON은 그대로 통과**: strip을 위해 굳이 엄격한 스키마 검증까지 이 계층에서 할 필요가 없다 — ssuAgent가 이미 pydantic으로 요청을 검증하므로, 여기서는 "파싱 가능하면 principal을 제거/주입, 아니면 손대지 않고 통과"만 책임진다.

## 트레이드오프

- **얻는 것**: `/api/agent/*`의 client-sent principal을 제거하고 서버 검증 subject만 주입한다. 로그인 사용자의 thread ownership이 access-token 회전과 MCP session 교체에 흔들리지 않으며, 검증 실패 때 기존 thread를 잘못 session-only로 재해석하지 않는다.
- **잃는 것 / 남는 리스크**: 로그인 요청마다 ssuMCP `/api/auth/me` 왕복이 한 번 추가된다. 3초 timeout과 명확한 503으로 장애 전파를 제한한다. 운영에서는 ssuAI와 ssuAgent 양쪽의 동일 `AGENT_API_KEY`가 필수이며, 이 경계가 꺼진 공개 ssuAgent에는 stable principal을 신뢰할 수 없다.

## 예상 면접 질문

1. "왜 bearer 검증 실패를 session owner로 폴백하지 않고 401/503으로 중단하나요?"
2. "브라우저의 JWT를 왜 ssuAgent까지 전달하지 않고 ssuMCP `/api/auth/me`에서 subject로 축약하나요?"
3. "`deriveServerPrincipal`이 요청 body를 읽지 않는다는 계약과 `AGENT_API_KEY` 강제가 함께 필요한 이유는 무엇인가요?"
