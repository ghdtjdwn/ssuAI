# ADR 0099 — MCP 웹 세션의 실제 provider grant를 연결 상태로 사용

- **상태**: Accepted
- **날짜**: 2026-07-16
- **범위**: `McpSessionContext`, `ChatPanel`, `useConnections`, ssuMCP `POST /api/mcp/auth/web-session`
- **연관**: [ADR 0088](0088-library-only-mcp-session.md), ssuMCP ADR 0031 후속 결정

## 배경

ssuAI는 SAINT access JWT가 있으면 SAINT를 연결됨으로 표시하고, LMS query가 과거 한 번 성공하면 LMS도 연결됨으로 표시했다. 채팅 패널은 별도 effect에서 MCP 세션을 비동기로 발급하면서 요청한 identity를 실제 provider grant로 간주했다.

이 세 상태는 동일하지 않다. 웹 JWT가 살아 있어도 SAINT/LMS credential은 만료되거나 배포 과정에서 이관되지 않을 수 있다. 또한 세션 발급 effect가 끝나기 전에 사용자가 메시지를 보내면 `mcp_session_id: null`이 전송됐다. 발급 실패도 화면에 나타나지 않아 상단은 `3/3 연결`인데 학사·LMS 에이전트는 로그인을 반복 요청하는 모순이 생겼다.

## 결정

1. 앱 수준 `McpSessionProvider`가 웹 세션 발급, 만료, 실제 grant, 오류를 단일 소스로 관리한다. `ChatPanel`과 연결 배지가 별도 추론 상태를 갖지 않는다.
2. ssuMCP의 `linkedProviders`만 SAINT/LMS/LIBRARY 연결 여부로 인정한다. 필드가 없는 구버전 응답은 rolling deployment 동안 빈 grant로 해석해 fail-closed한다.
3. 인증 가능한 웹 identity가 있으면 채팅 전송과 HITL 재개는 single-flight `ensureSession()`을 기다린다. 발급 실패 시 null 세션으로 조용히 강등하지 않고 사용자가 재시도할 수 있는 연결 오류를 표시한다.
4. 실패한 발급 promise는 캐시하지 않는다. 다음 메시지는 새 발급을 시도한다. identity가 바뀐 동안 완료된 이전 응답은 폐기하고 현재 identity로 다시 발급한다.
5. `expiresAt` 30초 전에 세션을 갱신한다. 만료된 ID를 연결됨으로 계속 표시하거나 agent 요청에 싣지 않는다.
6. `library_connected` 힌트도 `LibraryAuthContext`의 로컬 플래그가 아니라 같은 MCP 세션의 실제 `LIBRARY` grant에서 계산한다. 이 값은 여전히 권한 부여 수단이 아니지만 UI와 server-confirmed 상태가 일치한다.

## 검토한 대안

- **기존 컴포넌트 effect 유지 + send에서 잠깐 대기**: 연결 배지와 채팅이 계속 서로 다른 상태를 추론하고 identity 변경·만료 경쟁을 두 군데서 처리해야 하므로 기각했다.
- **발급 실패 시 공개 도구 모드로 계속 전송**: 공개 질문은 동작하지만 개인 질문이 거짓 재로그인 안내로 바뀌어 현재 장애를 숨기므로 기각했다. 실제 익명 사용자는 identity가 없을 때 그대로 공개 모드를 사용한다.
- **JWT 존재를 SAINT/LMS 연결 증명으로 사용**: 외부 provider credential의 별도 만료·건강 상태를 표현할 수 없어 기각했다.

## 검증

- 발급 중 즉시 전송해도 agent stream은 발급 promise가 끝난 뒤 실제 session ID로 한 번만 시작한다.
- 첫 발급이 실패하면 연결 오류가 표시되고 다음 전송에서 재시도해 성공한다.
- `linkedProviders`가 없거나 비어 있으면 session ID가 있어도 연결 개수는 0이다.
- library 로컬 상태와 무관하게 agent의 `library_connected`는 실제 `LIBRARY` grant와 일치한다.
- 로그아웃·identity 강화·세션 만료 시 기존 grant를 폐기하고 새 세션을 발급한다.

백엔드가 `linkedProviders`를 먼저 배포하고 프론트엔드를 뒤이어 배포한다. 역순이나 부분 rollout에서도 필드 부재를 빈 grant로 처리하므로 거짓 연결 상태는 만들지 않는다.
