# ssuAI Product Document

## 2026-06-13 추가: 웹 예약 UX

### 배경

도서관 좌석 예약은 백엔드의 `prepare`/`confirm` 계약이 먼저 있어야 안전하게 제품 화면에 올릴 수 있다.
PR-C1에서 웹 REST 경로가 `main`에 들어왔으므로, 이번 범위는 대시보드에서 추천 좌석을 보고 직접 예약을 확정하는 최소 UX를 제공한다.

### 구현 범위

- `SeatRecommendationPanel`: 현재 선택한 층의 추천 좌석 5개를 보여주고 각 좌석에 예약 버튼을 제공한다.
- `ReservationConfirmModal`: `prepare` 결과의 요약과 만료 시간을 보여준 뒤 사용자가 한 번 더 확정해야 `confirm`을 호출한다. `confirm` 응답 `status`는 세 갈래로 처리한다 — `SUCCESS`는 "예약이 완료되었습니다", `PROCESSING`은 동기 confirm이 타임아웃됐지만 백엔드 워커가 백그라운드에서 예약을 이어 처리해 보통 성공하므로 실패가 아닌 진행 중("백그라운드에서 처리 중") 으로 안내하고 좌석 상태를 재조회하며, 그 외(`FAILED_RACE`·`TIMEOUT`·`FAILED_AUTH`·`FAILED_UPSTREAM`)는 "예약 실패" 메시지로 안내한다.
- `WaitStatusCard`: 활성 대기 intent가 있으면 상태, 시도 횟수, 만료 시간, 취소 버튼을 대시보드에 표시한다.

### 선택 이유와 기각안

- 선택: 기존 `fetchJson` + React Query 패턴을 그대로 사용한다. API envelope, 쿠키 포함 요청, 캐시 무효화 방식이 이미 좌석/대출 카드와 맞기 때문에 새 client 계층을 만들 필요가 없다.
- 기각: 추천 카드에서 바로 예약 POST를 호출하는 방식은 실수 클릭과 좌석 경합 시 사용자 설명이 약하다.
- 기각: 챗봇 전용 예약 UX는 flagship agent 서사에는 좋지만, 포트폴리오 화면에서 실제 운영 기능을 즉시 증명하기 어렵다.

### human-approval 의미

예약은 `prepare -> confirm` 2단계로 나눈다. `prepare`는 서버가 실행할 액션을 요약하고 짧은 만료 시간을 부여하며, `confirm`은 사용자가 화면에서 명시적으로 승인한 뒤에만 실행된다.
이 구조는 실수 예약을 줄이고, 면접에서 "민감한 write action은 사용자 승인 후 실행한다"는 설계를 코드와 화면으로 설명할 수 있게 한다.

> 현재 구현 범위 문서. 기준일: 2026-06-06. 장기 방향은
> [vision.md](vision.md), 서버 도구 계약은
> [ssuMCP MCP tools](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/mcp-tools.md)를 따른다.

## 1. 제품 구성

ssuAI는 숭실대학교 데이터를 한 화면과 챗봇에서 조회하는 웹 애플리케이션이다.
런타임은 두 저장소로 분리되어 있다.

| 저장소 | 책임 | 주요 위치 |
| --- | --- | --- |
| `ssuAI` | Next.js 웹 UI, 인증 UX, 챗봇 화면, 제품 문서 | `app/`, `components/`, `hooks/`, `lib/`, `docs/` |
| `ssuMCP` | REST API, MCP Streamable HTTP 서버, 학교 시스템 커넥터, 배포 | `src/`, `docs/`, `deploy/` |

웹은 동일 origin `/api/*`를 사용하고 Next rewrite가 ssuMCP로 요청을
전달한다. 외부 MCP 클라이언트는 `https://ssumcp.duckdns.org/mcp`에 직접
연결한다.

## 2. 현재 제공 범위

### 공개 조회

