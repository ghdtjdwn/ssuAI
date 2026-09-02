# ADR 0101 — 공식 근거 기반 정책 Copilot의 검토 경계

- 상태: Accepted
- 날짜: 2026-07-28
- 범위: `/copilot`, `/reviewer/copilot`, `lib/api/copilot.ts`, `components/shell/AppShell.tsx`

## 배경

공개 학칙·장학·수강 안내는 질문에 맞춰 여러 근거를 읽고 요약해야 한다. 생성형 AI 초안은
검색·정리 시간을 줄일 수 있지만, 개정 누락이나 개인별 자격판정을 공식 답변처럼 보이게 해서는 안 된다.

## 결정

1. 사용자 화면은 공개 학사정책 문의만 받고 개인 성적·학번·개인별 자격판정을 명시적으로 제외한다.
2. `/api/copilot/*`, `/api/reviewer/*` 호출은 access token을 Bearer로 붙인 same-origin `/api` 요청이다.
   프런트엔드는 권한을 판단하거나 우회하지 않으며 reviewer 권한은 backend deny-by-default가 최종 판단한다.
3. AI draft에는 공식 citation, 개정 검증 상태, 보류·검토 사유를 함께 표시한다. 반려된 과거 사례에는
   AI 초안과 별도로 서버가 반환한 반려 사유를 표시한다. AI draft는 지정 검토자가
   claim한 뒤 편집·승인하기 전 자동 게시하지 않는다.
4. 로그인 시 현재 principal의 최신 요청 20건을 복원한다. 사용자는 목록에서 과거 요청을 선택하고
   명시적으로 상태를 새로고침해 승인 최종본 또는 반려 사유를 확인한다. 생성 성공은 목록에 즉시
   반영하고 개별 새로고침은 해당 항목만 교체한다. 자동 polling은 사용하지 않으며 상태별 설명과
   AI 초안·승인 최종본을 구분한다.
5. reviewer의 결정에는 `expectedVersion`을 전송한다. 409는 다른 검토자의 선행 변경 가능성을 뜻하므로
   UI가 최신 큐를 다시 불러오도록 안내한다. 편집 권한은 브라우저 시계로 lease 만료를 추정하지 않고
   서버의 `claimedByCurrentReviewer`만 따른다. `claimExpiresAt`은 정보 표시용이며, 서버가 권한 없음을
   반환한 `IN_REVIEW` 사례는 다시 선점 요청을 보낼 수 있지만 성공 여부는 서버가 최종 판단한다.
6. 사례 큐와 운영 측정값은 principal별 별도 React Query로 관리한다. 측정값 장애는 별도 경고로 격리해
   queue, claim, decision을 막지 않는다. 반대로 reviewer API 또는 action에서 403을 한 번 받으면 같은
   keyed session 동안 access-denied를 유지하고 해당 principal의 사례·측정값 query를 취소·제거해 다른
   필터의 stale cache가 다시 보이지 않게 한다.
7. 화면은 사례 수, 승인/수정/근거 포함/안전 보류 비율과 처리 시간을 표시한다. 각 비율과 평균은 해당
   표본이 없으면 `—`로 표시한다. 이 지표는 관측값이며 시간 절감·정확도·사용자 만족도를 자동으로
   증명하지 않는다.
8. 데스크톱 sidebar에는 정책 Copilot을 추가한다. 모바일은 기존 5개 bottom tab을 유지하고 top bar에
   접근 가능한 바로가기를 둔다. reviewer route는 공개 주 메뉴에 넣지 않는다.
9. 프런트엔드 구현 완료와 운영 활성화를 구분한다. 직원 검토 도입을 목표로 하되, 운영 migration,
   reviewer secret, 직원 실계정 검증 전에는 화면에서 검토자를 직원으로 단정하지 않는다.

## 검토한 대안

- AI 답변 즉시 공개: 개정 검증과 책임 주체가 불명확해 기각했다.
- system-admin 화면으로 통합: 시스템 운영 권한과 정책 내용 검토 역할은 다르므로 reviewer라는 별도 문구와
  route를 사용한다.
- 실사용 ROI를 화면 수치로 추정: 실제 현업 측정 없이 절감시간을 주장할 수 없어 기각했다.

## 검증

- `pnpm exec vitest run lib/api/copilot.test.ts components/copilot/PolicyCopilotView.test.tsx components/copilot/ReviewerCopilotView.test.tsx components/shell/AppShell.test.tsx` — 32개 통과
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — 전체 235개 테스트와 Next.js 16.2.12 production build 통과
