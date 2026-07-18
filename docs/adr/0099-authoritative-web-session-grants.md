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
2. ssuMCP의 `availableProviders`를 SAINT/LMS/LIBRARY의 현재 사용 가능 여부로 인정한다. backend-first rolling deployment 동안 필드가 없으면 `providerHealth`로 `linkedProviders`를 필터링하고, 두 필드가 모두 없으면 legacy `linkedProviders`로 폴백한다.
3. 인증 가능한 웹 identity가 있으면 새 채팅 전송은 single-flight `ensureSession()`을 기다린다.
   발급 실패 시 null 세션으로 조용히 강등하지 않고 사용자가 재시도할 수 있는 연결 오류를 표시한다.
   단, 이미 interrupt된 HITL action은 원래 stream이 사용한 MCP session이 소유하므로 재개 전에
   `ensureSession()`으로 회전하지 않고 그 session ID와 availability snapshot을 그대로 사용한다.
4. 실패한 발급 promise는 캐시하지 않는다. 다음 메시지는 새 발급을 시도한다. identity가 바뀐 동안 완료된 이전 응답은 폐기하고 현재 identity로 다시 발급한다.
5. MCP 세션 identity는 raw access JWT가 아니라 안정된 학생 subject와 도서관 웹 연결 상태로 구성한다. 15분 access JWT 갱신은 agent thread·HITL action을 소유한 MCP 세션을 회전시키지 않고 이후 API 호출의 bearer만 교체한다.
6. 창 focus와 60초 주기에는 live-status API로 같은 MCP session ID의 실제 link와 credential 가용성을 다시 읽는다. provider callback·logout·만료가 7일짜리 발급 스냅샷에 갇히지 않는다. 같은 identity의 status 요청이 진행 중일 때 강제 갱신이 들어오면 기존 promise에 흡수하지 않고 완료 직후 정확히 한 번 실행하며, 중복 강제 갱신은 하나로 합친다. identity가 바뀌면 예약된 이전 identity 갱신은 폐기한다. 일시적인 네트워크·5xx·rate-limit 실패는 마지막으로 확인된 유효 세션을 폐기하지 않고 다음 주기에 재시도하되, 캐시된 grant를 새로 검증한 것처럼 표시하지 않는다. 이때 UI는 `stale` 상태와 마지막 확인 개수를 명시한다.
7. `expiresAt` 30초 전에만 새 세션을 발급한다. 만료된 ID를 연결됨으로 계속 표시하거나 agent 요청에 싣지 않는다.
8. `library_connected` 힌트도 `LibraryAuthContext`의 로컬 플래그가 아니라 같은 MCP 세션의 실제 `LIBRARY` availability에서 계산한다. 이 값은 여전히 권한 부여 수단이 아니지만 UI와 server-confirmed 상태가 일치한다.
9. 도서관 로그인이 이미 연결된 상태에서 새 credential을 발급해도 revision을 증가시킨다. 이 명시적 재인증은 이전 credential snapshot을 재사용하지 않도록 MCP 세션을 다시 발급한다.

## 검토한 대안

- **기존 컴포넌트 effect 유지 + send에서 잠깐 대기**: 연결 배지와 채팅이 계속 서로 다른 상태를 추론하고 identity 변경·만료 경쟁을 두 군데서 처리해야 하므로 기각했다.
- **발급 실패 시 공개 도구 모드로 계속 전송**: 공개 질문은 동작하지만 개인 질문이 거짓 재로그인 안내로 바뀌어 현재 장애를 숨기므로 기각했다. 실제 익명 사용자는 identity가 없을 때 그대로 공개 모드를 사용한다.
- **JWT 존재를 SAINT/LMS 연결 증명으로 사용**: 외부 provider credential의 별도 만료·건강 상태를 표현할 수 없어 기각했다.

## 검증

