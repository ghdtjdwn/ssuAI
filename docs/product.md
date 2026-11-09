# ssuAI 제품 범위

> 현재 배포된 제품 표면과 신뢰 경계를 기록한다. 기준일: 2026-11-09. 장기 방향의 역사 기록은
> [vision.md](vision.md), 프론트엔드 런타임 경계는 [architecture.md](architecture.md), 서버 도구
> 계약은 [ssuMCP MCP tools](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/mcp-tools.md)를 따른다.

## 1. 제품 구성

ssuAI는 숭실대학교 공개 정보와 개인 학사·LMS·도서관 데이터를 한 화면과 챗봇에서 다루는 웹
애플리케이션이다. 런타임은 네 서비스로 나뉘며 이 저장소는 프론트엔드와 same-origin BFF 경계만
소유한다.

| 서비스 | 책임 | 저장소 |
| --- | --- | --- |
| ssuAI | Next.js 화면, 인증 UX, 챗봇 UI, `/api/*` rewrite와 `/api/agent/*` Route Handler | 현재 저장소 |
| ssuAgent | LangGraph 라우팅, 대화 상태, HITL 오케스트레이션 | [ghdtjdwn/ssuAgent](https://github.com/ghdtjdwn/ssuAgent) |
| ssuMCP | 캠퍼스 도메인 로직, REST/MCP 계약, 인증과 상태 변경 | [ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP) |
| ssu-ai-service | 격리된 임베딩 요청 게이트웨이 | [ghdtjdwn/ssu-ai-service](https://github.com/ghdtjdwn/ssu-ai-service) |

화면은 홈 `/`, 챗봇 `/chat`, 학사 `/academics`, 도서관 `/library`, 캠퍼스 `/campus` 다섯 라우트이며
데스크톱 사이드바와 모바일 하단 탭을 공유한다([ADR 0010](adr/0010-ui-redesign.md)). 홈은 14종 위젯의
순서·폭·표시 여부를 `localStorage`에 저장하는 커스터마이즈 그리드다(`components/home/widgets/registry.ts`).
`/admin`은 로그인한 관리자만 ssuMCP resilience 상태를 조회한다([ADR 0090](adr/0090-admin-resilience-auth.md)).

## 2. 현재 제공 범위

### 공개 조회

credential 없이 호출하는 경로다. 코드 기준은 `lib/api/*.ts`에서 `fetchPublicJson*`을 쓰는 함수와
`hooks/useLibrarySeatSse.ts`의 EventSource다.

- 학생식당 오늘·주간 메뉴, 기숙사 주간 식단 (`meal.ts`, `dorm.ts`)
- 캠퍼스 시설 검색 (`facility.ts`)
- 학교 공지사항 목록 (`notice.ts`)
- 학사일정 (`calendar.ts`)
- 중앙도서관 도서 검색, 층별 좌석 현황과 좌석 변경 SSE (`library.ts`, `useLibrarySeatSse.ts`)

### 연동 후 조회와 실행

| Provider | 기능 | 연동 방식 |
| --- | --- | --- |
| `SAINT` | 시간표, 성적, 채플, 졸업요건, 장학금 | SmartID SSO. callback의 1회용 code를 same-origin에서 교환한다([ADR 0089](adr/0089-sso-code-exchange.md)) |
| `LMS` | 과제 목록, 챗봇에서 강의자료 일괄 내보내기 | u-SAINT 로그인을 공유하는 LMS SSO(`/api/auth/lms/sso-init`) |
| `LIBRARY` | 내 대출 현황, 추천 좌석, 예약 `prepare → confirm`, 층 단위 대기 등록 | 도서관 계정 로그인. 도서관만 연결해도 MCP 채팅 세션을 발급한다([ADR 0088](adr/0088-library-only-mcp-session.md)) |

### 챗봇

`/chat`은 same-origin `/api/agent/{stream,resume}`를 통해 ssuAgent의 SSE를 받는다. 도메인
handoff, 도구 진행 상태, 스트리밍 답변을 표시하고, 좌석 예약이나 LMS 내보내기처럼 상태를 바꾸는
요청은 `prepare` 결과를 카드로 보여준 뒤 사용자가 승인해야 `resume/confirm`을 실행한다
([ADR 0001](adr/0001-agent-sse-chat-hitl.md)). 연결 상태 표시는 backend의 provider grant를 단일
근거로 삼는다([ADR 0099](adr/0099-authoritative-web-session-grants.md)).

## 3. 신뢰 경계

- 공개 GET/SSE만 backend origin을 직접 호출할 수 있고, 쿠키·Bearer·API key가 필요한 요청은 항상
  same-origin `/api/*`를 지난다([ADR 0087](adr/0087-public-direct-origin-sse.md)).
- access token은 메모리에, refresh token은 HttpOnly cookie에 둔다.
- `/api/agent/*` Route Handler는 브라우저가 보낸 `principal`을 제거하고 Bearer 검증 결과만 다시
  주입하며, server-only agent key와 HMAC 서명 identity를 더한다([ADR 0086](adr/0086-server-side-principal.md)).
- 상태를 바꾸는 작업은 `prepare → confirm` 2단계로만 실행한다. 확인 없이 한 번에 실행하는 표면은
  대시보드에도 챗봇에도 없다.
- 비밀번호, upstream 쿠키, 토큰, `mcp_session_id`, JWT, API key는 저장소나 로그에 기록하지 않는다.
  서버 측 정책의 기준 문서는 [ssuMCP security](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/security.md)다.

## 4. 제공하지 않는 것

- 사용자 승인 없이 실행되는 좌석 자동 예약·취소
- 수강신청처럼 학교 상태를 바꾸는 다른 작업
- 자동 LMS 제출
- 네이티브 앱과 푸시 알림 (반응형 웹 하나로 데스크톱과 모바일을 제공한다)

## 5. 검증 기준

프론트엔드 변경은 CI와 같은 순서로 `pnpm audit:dependencies`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, `pnpm test:e2e`를 통과해야 한다. 이 검증이 증명하는 범위와 한계는
[verification-boundary.md](verification-boundary.md)에 있다. 서버 계약 변경은 ssuMCP 저장소에서
검증한다.

## 6. 변경 이력

- 2026-07-02 — 전면 UI 리디자인: 디자인 토큰, 5탭 IA, 커스터마이즈 홈, 시스템 추종 다크모드
  ([ADR 0010](adr/0010-ui-redesign.md)). 데이터·인증·예약 계약은 바꾸지 않았고, 좌석 추천 응답
  envelope를 bare 배열로 타이핑하던 계약 버그를 함께 고쳤다.
- 2026-06-14 — ssuAgent SSE 챗봇과 HITL 승인 UI([ADR 0001](adr/0001-agent-sse-chat-hitl.md)).
- 2026-06 — 웹 대시보드 좌석 예약 UX: 추천 좌석 → `prepare` 요약과 만료 시간을 보여주는 확정 모달 →
  `confirm` 결과를 `SUCCESS`·`PROCESSING`(백그라운드 처리 중)·실패로 분기, 대기 등록 상태 카드.
