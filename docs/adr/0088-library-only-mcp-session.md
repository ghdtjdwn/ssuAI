# ADR 0088 — 도서관 단독 인증 사용자의 MCP 채팅 세션 발급

- **Status**: Accepted — 구현
- **Date**: 2026-07-11
- **Scope**: `components/chat/ChatPanel.tsx`, `lib/api/agent.ts`, `components/chat/ChatPanel.test.tsx`
- **연관**: [ssuAgent ADR 0013 후속 수정](https://github.com/ghdtjdwn/ssuAgent/blob/main/docs/adr/0013-library-reservation-preauth-gate.md), ssuMCP `POST /api/mcp/auth/web-session` JWT 선택화

## 배경

2026-07-11 u-SAINT 점검 시간에 운영에서 도서관에는 로그인되어 있지만 SAINT에는 로그인할
수 없는 사용자가 도서관 좌석 예약 대화에서 다시 로그인하라는 안내를 받는 사고가 있었다.

원인은 ssuAI의 `ChatPanel`이 `mcp_session_id`를 SAINT 인증 상태에만 결합해 발급했기
때문이다. 도서관 로그인은 `LibraryAuthContext`와 브라우저 쿠키 세션으로 별도 유지되지만,
기존 프론트엔드 effect는 `useSaintAuth().isAuthenticated`와 `accessToken`이 없으면
`POST /api/mcp/auth/web-session`을 호출하지 않았다. 그 결과 도서관 세션이 살아 있어도
에이전트 요청에는 `mcp_session_id: null`이 실렸고, ssuAgent ADR 0013의 도서관 예약
사전 게이트는 세션 없음 상태를 미로그인처럼 안내했다.

백엔드 전제는 ssuMCP에 먼저 반영되었다. `POST /api/mcp/auth/web-session`은 이제 Bearer
JWT를 선택적으로 받는다. JWT가 있으면 SAINT/LMS identity를 연결하고, 도서관 쿠키 세션이
있으면 LIBRARY도 함께 연결한다. JWT가 없어도 도서관 쿠키 세션이 있으면 LIBRARY만 연결한
MCP web session을 발급한다. 둘 다 없으면 401을 반환한다.

## 결정

ssuAI는 web-session JWT 선택화에 맞춰 채팅 패널의 MCP 세션을 현재 가능한 identity tier로
발급하고, 더 강한 identity가 생기면 재발급한다.

`createMcpWebSession(accessToken)`은 `accessToken: string | null`을 받는다. 토큰이 있으면
`Authorization: Bearer ...`를 보내고, 토큰이 없으면 `Authorization` 헤더를 아예 보내지
않는다. 대신 모든 호출에 `credentials: "include"`를 넣어 도서관 쿠키 세션이 ssuMCP에
전달되게 한다.

`ChatPanel`은 현재 `mcpSessionId`가 어떤 identity로 발급되었는지
`mcpSessionGrantsRef: { jwt: boolean; library: boolean } | null`에 기록한다. 새 effect는
현재 상태에서 원하는 grant를 계산한다.

- `wantJwt = isAuthenticated && !!accessToken`
- `!wantJwt && !libraryConnected`이면 identity가 없으므로 grants와 `mcpSessionId`를 비운다.
- 기존 세션이 있고 grants가 현재 원하는 JWT/library identity를 모두 덮으면 그대로 쓴다.
- 그렇지 않으면 `createMcpWebSession(wantJwt ? accessToken : null)`로 새 세션을 발급하고,
  성공 시 그 세션의 grants를 기록한다.

실패는 기존처럼 비치명적이다. `mcp_session_id` 없이 공개 도구 모드로 남기고, 개발 환경에서만
경고를 남긴다. 오래된 `library_connected` 플래그 때문에 401이 날 수 있으므로 실패 retry
loop는 두지 않는다.

기존 SAINT 로그아웃 effect는 유지한다. 로그아웃 전환에서는 thread와 메시지를 비우는 기존
동작이 필요하다. 이후 도서관 연결이 아직 살아 있으면 새 세션 발급 effect가 library-only
MCP 세션을 다시 만든다.

## 검토한 대안

### A. identity-tier 기반 발급과 재발급

채택했다. 세션 발급 책임을 채팅 패널에 남기면서 backend의 선택적 JWT 계약을 그대로 사용한다.
재발급은 멱등적이고, 도서관 로그인 이후처럼 identity가 개선되는 순간에 새 provider link를
가진 MCP 세션을 얻을 수 있다.

### B. 에이전트 게이트에서 `mcp_session_id` 조건 제거

기각했다. `mcp_session_id`가 없으면 ssuMCP private tool이 어떤 웹 세션으로 도서관 권한을
검사해야 하는지 알 수 없다. 게이트만 통과시켜도 실제 예약 tool 인증은 실패하고, 사용자는
중복 로그인 또는 더 늦은 실패를 보게 된다. ssuAgent ADR 0013 후속 수정도 같은 이유로 이
대안을 기각했다.

### C. 기존 MCP 세션에 LIBRARY 링크를 추가하는 별도 endpoint 도입

기각했다. API 표면이 늘고, "기존 세션 수정"과 "새 세션 발급"의 일관성 문제가 생긴다.
현재 web-session 발급은 이미 짧은 수명의 세션을 새로 만드는 멱등적 흐름이고, library login
이후 재발급하면 SAINT/LMS/LIBRARY link를 한 번에 다시 계산할 수 있다.

### D. 웹 도서관 로그인 시점에 MCP 세션을 바인딩

기각했다. 도서관 로그인 화면은 도서관 기능의 인증 흐름이고, MCP 채팅 세션은 에이전트 도구
실행을 위한 별도 관심사다. 로그인 성공 콜백이 채팅 패널의 세션 상태와 생명주기를 직접 알게
되면 웹 도서관 인증과 MCP 관심사가 결합된다. 채팅 패널이 자신이 보낼 `mcp_session_id`를
직접 관리하는 쪽이 책임 경계가 더 작다.

## 동작 방식

- 도서관에만 로그인된 사용자는 `Authorization` 없이 `credentials: "include"`로
  `web-session`을 호출하고, LIBRARY provider만 연결된 `mcp_session_id`를 받는다.
- SAINT에만 로그인된 사용자는 기존처럼 Bearer JWT로 `web-session`을 호출하고,
  SAINT/LMS provider가 연결된 `mcp_session_id`를 받는다.
- SAINT 세션이 먼저 발급된 뒤 도서관 로그인이 완료되면 `libraryConnected` 변화로 effect가
  다시 실행되고, 기존 grants에 LIBRARY가 없으므로 재발급한다.
- SAINT도 도서관도 없으면 `mcpSessionId`는 `null`이다. 화면의 "공개 도구 모드" 표시는
  그대로 유지된다.
- SAINT 로그아웃은 기존처럼 thread/messages/session state를 정리한다. 도서관 쿠키 세션이
  남아 있으면 다음 렌더에서 library-only MCP 세션을 다시 발급한다.

## 검증

- 도서관 연결 true, SAINT 미인증이면 `createMcpWebSession(null)`이 호출되고 에이전트
  stream 요청에 발급된 session id가 실린다.
- SAINT 인증 true, 도서관 미연결이면 기존처럼 access token으로 `createMcpWebSession`이
  호출된다.
- SAINT session 발급 후 도서관 연결이 true가 되면 두 번째 `createMcpWebSession` 호출로
  재발급된다.
- 둘 다 없으면 `createMcpWebSession`을 호출하지 않고 `mcp_session_id`는 null로 남는다.