- 발급 중 즉시 전송해도 agent stream은 발급 promise가 끝난 뒤 실제 session ID로 한 번만 시작한다.
- 첫 발급이 실패하면 연결 오류가 표시되고 다음 전송에서 재시도해 성공한다.
- 사용 가능 provider 목록이 비어 있으면 session ID나 저장된 grant가 있어도 연결 개수는 0이다.
- library 로컬 상태와 무관하게 agent의 `library_connected`는 실제 `LIBRARY` availability와 일치한다.
- 로그아웃·identity 강화·세션 만료 시 기존 grant를 폐기하고 새 세션을 발급한다.
- 같은 학생의 access JWT만 갱신되면 MCP session ID와 진행 중 thread/HITL 소유권을 유지한다.
- provider callback·logout 뒤 창 focus 시 같은 session ID의 live grant가 갱신된다.
- 일시적인 live-status 실패는 유효한 session ID와 provider grant를 삭제하지 않는다.
- 일시적인 live-status 실패 동안 채팅은 `연결 상태 확인 불가`, 연결 패널은 `?/3`과 마지막 확인 개수를 표시한다.
- 도서관 `연결됨 → 연결됨` 재로그인도 credential revision 변경으로 감지한다.
- 진행 중 live-status와 stream 종료 후 갱신이 겹치면 후속 status를 한 번만 실행하고, identity가
  바뀌면 예약한 이전 요청을 실행하지 않는다.
- HITL interrupt 자체는 status를 갱신하지 않으며, 승인·거절 재개에는 interrupt를 만든 session
  ID를 사용하고 재개 stream이 끝난 뒤 갱신한다.

백엔드가 additive availability 필드를 먼저 배포하고 프론트엔드를 뒤이어 배포한다. 부분 rollout에서는 아래 호환 순서를 사용하므로 기존 응답을 깨지 않으면서 새 응답의 operational 상태를 우선한다.

## 2026-07-18 후속 결정 — provider health와 stale 표시

`linkedProviders`만으로는 credential grant가 저장됐다는 사실과 현재 upstream 호출 가능성을 구분할
수 없었다. 따라서 web-session 응답에 선택 필드 `availableProviders`와 `providerHealth`를 함께 둔다.

- `availableProviders`: 현재 tool call에 사용할 수 있는 provider 목록이며 연결 개수와
  `library_connected`의 최우선 기준이다.
- `linkedProviders`: grant 존재 목록이다. degraded 상태의 원인을 카드에 표시하고 구버전 응답과
  호환하기 위해 유지한다.
- `providerHealth`: provider별 operational 상태를 설명한다.

- `VALID`: 연결되고 상태 검증도 완료됐다.
- `UNKNOWN`: 아직 세부 probe가 끝나지 않았지만 발급 직후 credential과 도서관처럼 사용할 수
  있는 상태다. `availableProviders`에 포함된 경우(또는 해당 필드가 없는 health-only rollout에서
  `linkedProviders`에 있는 경우) 연결 개수에는 포함하되, UI는 검증 완료 상태와 구분해
  `상태 미확인`으로 표시한다.
- `ERROR`: 현재 사용할 수 없는 degraded 상태다. 연결 개수에서 제외하고 재연결 동작을 제공한다.
- `EXPIRED`: 만료된 상태다. 연결 개수에서 제외하고 재연결이 필요하다고 표시한다.
- 호환 순서는 `availableProviders` → `providerHealth`로 필터링한 `linkedProviders` → legacy
  `linkedProviders`다. 필드나 provider별 항목이 없는 backend-first rollout도 이 순서로 처리한다.

채팅 상태는 더 이상 provider 하나만 있어도 `MCP 연결됨`이라고 표시하지 않는다. 최신 검증 결과가
있으면 `개인 서비스 N/3 연결`로 실제 개수를 보여주고, grant가 없으면 `0/3 · 연결 필요`, 일부
provider가 degraded이면 `N/3 · 일부 확인 필요`, usable하지만 health가 `UNKNOWN`이면
`N/3 연결 · 상태 미확인`으로 구분한다. live-status 자체가 실패하면 session ID는 복구 가능한 요청을
위해 유지하지만, cached `ERROR`·`EXPIRED`를 포함한 provider 카드 전체에 session-level `stale`을
우선 표시해 이전 health가 현재 검증된 것처럼 보이지 않게 한다. 도구 호출 중 credential health가
바뀐 경우 60초 poll을 기다리지 않도록 agent SSE가 done, error 또는 비정상 종료로 settle될 때
best-effort live-status 갱신을 한 번 실행한다. interrupt는 아직 action이 끝난 상태가 아니므로
갱신하지 않고 원래 session으로 resume한 stream이 settle된 뒤 실행한다.
