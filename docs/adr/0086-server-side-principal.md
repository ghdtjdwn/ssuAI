# ADR 0086 — 에이전트 프록시에서 클라이언트발 `principal` 무조건 제거 (ssuAgent ADR 0011 짝꿍)

- **Status**: Accepted — strip-only 구현 완료, 서버측 identity 주입은 dormant(배선 없음)
- **Date**: 2026-07-10
- **Scope**: `lib/server/agentProxy.ts`(`/api/agent/stream`, `/api/agent/resume`가 공유하는 프록시), `lib/server/agentProxy.test.ts`
- **연관**: [ssuAgent ADR 0011](https://github.com/hoeongj/ssuAgent/blob/main/docs/adr/0011-thread-stable-principal-binding.md) — 회전하는 `mcp_session_id` 대신 안정적인 `principal`로 thread 소유권을 재바인딩하는 ssuAgent 측 절반. **그 ADR의 신뢰 모델을 그대로 계승한다**: "principal은 절대 클라이언트가 주장할 수 있는 값이어서는 안 되고, 오직 ssuAI의 서버측 프록시만 주입할 수 있다."

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

**결론: 오늘 시점에 ssuAI의 Next.js 서버는 `/api/agent/*` 라우트에서 검증 가능한 identity를 전혀 갖고 있지 않다.** JWT는 브라우저에만 있고, 이 라우트로는 전달되지 않는다(헤더도 쿠키도 없음). ssuMCP가 JWT를 검증하지만 그 결과가 이 프록시로 돌아오는 배선이 없다.

## 대안 비교

### A. 지금 당장 억지로 identity를 만들어 주입

예: 클라이언트가 body에 `studentId`를 실어 보내게 하고 그 값을 신뢰해 `principal`로 승격.

**기각.** ssuAgent ADR 0011이 정확히 막으려는 것 — 클라이언트가 주장하는 identity를 서버가 검증 없이 신뢰하는 것 — 을 그대로 재현한다. IDOR을 없애는 게 아니라 이름만 `principal`로 바꿔 재도입하는 것.

### B. Strip만 하고 주입은 보류, 배선 필요 지점을 문서화

**채택.** 오늘 진짜로 존재하는 것만 구현한다: 클라이언트발 `principal`은 무조건 제거(방어), 서버 검증 identity 주입은 `deriveServerPrincipal()`이라는 이름 붙은 훅으로 명시적으로 dormant 상태를 유지한다. 이 함수는 항상 `null`을 반환하며, 왜 그런지(위 탐색 결과)를 코드 주석과 이 문서에 남긴다. 실제로 배선하려면 다음 중 하나가 후속 유닛으로 필요하다:
- `lib/api/agent.ts`의 fetch 호출에 `Authorization: Bearer <accessToken>`을 실어 보내고, `agentProxy.ts`가 그 토큰을 ssuMCP의 검증 엔드포인트(예: `/api/auth/me` 상당)로 확인한 뒤 학번을 `principal`로 주입, 또는
- refresh-token 쿠키의 `Path`를 `/api/agent`까지 넓히고, 라우트 핸들러가 그 쿠키로 백엔드에 검증을 위임.

두 방법 모두 이번 유닛의 범위(방어 + 배선 여부 판단) 밖이라 별도 유닛으로 남긴다.

### C. 하이브리드(주입 시도 후 실패 시 strip으로 폴백)

**B에 포함.** `deriveServerPrincipal`이 `null`을 반환하면 자연히 principal 없이 포워딩되므로(ssuAgent ADR 0011의 세션 바인딩 폴백으로 흐름), 별도의 "폴백 로직"이 필요 없다 — B 자체가 이미 하이브리드 구조다.

## 결정

`lib/server/agentProxy.ts`에 `stripAndInjectPrincipal(rawBody, serverPrincipal)` 순수 함수를 추가했다. `/api/agent/stream`, `/api/agent/resume`가 공유하는 `proxyToAgent()`가 모든 요청에 대해:

1. body를 파싱해 `principal` 키를 무조건 삭제한다(클라이언트가 무엇을 보냈든).
2. `deriveServerPrincipal(request)`가 non-null을 반환하면 그 값을 `principal`로 주입한다.
3. `deriveServerPrincipal`은 오늘 항상 `null`을 반환한다(위 탐색 결과, 검증 가능한 identity가 없음) — 즉 오늘은 모든 요청이 `principal` 없이 ssuAgent로 전달되고, ssuAgent ADR 0011의 세션 바인딩(규칙 2) 경로로만 흐른다.
4. JSON 파싱에 실패하는 malformed body는 그대로 통과시킨다 — ssuAgent 자체의 pydantic 검증이 거부한다.

## 구현 선택

- **`stripAndInjectPrincipal`을 순수 함수로 분리**: `fetch`/`Request`를 모킹하지 않고도 strip/inject 조합(클라이언트 있음+서버 있음, 클라이언트 있음+서버 없음, 둘 다 없음, malformed)을 직접 단위 테스트할 수 있다. `proxyToAgent` 통합 테스트는 `vi.stubGlobal("fetch", ...)`로 별도로 얇게 덮는다(`lib/api/client.test.ts`와 동일 패턴).
- **`deriveServerPrincipal`을 이름 있는 별도 함수로 노출**: 오늘은 `null`만 반환하지만, 함수 경계를 미리 그어두면 후속 유닛이 이 함수 내부만 채우면 되고 `stripAndInjectPrincipal`/`proxyToAgent`는 건드릴 필요가 없다. 또한 이 함수가 **요청 body의 `principal`을 절대 읽지 않는다**는 계약(클라이언트 주장값을 서버 검증값으로 세탁하는 경로 원천 차단)을 시그니처와 주석으로 고정한다.
- **malformed JSON은 그대로 통과**: strip을 위해 굳이 엄격한 스키마 검증까지 이 계층에서 할 필요가 없다 — ssuAgent가 이미 pydantic으로 요청을 검증하므로, 여기서는 "파싱 가능하면 principal을 제거/주입, 아니면 손대지 않고 통과"만 책임진다.

## 트레이드오프

- **얻는 것**: 오늘 이 순간부터 `/api/agent/*`로 임의 `principal`을 주장하는 요청은 전부 무력화된다(ssuAgent가 어차피 세션 바인딩으로 폴백하므로 있으나 마나였지만, 명시적 방어를 코드로 고정).
- **잃는 것 / 남는 리스크**: ssuAgent ADR 0011이 노린 실제 효과(재로그인·멀티기기 히스토리 보존)는 **오늘은 전혀 발생하지 않는다** — `deriveServerPrincipal`이 dormant이기 때문이다. ssuAgent 쪽과 마찬가지로 이 변경도 "절반의 배선"이며, 나머지 절반(서버 검증 identity를 실제로 이 라우트까지 끌어오는 배선)은 후속 유닛 과제로 남는다.

## 예상 면접 질문

1. "principal 주입을 왜 지금 구현하지 않고 strip만 했나요? 판단 근거는?"
2. "브라우저가 이미 갖고 있다는 SmartID JWT가 왜 이 프록시 라우트에는 도달하지 않나요? (Authorization 헤더 미부착 + 쿠키 Path 스코프, 두 가지 근거를 각각 설명)"
3. "`deriveServerPrincipal`이 요청 body를 읽지 않는다는 계약이 왜 중요한가요? 만약 body의 principal을 읽어서 그대로 반환하면 어떤 공격이 가능해지나요?"
