# ssuAI Product Document

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
- ssuMCP는 현재 42개 MCP 도구를 Streamable HTTP `/mcp`로 노출한다.
- 외부 MCP 개인 도구는 `start_auth`로 발급받은 `mcp_session_id`와 provider
  연동이 있어야 한다.
- 도서관 좌석 예약/이석/반납 backend MCP action은 배포되어 있다. 단, 웹 대시보드
  전용 예약 UX는 아직 shipped 제품 표면이 아니다.

## 3. 신뢰 경계

- 도서관 좌석과 대출은 `LIBRARY` 세션이 있는 호출만 실데이터를 조회한다.
  인증된 응답을 익명 호출이 캐시로 재사용하지 않도록 서버가 인증 경계를
  분리한다.
- 시간표, 성적, LMS 과제 같은 개인 데이터는 로그에 원문을 남기지 않으며,
  챗봇에서 개인 도구 결과를 다루는 턴과 이후 히스토리는 private LLM
  provider 정책으로 처리한다.
- 비밀번호, upstream 쿠키, 토큰, `mcp_session_id`, JWT, API key는 저장소나
  로그에 기록하지 않는다.
- 상태를 바꾸는 도서관 좌석 예약/이석/반납은 backend MCP에서만
  `prepare_*` + `confirm_action` 2단계로 제공한다. 프론트엔드 UI에서
  바로 실행하는 제품 표면은 아직 제공하지 않는다.

## 4. 후속 범위

가장 중요한 다음 제품 단계는 도서관 좌석 예약 에이전트를 웹 UX까지 완성하는 것이다.
backend MCP write tool은 배포됐으므로, 이제 실제 운영 E2E 검증과 프론트 확인 UX,
실패/경쟁 상태 안내를 완성해야 한다.

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

`docs/tasks/`와 `docs/dev-log.md`는 구현 과정의 역사 기록이다. 과거
`frontend/`와 `backend/` 경로 또는 이전 단계 상태는 당시 맥락으로 남긴다.
현재 범위 판단은 이 문서와 서버의 활성 문서를 우선한다.
