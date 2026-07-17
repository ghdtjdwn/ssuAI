# Troubleshooting Record

실제로 발생한 CI·운영 문제만 기록한다. 재현 증거와 검증 결과가 없는 가상 사례는 포함하지 않는다.

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
