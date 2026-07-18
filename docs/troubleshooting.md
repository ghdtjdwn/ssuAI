# Troubleshooting Record

실제로 발생한 CI·운영 문제만 기록한다. 재현 증거와 검증 결과가 없는 가상 사례는 포함하지 않는다.

## 2026-07-18 — 로컬 접근성 게이트와 운영 색상 토큰의 release drift

### 맥락과 영향

동일한 5개 핵심 화면을 대상으로 로컬 production build의 브라우저 게이트는
통과했지만 운영 `ssuai.vercel.app`에서는 12개 검사 중 10개 route-level axe
검사가 실패했다. 페이지는 접근 가능했고 Web Vitals 예산도 통과했지만, 작은
텍스트의 색상 대비가 serious 수준으로 기록됐다. 로컬 게이트 통과만으로 운영
접근성을 주장할 수 없는 release parity 문제였다.

### 기대 행동, 재현과 증거

- 기대: 검토된 색상 토큰을 사용한 동일 release가 로컬과 운영의 axe
  검사에서 critical·serious 위반 없이 통과한다.
- 실제: 운영 CSS의 `text-subtle` 토큰은 `#8a94a2`였고 밝은 배경에서 관찰된
  대비비는 2.86:1∼3.21:1이었다.
- 재현: `E2E_BASE_URL=https://ssuai.vercel.app E2E_REUSE_SERVER=true pnpm test:e2e`로
  운영 origin을 검사했다. 학교 API는 명시적 503 fixture로 차단해 실제 학생 데이터나
  외부 시스템을 변경하지 않았다.

Web Vitals 2개는 통과했고 desktop과 Pixel 7 profile의 5개 route에서 각각
색상 대비 위반이 재현됐다. 로컬 분기의 CSS는 이미 보정된 `#5f6b7a`를
사용하고 있어 두 환경의 release가 다른 것도 함께 확인했다.

### 원인과 대안

직접 원인은 밝은 배경에서 기준 대비비를 만족하지 못한 텍스트 토큰과 추가
opacity였다. 로컬에서는 보정됐지만 운영 artifact가 보정 전 release였던 것이
두 환경의 결과가 다른 원인이었다.

- 해당 노드를 axe 검사에서 제외: 실제 사용자 문제를 숨기므로 제외했다.
- 도달 가능한 임계값으로 검사 기준을 낮춤: WCAG 회귀 게이트의 의미를 약화해
  제외했다.
- 공유 토큰을 `#5f6b7a`로 보정하고 해당 텍스트의 중복 opacity를 제거:
  모든 route에 동일한 의미를 유지하면서 원인을 제거해 채택했다.

### 해결, 검증과 재발 방지

