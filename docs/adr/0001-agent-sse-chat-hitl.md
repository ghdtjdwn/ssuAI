# ADR 0001 — Agent SSE Chat UI & HITL Integration

- **Status**: Accepted (PR #194 merged 2026-06-14)
- **Date**: 2026-06-14
- **Scope**: ssuAI's chat panel, agent streaming API client, and Human-In-The-Loop (HITL) reservation workflow.

## 맥락 (Background)

기존 ssuAI는 ssuMCP의 단순 LLM 챗(단발성 또는 세션ID 기반 REST 통신)을 사용하고 있었습니다. 그러나 Multi-Agent 워크플로우(LangGraph)와 사용자의 최종 확인이 필요한 Action(도서관 예약 등)을 처리하기 위해, ssuAgent(LangGraph 기반 멀티 에이전트 서비스)와의 연동이 필요해졌습니다.
ssuAgent는 에이전트 전환(Handoff), 도구 실행(Tool call), 본문 텍스트(Text), 그리고 승인/취소 대기(HITL Interrupt) 등의 복합 이벤트를 Server-Sent Events(SSE) 스트림으로 제공합니다. 이 스트림을 프론트엔드에서 파싱하여 실시간으로 텍스트 및 상태 이벤트를 출력하고, Interrupt가 발생하면 스트림을 일시 중단한 뒤 사용자 승인을 묻는 대화형 카드(HitlCard)를 노출하며, 최종 승인/취소 결과를 서버로 재전송해 에이전트 동작을 이어나가도록(Resume) 구성해야 합니다.

또한 사용자의 인증 세션(JWT Bearer Token)을 개별 MCP 세션(mcp_session_id)에 브릿징하여 보안성이 확보된 도구 실행을 처리할 필요가 있습니다.

---

## 검토한 대안 (Alternatives Considered)

### 1. 스트림 수신 방식: `EventSource` vs `fetch` + `ReadableStream`
- **EventSource (HTML5 표준 API)**: 
  - *기각 사유*: `EventSource`는 기본적으로 GET 요청만 지원하며, HTTP 헤더나 Request Body에 커스텀 Payload(`message`, `thread_id`, `mcp_session_id` 등)를 전송하는 기능이 매우 제한적입니다. `fetch` 기반의 Polyfill(예: `@microsoft/fetch-event-source`)을 사용할 수도 있지만, 외부 의존성 라이브러리 추가를 최소화하고 런타임 성능 및 표준 번들 크기를 제어하기 위해 기각했습니다.
- **fetch + ReadableStream (선택)**: 
  - *선택 사유*: 브라우저 표준 `fetch` API를 사용하여 POST 요청을 보내고, Response Body의 `ReadableStream`을 얻어 `TextDecoder`와 수동 line-by-line SSE 데이터 파서로 스트리밍 데이터를 가공합니다. 외부 라이브러리 추가 없이 완벽히 브라우저 표준 명세만으로 구현이 가능하며, 세밀한 스트림 예외 처리와 데이터 파싱 제어가 가능합니다.

### 2. 네트워크 프록시 도입 여부: Next.js API Route Proxy vs 브라우저 직접 호출 (CORS)
- **Next.js API Route Proxy**:
  - *기각 사유*: 프론트엔드 서버를 거쳐서 백엔드(`ssuagent.duckdns.org`)로 요청을 릴레이하는 방식은 서버 리소스(이중 트래픽, 커넥션 풀 부족 우려) 소모가 크고 스트리밍 응답 지연을 추가시킵니다.
- **브라우저 직접 호출 (선택)**:
  - *선택 사유*: ssuAgent 백엔드 서버에 `CORS allow_origins=["*"]` 정책이 이미 올바르게 수립되어 있으므로 브라우저에서 직접 ssuAgent API 주소(`NEXT_PUBLIC_SSUAGENT_BASE_URL`)로 통신하도록 설정했습니다. 이를 통해 아키텍처가 단순화되고 반응 속도가 극대화됩니다.

### 3. 통신 프로토콜: WebSocket vs Server-Sent Events (SSE)
- **WebSocket**:
  - *기각 사유*: 에이전트의 응답은 서버에서 클라이언트로 일방향 스트리밍(텍스트 생성, 상태 변경 전달)되는 특성을 띱니다. 양방향 영속 커넥션 유지를 위한 오버헤드와 복잡한 프로토콜 설정을 고려할 때, 단방향 스트림 전송에 특화된 SSE(Server-Sent Events)가 훨씬 더 경량이고 아키텍처에 부합하여 WebSocket은 기각되었습니다.

---

## 결정 사항 (Decisions)

1. **`thread_id` 관리 정책**:
   - `crypto.randomUUID()`를 통해 클라이언트 브라우저 단에서 고유 `thread_id`를 최초 생성하고, 대화의 연속성을 보장하기 위해 `sessionStorage`(`ssuagent_thread_id` 키)에 유지합니다. 에이전트 요청 시 이를 필수 탑재하여 전송합니다.
   - 로그아웃으로 인증 상태가 `true -> false`로 전환되면 기존 `thread_id`를 폐기하고 새 값을 저장합니다. 익명 사용자가 처음 `/chat`에 들어온 경우에는 기존 anonymous thread 연속성을 유지합니다.
2. **`mcp_session_id` 브릿징 연동**:
   - 사용자가 로그인되어 JWT(`accessToken`)가 존재할 때, 컴포넌트 마운트 시점에 ssuMCP의 `POST /api/mcp/auth/web-session` API를 호출해 `mcp_session_id`를 발급받습니다. 발급된 세션 ID는 메모리 상(컴포넌트 state)에 관리하며, 에이전트 스트림 요청마다 바디에 포함하여 전송합니다. 실패 시에는 `null` 상태를 유지하여 비로그인 사용자 및 공개 도구 모드로 동작하게 만듭니다.
   - 로그아웃 시 메모리의 `mcp_session_id`와 대화 상태를 함께 제거합니다. 이후 같은 탭에서 다시 로그인하면 새 access token으로 web-session 교환을 다시 수행하고, 새 thread가 그 세션에 귀속됩니다.
3. **SSE 수동 파서 구현**:
   - `lib/api/agent.ts` 내에 `readAgentStream` Async Generator 함수를 작성하여, `data: ` 프리픽스를 가진 라인을 추출하고 JSON을 파싱하여 실시간으로 클라이언트에 스트리밍 이벤트를 yield 하도록 설계했습니다.
4. **HITL Interrupt & Resume 흐름**:
   - SSE 수신 도중 `type: "interrupt"` 이벤트가 수신되면, 서버는 스트림을 끊고 클라이언트는 이를 에러가 아닌 스트림 일시 중지 상태로 판정합니다.
   - 화면에 `HitlCard`를 그려주고 사용자에게 승인/취소 입력을 대기시킵니다.
   - 사용자 액션 발생 시 `POST /agent/resume`에 `thread_id`, `approved`, `action_id`, `mcp_session_id`를 담아 전송하고, 반환된 응답 스트림으로 새로운 SSE 연결을 열어 에이전트 루프를 이어받습니다.

---

## 결과 (Consequences)

### 장점 (Pros)
- **제로 의존성 (Zero-Dependency)**: 추가적인 npm 패키지 없이 웹 표준 명세(`fetch`, `ReadableStream`, `TextDecoder`)만으로 SSE 스트림 제어와 수동 파싱을 완벽히 소화하여 프론트엔드 번들 크기 증가를 예방했습니다.
- **보안 세션 바인딩**: 인증 토큰을 직접 에이전트에 노출하지 않고, ssuMCP를 거쳐 `mcp_session_id`라는 휘발성 키로 교환 후 바인딩함으로써 학생 개인정보 및 토큰 유출을 방지합니다.
- **미려한 UX**: Handoff(에이전트 전환)와 Tool 실행 등의 중간 단계를 화면에 실시간 피드백으로 시각화하여 사용자가 AI의 진행 상태를 명확히 이해하도록 돕습니다.

### 트레이드오프 (Cons)
- **CORS 의존성**: 브라우저 직접 호출에 따라 백엔드(`ssuagent.duckdns.org`)의 CORS 설정 상태가 가용성에 직접적인 영향을 주게 됩니다.
- **스트림 분절 대응**: 네트워크 불안정 등으로 인해 서버 측 `done` 이벤트가 오기 전에 스트림이 조기 소멸하는 케이스에 대응하기 위해, Generator 종료 시 최종 버퍼에 남은 잔여 텍스트 데이터의 강제 플러시 처리가 필요합니다.

---

## 2026-06-30 보강 — 로그아웃 시 thread/session reset (#12)

### 배경

ssuAgent는 `thread_id`를 생성 당시의 `mcp_session_id`에 바인딩하고, 다른 MCP 세션이 같은 thread를 사용하면 403으로 거부하도록 강화되었습니다. 이에 맞춰 ssuAI도 로그아웃에서 브라우저 state를 끊어야 합니다. 기존 구현은 `sessionStorage["ssuagent_thread_id"]`를 최초 1회만 읽고, `mcp_session_id`도 로그인 후 한 번만 교환해 메모리에 남겼습니다. 같은 탭에서 사용자를 바꾸면 새 로그인 요청이 이전 세션 소유 thread를 다시 보내 403을 맞거나, 이전 사용자의 대화·승인 대기 상태가 화면에 남을 수 있었습니다.

### 검토한 대안

- **서버 403에만 의존**: 기각. 서버 거부는 마지막 방어선이고, 프론트엔드는 이미 이전 대화 화면을 노출한 뒤 실패합니다.
- **`mcp_session_id`만 null로 초기화**: 기각. thread는 계속 이전 세션 소유라 새 MCP 세션이 붙어도 ownership mismatch가 남습니다.
- **익명 mount마다 thread 초기화**: 기각. 로그인한 적 없는 익명 사용자의 같은 탭 대화 연속성을 깨뜨립니다.

### 선택한 방식

`ChatPanel`이 `useRef`로 직전 `isAuthenticated` 값을 기억하고, `true -> false` 전환에서만 reset을 실행합니다. reset은 `mcp_session_id`를 null로 내리고, `sessionStorage["ssuagent_thread_id"]`를 제거한 뒤 기존 `getOrCreateThreadId` 저장 경로로 새 thread를 발급합니다. 동시에 `messages`, streaming buffer, pending interrupt, error, 입력 중 텍스트를 비워 같은 탭 사용자 전환에서 이전 사용자의 대화가 보이지 않게 합니다. 초기 익명 mount는 reset하지 않으므로 공개 도구 모드의 기존 동작은 유지됩니다.

### 근거와 동작

근거는 ssuAgent #12의 thread ownership binding입니다. 서버는 `thread_id`와 `mcp_session_id`의 소유 관계를 검증하고, 프론트엔드는 로그아웃 시 둘을 함께 폐기해 다음 로그인에서 새 MCP 세션과 새 thread가 한 쌍으로 시작되게 합니다. 이 조합으로 same-tab session/thread bleed와 ownership mismatch 403을 모두 줄입니다.

---

## 2026-06-30 보강 — 네트워크 경로 반전: 브라우저 직접 호출 → Next.js 서버 프록시 (#11)

### 배경

「검토한 대안 §2」의 결정(브라우저 → `ssuagent.duckdns.org` 직접 호출 + CORS `allow_origins=["*"]`)은 **폐기되었습니다**. ssuAgent `/agent/*`에 API 키 인증이 강제되면서(보안 후속 #11), 키를 브라우저에 노출하지 않고 주입할 서버 측 경로가 필요해졌습니다.

### 선택한 방식

`/api/agent/{stream,resume}` Next.js Route Handler 프록시(`lib/server/agentProxy.ts`)가 server-only `AGENT_API_KEY`를 `X-Agent-Key` 헤더로 주입하고 SSE 응답을 pass-through 스트리밍합니다. 브라우저 코드는 same-origin `/api/agent/*`만 호출합니다(`lib/api/agent.ts`).

- 당초 프록시를 기각했던 사유(이중 트래픽·스트림 지연)보다, **키를 서버에만 두는 인증 경계**가 우선한다고 재평가했습니다. SSE pass-through는 버퍼링 없이 릴레이해 체감 지연은 무시할 수준입니다.
- `NEXT_PUBLIC_SSUAGENT_BASE_URL`은 로컬 개발·레거시 폴백으로만 남습니다. 운영에서는 양쪽 서비스에 동일한 `AGENT_API_KEY`를 설정해 ssuAI 서버만 principal을 주장할 수 있게 한다. 키 생략은 ssuAgent 게이트도 비활성인 로컬 개발에만 허용한다.
- 「트레이드오프 — CORS 의존성」 항목도 이 전환으로 해소되었습니다(브라우저는 더 이상 cross-origin 호출을 하지 않음).

---

## 2026-07-11 보강 — 도서관 연결 상태 힌트 전달

도서관 좌석 예약 요청의 UX를 안정화하기 위해 `ChatPanel`은 `useLibraryAuth().isConnected` 값을 ssuAgent의 `/agent/stream`, `/agent/resume` 요청 바디에 `library_connected`로 함께 보냅니다. 이 값은 브라우저의 `sessionStorage` 기반 플래그에서 온 **client-asserted hint**이며 보안 경계나 서버 검증 결과가 아닙니다.

ssuAgent는 이 힌트를 사전 안내용 short-circuit에만 사용합니다. 실제 좌석 예약 게이트와 인증 강제는 ssuAgent/ssuMCP의 서버 측 세션 확인 및 기존 `AUTH_REQUIRED` 처리에 남아 있으므로, 클라이언트가 보낸 `library_connected` 값은 예약 권한을 부여하거나 우회하지 않습니다.

---

## 3 Core Interview Questions (예상 면접 질문)

### Q1. EventSource API를 사용하지 않고 `fetch`와 `ReadableStream`으로 SSE를 직접 파싱한 구체적인 이유는 무엇인가요?
> **Answer**: `EventSource`는 표준 규격상 GET 요청만 전송 가능하며, 요청 본문(Body)을 가질 수 없고 HTTP 헤더에 Bearer 토큰 같은 인증 정보를 설정하는 기능이 부재합니다. 저희 서비스는 사용자의 입력 메시지뿐만 아니라 세션 유지를 위한 `thread_id`, 인증 연동을 위한 `mcp_session_id` 같은 JSON payload를 POST 메서드의 Body로 전달해야 했습니다. 이를 해결하기 위해 표준 `fetch` API로 POST 요청을 보내고, Response Body의 `ReadableStream`을 얻어 `TextDecoder`와 Custom SSE Buffer Parser를 구현해 비동기 제너레이터(Async Generator) 형태로 데이터를 받아 실시간 스트림 파싱을 직접 구축했습니다.

### Q2. LangGraph에서 발생하는 Interrupt(HITL) 이벤트에 대해 클라이언트 측 상태 동기화 및 텍스트 렌더링을 어떻게 매끄럽게 처리하셨나요?
> **Answer**: 백엔드 에이전트에서 승인이 필요한 액션(예: 도서관 예약)을 실행하기 전에 Interrupt가 발생하면, 서버는 스트림 응답을 의도적으로 종결(Close)시킵니다. 클라이언트는 이 종결을 통신 에러로 판단하지 않고 자연스러운 흐름의 중단 상태로 분기 처리하여, 그때까지 쌓인 버퍼 텍스트를 메시지 창에 최종 안착시키고 `pendingInterrupt` 상태를 갱신해 승인 UI(HitlCard)를 노출합니다. 사용자가 승인 또는 취소를 클릭하면 `/agent/resume` 엔드포인트로 다시 POST 요청을 보내고, 해당 요청이 반환하는 새로운 SSE 응답 스트림에 대해 동일한 파서 루프(`consumeStream`)를 재진입시킴으로써 대화 및 실행 상태를 매끄럽게 연속적으로 유지할 수 있었습니다.

### Q3. 학생 인증 정보(JWT)가 어떻게 MCP 세션 ID(`mcp_session_id`)로 교환되고, 이를 통해 프론트엔드에서 보안 위협 없이 도구를 실행할 수 있나요?
> **Answer**: 프론트엔드가 백엔드 에이전트와 직접 통신할 때 JWT 액세스 토큰을 백엔드에 그대로 노출하거나 세션에 장기 보관하면 탈취 시 권한 남용 위험이 있습니다. 대신 컴포넌트 마운트 시점에 기존에 이미 인증된 ssuMCP 서버의 `/api/mcp/auth/web-session`으로 JWT를 전송하여 해당 토큰의 소유주 정보와 바인딩된, 단기 만료일시를 갖는 고유 `mcp_session_id`를 발급받습니다. 이후 클라이언트는 오직 이 `mcp_session_id`만을 에이전트 요청에 실어 보냅니다. 백엔드 에이전트 측은 예약 도구 등을 실행할 때 이 세션 ID를 통해 MCP 서버와 안전하게 통신하므로, 클라이언트 측은 개인정보나 인증 토큰의 유출 걱정 없이 보안성이 담보된 도구 실행 세션을 유지할 수 있습니다.

## 2026-07-11 갱신 — mcp_session_id 발급 조건 변경 (ADR 0088)

본문 "2. mcp_session_id 브릿징 연동"의 JWT-전용 발급 서술은 2026-07-11부로 구식이다.

현재는 identity-tier 발급: SAINT JWT 또는 도서관 연결(`libraryConnected`) 중 가능한 신원으로 발급하고, 더 강한 신원이 생기면 재발급한다. JWT 없는 호출은 `Authorization` 생략 + `credentials:"include"`.

상세와 대안 검토는 [ADR 0088](0088-library-only-mcp-session.md).
