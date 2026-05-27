# ssuAI Vision

> 장기 제품 방향 문서. 현재 배포된 기능은 [product.md](product.md)에,
> MCP/보안 구현 계약은
> [ssuMCP 문서](https://github.com/ghdtjdwn/ssuMCP/tree/main/docs)에 기록한다.
> 기준일: 2026-05-27.

## 1. 목표

ssuAI는 학생이 여러 학교 사이트를 찾아다니지 않고, 필요한 정보를 질문하거나
한 화면에서 확인하며, 충분한 통제 아래 반복적인 행동까지 맡길 수 있는
캠퍼스 도우미를 목표로 한다.

제품은 네 층으로 확장된다.

| Layer | 목적 | 현재 상태 |
| --- | --- | --- |
| 1. Public data | 식단, 시설, 공지, 도서 검색 | 제공 중 |
| 2. Linked personal data | 좌석/대출, SAINT, LMS 연동 조회 | 제공 중 |
| 3. Conversational use | 웹 챗봇과 MCP 클라이언트에서 같은 데이터 활용 | 제공 중 |
| 4. Confirmed actions | 예약/취소처럼 학교 상태를 바꾸는 안전한 실행 | 계획 중 |

## 2. 현재 아키텍처

```text
Student browser
    |
    v
ssuAI (Next.js, repository root)
  dashboard / chat / authentication UX
    |
    | REST via /api rewrite
    v
ssuMCP (Spring Boot)
  REST controllers + services + connectors
  MCP Streamable HTTP endpoint: /mcp
    |
    v
Meal / Library / Notice / u-SAINT / LMS upstream systems
```

외부 Claude Desktop, Cursor 등의 MCP client는 ssuMCP의 `/mcp`에 직접
연결한다. 개인 도구는 `mcp_session_id`와 `SAINT`, `LMS`, `LIBRARY`
provider 연동을 요구한다.

## 3. 현재 데이터 범위

### 공개 정보

- 학식과 기숙사 식단
- 교내 시설 검색
- 도서관 도서 검색
- 학교 및 학과/부서 공지

### 연동된 정보

- `LIBRARY`: 도서관 층별 좌석 현황, 본인 대출 현황
- `SAINT`: 시간표, 성적, 채플, 졸업요건, 장학금
- `LMS`: 과제와 퀴즈 목록

좌석 현황은 데이터 성격상 집계 정보이지만, 현재 실제 도서관 upstream이
`Pyxis-Auth-Token`을 요구한다. 따라서 제품 계약에서는 도서관 연동 기능으로
취급하며 익명 호출에 인증된 캐시를 노출하지 않는다.

## 4. 챗봇과 MCP

웹 챗봇은 사용자가 이미 연결한 웹 세션 컨텍스트로 개인 서비스에 접근한다.
개인 도구 결과가 포함된 답변과 이어지는 대화 히스토리는 private LLM
provider 정책으로 전송한다.
공개 조회는 MCP self-dogfood 경로를 활용하고, 외부 MCP client는
`start_auth(provider)`로 브라우저 로그인 URL을 얻은 뒤 동일
`mcp_session_id`로 개인 도구를 재호출한다.

현재 MCP 전송은 **Streamable HTTP** 단일 endpoint `/mcp`이다. 과거 SSE
경로에 대한 내용은 ADR과 dev log에서 역사적 맥락으로만 남는다.

## 5. Flagship: 도서관 좌석 예약 에이전트

현재 구현은 좌석 상태 조회와 도서관 연동까지이다. 목표 사용 흐름은 다음과
같다.

```text
사용자: "지금 도서관 5층에 자리 있어?"
시스템: LIBRARY 연동 세션으로 좌석 현황 조회 후 가능한 구역 안내
사용자: "그 자리 예약해줘"
시스템: 예약할 좌석/이용 시간을 명확히 보여주고 확인 요청
사용자: "확인"
시스템: 확인된 단일 작업만 실행하고 결과 또는 경쟁 실패를 안내
```

예약을 shipped 기능으로 만들기 위한 필수 조건:

1. 조회 tool과 별개인 write tool 계약
2. `prepare` 후 명시적인 `confirm`을 요구하는 2단계 실행
3. 동일 예약의 중복 실행 방지와 동시성 처리
4. 사용자 식별 정보와 토큰을 노출하지 않는 감사 기록
5. 실패, 세션 만료, 이미 점유된 좌석의 명확한 사용자 안내

자동 제출이나 수강신청 같은 더 큰 위험의 행동은 이 단계에도 포함하지 않는다.

## 6. 단계별 로드맵

| Phase | 범위 | 상태 |
| --- | --- | --- |
| 1 | 식단·시설·공지 조회, 웹 대시보드와 챗봇 | 완료 |
| 2 | 도서 검색 및 도서관 좌석 조회 | 완료 |
| 3 | SAINT/LMS/LIBRARY 인증과 개인 MCP 도구 | 완료 |
| 4 | 도서관 좌석 예약 action infrastructure 및 confirmation UX | 계획 중 |
| 5 | 알림, 모바일 표면, 추가 안전한 자동화 | 미정 |

## 7. 성공 기준

- 공개 질문은 로그인 없이 빠르고 일관된 응답을 제공한다.
- 개인 질문은 명확한 연동 UX 뒤에만 반환되며 비밀 값이 브라우저나 로그에
  노출되지 않는다.
- 외부 MCP client에서도 같은 provider 연결 규칙으로 동작한다.
- action 기능이 추가될 때 사용자는 실행 전후의 상태를 이해하고 취소 또는
  재시도 판단을 할 수 있다.

## 8. 관련 문서

- [현재 제품 범위](product.md)
- [문서 지도](README.md)
- [서버 도구 계약](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/mcp-tools.md)
- [서버 보안 정책](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/security.md)
- [서버 아키텍처](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/architecture.md)