보정과 로컬 게이트를 포함한 pull request
[#256](https://github.com/ghdtjdwn/ssuAI/pull/256)을 `8af59ef`로 머지했다. 같은
commit의 [main CI](https://github.com/ghdtjdwn/ssuAI/actions/runs/29646211137)에서 lint,
typecheck, 190개 Vitest, production build, 12개 Playwright 검사가 모두 통과했다.
Playwright 게이트는 desktop과 mobile profile의 axe와 LCP·CLS 예산을 매 PR과 main에서
같이 검사한다. gitleaks 보안 check도 통과했다.

Vercel은 정확히 `8af59ef`에 대한 Production 배포 성공을 GitHub에 기록했고,
배포 후 `https://ssuai.vercel.app`의 읽기 전용 root probe는 HTTP 200을 반환했다.

### 남은 위험과 면접 질문

이 작업에서 배포 후 운영 origin을 대상으로 한 axe 전체 재실행 결과는 보존하지
못했다. 따라서 정확한 commit의 배포와 도달 가능성은 확인했지만, 운영 WCAG
준수를 확정하지 않는다. 후속 검증은 같은 브라우저 suite를 운영 origin에 대해
실행하고 결과를 release SHA와 함께 보존해야 한다.

- 로컬 e2e 게이트가 통과했는데 운영에서만 실패한 원인을 어떻게 분리했는가?
- 색상 대비 경고를 예외 처리하지 않고 공유 토큰을 바꾼 이유는 무엇인가?
- CI, Vercel 배포 성공, HTTP 200이 각각 무엇을 증명하고 무엇은 증명하지 못하는가?

## 2026-07-18 — 3/3 연결 표시와 실제 provider 사용 가능성 불일치

### Context and impact

운영 ssuAI에서 연결 패널은 u-SAINT·LMS·도서관을 `3/3 연결`로 표시했지만, 채팅의 졸업요건
조회는 도구 실행 뒤 시스템 연결 오류로 끝났고 LMS 자료 요청은 연결 상태를 확인하지 못했다는
응답을 반환했다. 사용자는 로그인이 성공했는데 다시 로그인해야 하는지 판단할 수 없었다.

### Expected and actual behavior

- 기대: `3/3 연결`은 세 provider가 현재 사용할 수 있다는 최신 server-confirmed 결과를 뜻한다.
- 실제: 저장된 grant 또는 이전에 확인한 grant가 있으면 provider의 현재 건강 상태나 status 갱신
  성공 여부와 무관하게 연결됨으로 표시될 수 있었다.

### Reproduction and evidence

1. 세 provider를 연결해 상단 배지가 `3/3`인지 확인한다.
2. 채팅에서 졸업요건 조회와 LMS 자료 요청을 실행한다.
3. 학사 도구가 실제로 시작된 뒤 실패하고, LMS agent가 연결 상태 확인 불가를 반환하는 동안에도
   연결 표시는 유지되는 것을 확인한다.

코드 추적 결과 채팅 헤더는 `linkedProviders`가 하나라도 있으면 일반적인 `MCP 연결됨`을 표시했다.
또한 live-status의 retryable 실패는 cached session을 성공 응답처럼 다음 단계에 전달해 context 상태를
다시 `connected`로 설정했다. 기존 web-session 응답에는 저장된 grant와 provider의 현재
`ERROR`·`EXPIRED` 상태를 함께 표현할 필드가 없었다.

### Root cause

문제는 로그인 자체가 아니라 서로 다른 세 상태를 하나로 표시한 것이었다.

- web identity와 credential grant 존재
- provider credential의 현재 health
- live-status 조회의 최신 성공 여부

`linkedProviders` 스냅샷과 cached session ID는 두 번째와 세 번째 상태를 증명하지 못하지만 UI가 모두
성공으로 해석했다.

### Alternatives and resolution

- 일시적 status 실패 때 session을 즉시 폐기: 복구 가능한 agent 요청까지 막고 새 세션을 불필요하게
  회전시키므로 제외했다.
- `UNKNOWN`을 실패로 처리: 발급 직후 SAINT/LMS credential과 별도 probe가 없는 도서관을 항상
  실패로 만들므로 제외했다.
- JWT 또는 과거 query 성공을 연결 근거로 복구: provider credential의 독립적인 만료와 장애를 다시
  숨기므로 제외했다.

web-session 응답에 선택적 `availableProviders`와 `providerHealth`를 추가한다. 연결 개수와 tool hint는
operational 목록인 `availableProviders`를 우선하고, `linkedProviders`는 grant 존재와 degraded 원인
표시를 위해 유지한다. 프론트엔드는 `ERROR`를 degraded, `EXPIRED`를 재연결 상태로 표시하며,
`availableProviders` → health로 필터링한 linked grant → legacy linked grant 순서로 rolling deployment를
호환한다. retryable live-status 실패는 session ID를 유지하면서 context를 `stale`로 전환한다. 채팅은
실제 `N/3`, 연결 패널은 `?/3`과 마지막 확인 개수를 보여준다. 도구 호출 도중 provider health가 변하면
60초 poll 전에도 반영되도록 agent SSE가 settle된 직후 best-effort status 갱신을 실행한다.
`UNKNOWN`은 사용 가능 개수에는 포함하되 성공 검증과 혼동하지 않도록 중립적인 `상태 미확인`으로
표시한다. status 요청과 stream 종료 갱신이 겹치면 완료 뒤 후속 요청을 한 번만 실행하며 identity가
바뀌면 이를 폐기한다. HITL interrupt는 원래 MCP session의 action 소유권을 고정하고 resume stream이
끝나기 전에는 stream-triggered status 갱신을 하지 않는다.

### Validation and regression prevention

- `ChatPanel`, `ConnectionsPanel`, `useConnections` 집중 테스트 35개 통과
- 3/3, 부분 연결, 명시적 빈 `availableProviders`, health-only rollout, provider
  `ERROR`·`EXPIRED`·`UNKNOWN`, stale 우선순위와 stale→success 동작 검증
- stale 상태에서도 기존 session ID로 agent 요청을 계속 시도하는 복구 경로 검증
- agent stream 종료 직후 3/3이 degraded 2/3으로 갱신되는 경로 검증
- 진행 중 status 뒤 강제 갱신 1회 실행·중복 합치기·identity 변경 시 폐기 검증
- HITL interrupt session 고정, interrupt 중 무갱신, resume 종료 뒤 갱신 검증
- 채팅 live status와 provider별 연결·재연결·해제 accessible name 검증
- TypeScript typecheck와 ESLint 통과
- 전체 30개 테스트 파일, 187개 테스트와 Next.js production build 통과

운영 배포 뒤에는 실제 provider failure에서 연결 개수와 카드 상태가 함께 낮아지는지, status API의
일시 장애에서는 `stale` 표시가 다음 성공한 자동 갱신 뒤 해제되는지 별도로 확인해야 한다.

### Remaining risk and interview prompts

provider health는 마지막 probe 시점과 실제 도구 호출 사이에 다시 바뀔 수 있다. 따라서 UI 상태는
권한 부여 수단이 아니며 각 도구는 서버에서 credential을 재검증해야 한다.

- credential 존재, health, status freshness를 왜 별도 상태로 모델링했는가?
- 일시 장애 때 session ID를 유지하면서도 거짓 `연결됨` 표시를 막은 방법은 무엇인가?
- rolling deployment 중 선택 필드가 없는 응답을 어떻게 호환했는가?

## 2026-07-17 — MCP 세션 focus 갱신 테스트의 간헐 실패

### Context and impact

의존성 보안 패치를 반영한 main CI에서 175개 테스트 중 `ChatPanel`의 focus 갱신 테스트 하나가
간헐적으로 실패했다. 같은 SHA의 PR 검증과 Vercel 배포는 성공했고 공개 화면의 이상은 관찰되지
않았지만, main 품질 게이트가 실패해 배포 검증을 완료할 수 없는 상태였다.

### Expected and actual behavior

- 기대: 세션 생성 후 브라우저가 focus를 회복하면 현재 MCP provider grant를 다시 조회한다.
- 실제: UI에는 세션이 표시됐지만 테스트가 보낸 focus 이벤트를 listener가 받지 못해
  `getMcpWebSessionStatus` 호출이 0회로 남았다.

실패 증거는 [GitHub Actions run 29584119568](https://github.com/ghdtjdwn/ssuAI/actions/runs/29584119568)이다.
같은 SHA의 직전 PR run은 통과했고, 변경 범위에도 채팅 런타임이나 테스트 파일은 없었다.

### Reproduction and hypotheses

로컬에서 문제 테스트를 20회 반복했을 때 모두 통과해 결정적 기능 회귀는 재현되지 않았다. 대신
focus 이벤트가 만든 React 상태 변경이 `act(...)`에 포함되지 않았다는 경고가 함께 관찰됐다.

- 의존성 기능 회귀: 같은 SHA의 PR run과 로컬 전체 테스트가 통과해 배제했다.
- API mock 오류: 실패 전후 mock 입력이 같고 호출 자체가 0회여서 배제했다.
- effect 타이밍 경합: DOM commit 뒤 passive effect가 focus listener를 등록하기 전에 테스트가
  이벤트를 보낼 수 있어 증거와 일치했다.

### Root cause

`McpSessionProvider`는 세션이 생긴 뒤 실행되는 effect 안에서 expiry timer, status timer, focus
listener를 함께 등록했다. UI가 새 세션을 렌더링한 시점과 passive effect가 listener를 붙이는
시점 사이에 짧은 이벤트 유실 구간이 있었다. 테스트가 그 구간을 드물게 밟았고, 직접 호출한
`window.dispatchEvent`도 Testing Library의 React 동기화 경계를 우회했다.

### Alternatives and resolution

- 실패 job 재실행만 하기: 원인과 경고를 남기므로 제외했다.
- 테스트에 임의 sleep 추가: 실행 환경에 따라 다시 흔들리고 제품의 이벤트 유실 구간을 남겨 제외했다.
- listener 등록 여부를 테스트에서 spy하기: 테스트는 안정화하지만 실제 lifecycle 결합은 남겨 제외했다.

focus listener를 Provider 마운트 동안 한 번 유지하고, 유효한 cached session이 있을 때만 상태를
갱신하도록 변경했다. 세션별 expiry·interval timer는 기존 lifecycle을 유지한다. 테스트의 focus
이벤트는 `fireEvent.focus(window)`로 보내 React 상태 변경을 `act` 경계 안에서 처리한다.

### Validation and regression prevention

- 문제 테스트 50회 연속 통과
- `ChatPanel.test.tsx` 전체 12회 연속 통과, `act` 경고 없음
- 전체 29개 파일, 175개 테스트 통과
- lint, typecheck, production build 통과
- frozen install 및 `pnpm audit --audit-level low` 통과, 알려진 취약점 0건

listener는 cached session이 없으면 즉시 반환하므로 익명 사용자에게 불필요한 요청을 만들지 않는다.
남은 위험은 jsdom의 focus·effect scheduling이 실제 브라우저와 완전히 같지 않다는 점이다. 이를 줄이기
위해 테스트 재시도 설정에 의존하지 않고 lifecycle 자체에서 이벤트 유실 구간을 제거했다.

### Interview prompts

- 같은 SHA가 PR에서는 통과하고 main에서 실패했을 때 기능 회귀와 flake를 어떻게 구분했는가?
- 테스트에 sleep을 넣는 대신 React effect lifecycle을 바꾼 이유는 무엇인가?
- focus listener를 항상 유지하면서도 불필요한 API 호출을 어떻게 막았는가?
