# Task 19 — 학교 공지사항 도메인 (Notice Domain)

> Created 2026-05-23. scatch.ssu.ac.kr 직접 스크래핑으로 학교 공지사항 6개
> MCP 도구 추가. 인증 불필요한 공개 데이터 — 가장 눈에 띄는 미완성 기능.

## Status

- ✅ Done — main 머지 완료 (PR #169, 2026-05-23)

## 1. Goal / Scope / Non-goals

### Goal

`scatch.ssu.ac.kr` (숭실대학교 공지사항 포털) 스크래핑으로 공지사항 도메인
신설. 학생이 "오늘 공지 뭐 있어?", "컴퓨터학부 공지 보여줘", "장학금 공지
찾아줘" 를 자연어로 물어볼 수 있게 된다.

### In scope

- `domain/notice/` 패키지 신설
  - `NoticeConnector` interface
  - `RealNoticeConnector` — jsoup HTML 스크래핑
  - `MockNoticeConnector` — 하드코딩 픽스처 3건
  - `NoticeConnectorProperties` — `@ConfigurationProperties`
  - `NoticeService`
  - `NoticeController` — REST 2개 엔드포인트
- `domain/mcp/tool/NoticeMcpTools.java` — 6개 MCP 도구
- `application.yml` 키 추가
- 단위 테스트 (Mock 커넥터) + 커넥터 통합 테스트 (MockWebServer HTML fixture)

### Non-goals

- ❌ 학과 전용 게시판(biz, ee, cs 개별 사이트) 스크래핑 — 이번 scope 아님.
  scatch.ssu.ac.kr 의 `등록부서` 컬럼 필터로 대체.
- ❌ 공지 구독/알림 — 이번 scope 아님.
- ❌ 글 작성/수정/삭제 — scatch 는 읽기 전용.
- ❌ 첨부파일 다운로드.

## 2. 6개 MCP 도구

| 도구 | 파라미터 | 설명 |
|------|---------|------|
| `get_recent_notices` | `category?`, `page?` | 최신 공지 목록. category 없으면 전체. |
| `search_notices` | `keyword`, `category?`, `page?` | 키워드 전문 검색 |
| `list_notice_categories` | — | 카테고리 열거 (학사·장학·국제교류 등) |
| `get_notice_detail` | `url` | 공지 본문 전체 텍스트 |
| `get_active_notices` | `category?` | 진행중(마감 전) 공지만 필터 |
| `get_department_notices` | `department`, `page?` | 특정 학과/부서 공지 (scatch 내 등록부서 필터) |

**카테고리 값 (scatch 공식):**
`전체`, `학사`, `장학`, `국제교류`, `외국인유학생`, `채용`, `비교과·행사`,
`교원채용`, `교직`, `봉사`, `기타`

## 3. 데이터 소스 & 스크래핑 방식

### URL 패턴

| 목적 | URL |
|------|-----|
| 전체 목록 p1 | `https://scatch.ssu.ac.kr/공지사항/?f&paged=1` |
| 카테고리 필터 | `https://scatch.ssu.ac.kr/공지사항/?f&category=장학&paged=1` |
| 키워드 검색 | `https://scatch.ssu.ac.kr/공지사항/?f&keyword=장학금&paged=1` |
| 학과 검색 | `https://scatch.ssu.ac.kr/공지사항/?f&keyword={dept}&paged=1` + 클라이언트 필터 |
| 공지 상세 | 목록 링크 그대로 (WordPress 포스트 URL) |

### 테이블 구조 (spike 확인 필요)

scatch 공지 목록은 `<table>` 기반:
- 컬럼: **작성일** | **상태(진행/완료)** | **제목(링크 포함)** | **등록부서** | **조회수**
- 상세 페이지: WordPress 본문 div에서 텍스트 추출

**Spike 단계**: `RealNoticeConnector` 구현 전, 실제 HTML 받아서
정확한 jsoup 셀렉터 확인 필수. 셀렉터가 틀리면 모든 파싱이 깨짐.

### `get_department_notices` 구현 전략

1. `?f&keyword={department}` 로 검색
2. 각 항목의 `등록부서` 텍스트에 `department` 포함 여부로 클라이언트 필터
3. 매칭 결과만 반환

## 4. 패키지 레이아웃

```
domain/notice/
  connector/
    NoticeConnector.java          ← interface
    RealNoticeConnector.java      ← @ConditionalOnProperty("real")
    MockNoticeConnector.java      ← @ConditionalOnProperty("mock")
    NoticeConnectorProperties.java
  service/
    NoticeService.java
  controller/
    NoticeController.java
  dto/
    Notice.java                   ← id, title, link, date, status, department, category
    NoticeCategory.java           ← slug, label
    NoticeListResponse.java       ← items, totalPages, currentPage
    NoticeCategoriesResponse.java ← categories
    NoticeDetailResponse.java     ← Notice + bodyText

domain/mcp/tool/
  NoticeMcpTools.java             ← 6개 도구 모두 한 클래스
```

## 5. DTO 상세

### `Notice.java`

```java
// id: scatch 내부 포스트 ID (URL slug or WP ID)
// title: 공지 제목
// link: 공지 URL (상세 페이지 링크)
// date: "2026.05.22" 형식 (scatch 원본 그대로)
// status: "진행" | "완료"
// department: 등록부서 (예: "컴퓨터학부", "장학팀")
// category: 카테고리 슬러그
```

### `NoticeDetailResponse.java`

`Notice` 필드 + `bodyText: String` (HTML strip 후 순수 텍스트).
bodyText 최대 4000자 잘라서 반환 (MCP context 낭비 방지).

## 6. application.yml 추가

```yaml
ssuai:
  connector:
    notice: real   # real | mock  (공개 사이트라 기본 real)
  notice:
    base-url: ${SSUAI_NOTICE_BASE_URL:https://scatch.ssu.ac.kr}
    cache-ttl: 5m
    timeout: 8s
    max-page-size: 20
```

## 7. REST 엔드포인트

| Method | Path | 파라미터 |
|--------|------|---------|
| GET | `/api/notices` | `category?`, `page?` (1-based), `size?` |
| GET | `/api/notices/search` | `keyword`, `category?`, `page?` |
| GET | `/api/notices/categories` | — |
| GET | `/api/notices/department` | `department`, `page?` |

## 8. 캐시 전략

기존 `WeeklyMealCache` / 라이브러리 좌석 캐시 패턴 참고.
- 키: `(category, page)` 또는 `(keyword, category, page)` 또는 `(department, page)`
- TTL: 5분 (`ssuai.notice.cache-ttl`)
- `list_notice_categories` 는 24h 캐시 (카테고리는 거의 안 바뀜)

## 9. 예외 처리

기존 `ConnectorUnavailableException`, `ConnectorTimeoutException`,
`ConnectorParseException` 재사용. 새 예외 클래스 없음.

## 10. 테스트 계획

### 단위 테스트
- `MockNoticeConnector` — 3개 픽스처 공지 반환 확인
- `NoticeService` — 커넥터 mock, 카테고리 필터/검색 로직

### 커넥터 통합 테스트 (MockWebServer)
- `src/test/resources/fixtures/notice/notice_list.html` — 실제 scatch HTML 스냅샷
- `RealNoticeConnector` 가 올바른 `Notice` 목록 파싱하는지 검증
- 파싱 실패 시 `ConnectorParseException` throw 확인

### MCP 도구 스모크 테스트
- 각 도구가 `NoticeService` 올바르게 호출하는지 (서비스 mock)

## 11. PR 전략

커밋 3단계 분리 권장:
1. `feat(notice): add notice DTOs and connector interface`
2. `feat(notice): add real/mock connector, service, controller`
3. `feat(notice): add 6 MCP notice tools`
