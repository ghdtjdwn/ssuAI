# ssuAI Vision

> 2026-07-02에 작성한 장기 제품 방향의 역사 기록이다. 남은 항목을 현재 backlog로 해석하지 않는다.
> 현재 배포된 기능은 [product.md](product.md)에, MCP/보안 구현 계약은
> [ssuMCP 문서](https://github.com/ghdtjdwn/ssuMCP/tree/main/docs)에 기록한다.
> 기준일: 2026-07-02.

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
| 4. Confirmed actions | 예약/취소처럼 학교 상태를 바꾸는 안전한 실행 | 제공 중 — prepare/confirm과 HITL 승인 UX |

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

현재 backend MCP에는 좌석 추천, 예약 준비, 이석 준비, 반납 준비, 현재 좌석 조회,
`confirm_action`이 배포되어 있다. 제품 전체 완성을 위한 목표 사용 흐름은 다음과 같다.

```text
사용자: "지금 도서관 5층에 자리 있어?"
시스템: LIBRARY 연동 세션으로 좌석 현황 조회 후 가능한 구역 안내
사용자: "그 자리 예약해줘"
시스템: 예약할 좌석/이용 시간을 명확히 보여주고 확인 요청
사용자: "확인"
시스템: 확인된 단일 작업만 실행하고 결과 또는 경쟁 실패를 안내
```

제품 관점에서 예약 에이전트를 완성하기 위한 필수 조건:

1. 운영 MCP endpoint에서 실제 계정으로 reserve -> current -> swap -> cancel E2E 검증
2. 좌석 단위 live availability 파싱으로 추천 정확도 개선
3. 웹 대시보드/챗봇에서 명시 확인 UX 제공
4. 동일 예약의 중복 실행 방지와 동시성 처리 검증
5. 사용자 식별 정보와 토큰을 노출하지 않는 감사 기록
6. 실패, 세션 만료, 이미 점유된 좌석의 명확한 사용자 안내

자동 제출이나 수강신청 같은 더 큰 위험의 행동은 이 단계에도 포함하지 않는다.

## 6. 단계별 로드맵

| Phase | 범위 | 상태 |
| --- | --- | --- |
| 1 | 식단·시설·공지 조회, 웹 대시보드와 챗봇 | 완료 |
| 2 | 도서 검색 및 도서관 좌석 조회 | 완료 |
| 3 | SAINT/LMS/LIBRARY 인증과 개인 MCP 도구 | 완료 |
| 4 | 도서관 좌석 예약 action infrastructure 및 confirmation UX | 완료 (일부 엣지 경로 E2E는 현장 재검증 잔여) |
| 5 | LMS 동영상 다운로드·오디오 추출·자막 추출·STT | 범위 제외 — 사용자 결정 |
| 6 | 일일 브리핑 — 연동 데이터 종합 기반 오늘의 할 일·추천 계획 | 출시 — 연동 데이터만 사용하는 규칙 기반 브리핑·우선 행동 제안. 개인 학사 데이터를 LLM에 보내는 생성형 계획은 별도 동의·정책 결정 전 미도입 |
| 7 | 알림, 모바일 표면, 추가 안전한 자동화 | 모바일 웹 표면 출시(반응형 UI·하단 탭). 전달 채널(웹 푸시·이메일 등)과 추가 write automation은 제품 동의/운영 정책 미정 |
| 8 | 운영 안정성 강화 — Circuit Breaker·Rate Limiting·IP 차단 대비 | 대부분 완료 — 백엔드에 Resilience4j CB·rate limit 운영 중, `/admin`에서 상태 조회 가능 (§6-3 현황 참고) |
| 9 | 시스템 검증 및 성능 최적화 — 부하 테스트·병목 진단·최적화 | 부분 진행 — k6 부하 테스트·관측성 3종(Prometheus·Tempo·Loki)은 라이브, 나머지는 §6-2 현황 참고 |

## 6-1. AI 일일 브리핑

### 개요

연동된 개인 데이터를 애플리케이션 내부 규칙으로 종합해 두 가지 결과물을 생성한다. 개인 학사
데이터를 외부 LLM에 전달하는 생성형 계획은 별도 동의와 정책 결정 전에는 사용하지 않는다.

- **지금 당장 해야할 일** — 마감 임박 과제·퀴즈, 결석 위기 채플, 오늘 수업 전 준비 사항 등 긴급도 기준으로 정렬한 액션 리스트.
- **추천하는 오늘의 계획** — 오늘 시간표와 마감을 고려해 정해진 우선순위 규칙으로 제안하는 행동 순서.

### 사용할 데이터 소스

| 데이터 | 연동 | 활용 방식 |
| --- | --- | --- |
| 오늘 시간표 | SAINT | 수업 시간·강의실 반영 |
| 과제·퀴즈 목록 | LMS | 마감일 기준 긴급도 계산 |
| 채플 출석 현황 | SAINT | 결석 가능 횟수 잔여량 체크 |
| 졸업요건 진척도 | SAINT | 이번 학기 이수 필요 과목 확인 |
| 장학금 수혜 내역 | SAINT | 유지 학점 위험 경고 (선택) |

### 사용자 표면

- 대시보드에 "오늘의 브리핑" 카드로 노출.
- 로그인 후 또는 `/chat` 진입 시 자동으로 요약 제공 (선택 옵션).
- 챗봇에서 "오늘 뭐 해야 해?"로 직접 질문 가능.

### 구현 시 필수 조건

1. 모든 데이터 소스는 이미 연동된 경우에만 반영한다. 미연동 소스는 조용히 생략한다.
2. 브리핑 계산은 애플리케이션 내부 규칙으로 수행하며 개인 학사 데이터를 외부 LLM에 전달하지 않는다.
3. 생성된 계획은 제안이지 확정 action이 아니다 — 예약·제출 같은 write는 별도 확인 없이 실행하지 않는다.
4. 데이터가 부족하거나 연동이 없으면 "연동 후 더 정확한 브리핑을 제공합니다" 안내를 표시한다.

---

## 6-2. 시스템 검증 및 성능 최적화 (최종 단계)

모든 기능(Phase 1–7)이 완성된 후 마지막으로 수행한다. 미완성 코드에서 성능 최적화를 하면 기능 추가 시 다시 무너지기 때문이다.

> **현황 (2026-07-02)**: 이 섹션의 상당 부분은 ssuMCP 백엔드에서 이미 라이브다 — 관측성 3종(Prometheus 메트릭 + Tempo 트레이스 + Loki 로그, Grafana RED 대시보드), k6 부하 테스트 1차 측정, prod PostgreSQL 전환. 남은 것은 knee-point 재측정 등 추가 비교 측정이다. 현재 구현 상태의 정본은 [ssuMCP docs](https://github.com/ghdtjdwn/ssuMCP/tree/main/docs)(architecture·ADR 0069·performance)를 따른다. 아래 본문은 계획 당시 기록으로 보존한다.

### 목표

"동작하는 시스템"을 "대규모 트래픽에서도 버티는 시스템"으로 검증하고, 그 과정을 포트폴리오 스토리로 만든다.

---

### 1단계 — 관찰 도구 구축 (Prometheus + Grafana)

ssuMCP에 이미 Spring Boot Actuator가 있다. 여기에 Micrometer → Prometheus → Grafana를 연결해 다음 지표를 실시간으로 대시보드로 본다.

- JVM 스레드 수 (platform thread vs virtual thread)
- HTTP 엔드포인트별 레이턴시 분포 (P50 / P95 / P99)
- Tomcat 스레드 풀 사용률
- GC pause time
- DB 커넥션 풀 사용률 (HikariCP)
- 외부 커넥터 호출 수 (cache hit/miss 비율)

이 단계 없이 부하 테스트를 하면 "느려졌다"는 것만 알고 원인을 모른다.

---

### 2단계 — 테스트 환경 격리

| 역할 | 위치 |
| --- | --- |
| 테스트 대상 서버 (ssuMCP) | 기존 Oracle Cloud ARM64 k3s 배포 |
| 부하 발생기 (k6) | 별도 클라우드 인스턴스 (AWS Free Tier 등) |

같은 컴퓨터에서 서버와 부하 발생기를 함께 실행하면 CPU·메모리를 나눠 쓰기 때문에 측정값이 오염된다. 물리적으로 분리하고 실제 네트워크를 거쳐 트래픽이 들어오도록 세팅한다.

---

### 3단계 — k6 점진적 부하 테스트 (Ramp-up)

```javascript
// k6 시나리오
export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 200 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
};
```

테스트할 시나리오:

| 시나리오 | 예상 병목 지점 |
| --- | --- |
| `GET /api/meals/today` (캐시 히트) | 안 터져야 정상. WeeklyMealCache 검증 |
| `POST /api/chat` (LLM 호출) | 200명 근처에서 LLM rate limit 충돌 가능 |
| `GET /api/library/seats` + auth | Tomcat 스레드 풀 고갈 가능 |
| MCP 도구 호출 (외부 클라이언트) | 세션 스토어 동시성 |

어느 VU 수에서 P95 레이턴시가 튀거나 에러율이 오르는지 Grafana로 정확한 임계점을 캡처한다.

---

### 4단계 — 최적화 (순서대로)

각 작업 후 k6를 다시 돌려서 수치를 비교한다.

**① Java 21 Virtual Threads 활성화**

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

설정 1줄. Tomcat 스레드 풀 고갈 문제를 구조적으로 해결한다. Platform thread(2MB)에서 virtual thread(2KB)로 전환해 I/O 대기 중 스레드를 점유하지 않는다. I/O 바운드 작업에서 3배 이상 개선이 측정된 사례가 있다.

**② H2 → PostgreSQL 전환 + HikariCP 튜닝**

H2 인메모리 DB는 동시 write에서 제한적이다. PostgreSQL로 전환 후 커넥션 풀 크기를 부하 테스트 결과 기반으로 조정한다. (prod는 이미 in-cluster PostgreSQL로 전환 완료 — [ssuMCP architecture](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/architecture.md) 참고.)

**③ `/api/chat` Rate Limiting 강화**

LLM 호출은 외부 API 의존이라 무한정 처리할 수 없다. 요청 수준에서 사용자별 rate limit을 추가해 LLM rate limit 충돌 시 서버 전체가 멈추는 것을 방어한다.

**④ Redis 세션 스토어 도입 (선택)**

`McpAuthSessionStore`, `SaintSessionStore`, `LibrarySessionStore`가 현재 인프로세스 LRU Map이다. Redis로 교체하면 멀티 인스턴스 배포가 가능해진다. 단일 인스턴스로 충분하면 건너뛴다.

---

### 5단계 — Cache Stampede 방어를 강점으로 문서화

ssuMCP는 `WeeklyMealCache`, `LibraryBookCache`, `SaintScheduleCache`, `LibrarySeatCache` 모두에 **single-flight 패턴**이 이미 구현되어 있다. 1000명이 동시에 캐시 미스를 만나도 외부 호출이 1회로 제한된다.

부하 테스트에서 이를 Grafana로 증명한다. "사후에 발견하고 고쳤다"가 아닌 "설계 단계에서 선제적으로 적용했고 부하 테스트로 검증했다"는 스토리가 된다.

---

### 최종 산출물

부하 테스트 전·후 수치를 한 표로 정리한다:

| 지표 | Before | After |
| --- | --- | --- |
| P95 레이턴시 (`/api/chat`) | - | - |
| P95 레이턴시 (`/api/meals/today`) | - | - |
| 최대 안정 동시 사용자 수 | - | - |
| 에러율 (500/504) | - | - |
| 캐시 미스 시 외부 호출 수 | - | 1회 (single-flight 검증) |

Grafana 대시보드 스크린샷 + k6 HTML 리포트를 함께 기록해 포트폴리오에 첨부한다.

---

## 6-3. 운영 안정성 강화 — Circuit Breaker·Rate Limiting·IP 차단 대비

> **현황 (2026-07-02)**: 아래 1·2·3은 ssuMCP 백엔드에 이미 구현·운영 중이다 — Resilience4j Circuit Breaker(커넥터·LLM provider별) + Grafana 패널, 커넥터 토큰 버킷·요청 rate limit, 그리고 프론트 `/admin` 페이지가 `/api/admin/resilience`로 CB 상태를 실시간 조회한다. 아래 본문은 계획 당시 기록으로 보존하며, 현재 상태의 정본은 ssuMCP docs를 따른다.

Phase 9 부하 테스트 전에 먼저 수행한다. 외부 학교 시스템에 대한 요청이 안정적으로 제어되지 않으면 부하 테스트 자체가 의미 없다.

### 배경: 현재 IP 차단 위험도

| 데이터 소스 | 요청 빈도 | 위험도 |
| --- | --- | --- |
| 학식 사이트 (soongguri.com) | 주 1회 (WeeklyMealCache) | 낮음 |
| 공지사항 (scatch.ssu.ac.kr) | 5분 TTL 캐시 | 낮음 |
| 도서관 좌석 (oasis.ssu.ac.kr) | 30초 TTL 캐시 | 중간 |
| u-SAINT / LMS | 사용자 SSO 세션, 1시간 TTL 캐시 | 낮음-중간 |

학식은 캐시 설계 덕분에 위험이 거의 없다. 가장 위험한 엔드포인트는 도서관 좌석(30초 TTL)이다.

---

### 1. Circuit Breaker 패턴 추가 (Resilience4j)

연속 오류 발생 시 해당 커넥터로의 요청을 자동 차단하고 일정 시간 후 재시도하는 패턴.

```
정상 → 오류 N회 연속 → Circuit OPEN (외부 요청 차단)
→ 일정 시간 후 1회 테스트 → 성공 시 Circuit CLOSE → 재개
```

`build.gradle`에 `spring-boot-starter-resilience4j` 추가 후 각 Real 커넥터에 `@CircuitBreaker` 어노테이션을 붙인다. Circuit이 열리면 Mock 커넥터 응답이나 캐시된 마지막 데이터를 반환하고, MCP 도구 응답에 "현재 학교 서버 연결이 불안정합니다" 메시지를 포함시킨다.

**포트폴리오 포인트**: "외부 의존 시스템 장애가 전체 서비스 장애로 전파되지 않도록 Circuit Breaker 패턴을 적용했다"는 설명이 가능해진다.

### 2. Rate Limiting (Token Bucket) 구현 확인

[ssuMCP architecture](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/architecture.md)에 "커넥터별 최대 1 req/sec 토큰 버킷 구현" 계획이 명시되어 있고, 실제로 구현·운영 중이다(특히 `RealLibrarySeatConnector`).

### 3. Exponential Backoff 추가

`ConnectorException` 발생 시 즉시 재시도하지 않고 간격을 늘린다: 1초 → 2초 → 4초 → 8초. 오류 상황에서 학교 서버를 반복적으로 때리지 않게 된다.

---

### 실제로 IP 차단됐을 때 대응 절차

**즉시 대응 (5분 내)**

1. Oracle Cloud 콘솔 → Networking → Reserved Public IPs → 기존 IP 해제
2. 새 공인 IP 발급
3. DuckDNS에서 `ssumcp.duckdns.org` → 새 IP로 업데이트
4. Kubernetes Service/Ingress 확인

**중기 대응**

- Circuit Breaker가 열린 상태이면 Mock 모드로 서비스 계속 가능
- 차단된 커넥터만 `ssuai.connector.<name>=mock`으로 전환해 나머지 기능 유지

**예방이 최선**: Circuit Breaker + Rate Limiting이 제대로 동작한다면 IP 차단 자체가 발생하기 어렵다. 서버가 요청을 자제하기 때문이다.

---

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