- 학생식당 오늘/날짜별 메뉴와 기숙사 주간 식단
- 캠퍼스 시설 검색
- 중앙도서관 소장 도서 검색
- 학교 공지사항 목록, 검색, 상세, 진행 중 공지, 학과/부서 공지

### 연동 후 조회

| Provider | 조회 기능 | 비고 |
| --- | --- | --- |
| `LIBRARY` | 중앙도서관 좌석 현황, 내 대출 현황 | 좌석도 운영 upstream이 토큰을 요구하므로 연동 필요 |
| `SAINT` | 시간표, 성적, 채플, 졸업요건, 장학금 | SmartID 기반 연동 |
| `LMS` | 과제 및 퀴즈 목록 | LMS 세션 연동 |

### 사용자 표면

- 대시보드 카드에서 공개 데이터와 연동 데이터를 조회한다.
- `/chat`에서 같은 데이터 범위에 대해 자연어로 질문한다.
- ssuMCP는 현재 52개 MCP 도구를 Streamable HTTP `/mcp`로 노출한다.
- 외부 MCP 개인 도구는 `start_auth`로 발급받은 `mcp_session_id`와 provider
  연동이 있어야 한다.
- 도서관 좌석 예약/이석/반납 backend MCP action은 배포되어 있다. 웹 대시보드
  전용 예약 UX(`SeatRecommendationPanel` + `ReservationConfirmModal` + `WaitStatusCard`)도 2026-06-06 PR #189로 shipped.

## 3. 신뢰 경계

- 도서관 좌석과 대출은 `LIBRARY` 세션이 있는 호출만 실데이터를 조회한다.
  인증된 응답을 익명 호출이 캐시로 재사용하지 않도록 서버가 인증 경계를
  분리한다.
- 시간표, 성적, LMS 과제 같은 개인 데이터는 로그에 원문을 남기지 않으며,
  챗봇에서 개인 도구 결과를 다루는 턴과 이후 히스토리는 private LLM
  provider 정책으로 처리한다.
- 비밀번호, upstream 쿠키, 토큰, `mcp_session_id`, JWT, API key는 저장소나
  로그에 기록하지 않는다.
- 상태를 바꾸는 도서관 좌석 예약/이석/반납은 `prepare_*` + `confirm_action`
  2단계 확인으로만 실행한다. 웹 대시보드도 이 2단계 확인 UX(추천 좌석 →
  `ReservationConfirmModal` 확정)를 제공하며, 확인 없이 한 번에 실행하는
  표면은 제공하지 않는다.

## 4. 후속 범위

도서관 좌석 예약은 backend MCP write tool + 웹 확인 UX(추천 좌석 → 확정 모달 →
SUCCESS/PROCESSING/실패 분기) + 실시간 대기 SSE까지 구현·배포했고 실계정으로
검증했다. 남은 것은 현장 체크인 상태에서만 재현 가능한 일부 엣지 경로(이석·취소,
운영시간 외 예약)의 E2E 재검증이다.

다음 항목은 아직 shipped 기능으로 표현하지 않는다.

- 웹 대시보드/챗봇 UI에서 버튼으로 수행하는 도서관 좌석 자동 예약 또는 취소
- 수강신청 같은 학교 상태 변경
- 자동 LMS 제출
- 모바일 앱과 알림 전달

## 5. 검증 기준

프론트엔드 변경은 저장소 루트에서 `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`로 검증한다. 서버 계약 변경은 ssuMCP에서
`.\gradlew.bat test`로 검증하고, 라이브 동작은 배포 후 health endpoint와
MCP Inspector로 별도 확인한다.

## 6. 문서 관리

프론트엔드 설계 결정은 `docs/adr/`에, 장기 방향은 `docs/vision.md`에 기록한다.
서버 구현 계약·운영 자료의 기준은 ssuMCP 저장소(`../ssuMCP/docs/`)다.
현재 범위 판단은 이 문서와 서버의 활성 문서를 우선한다.
