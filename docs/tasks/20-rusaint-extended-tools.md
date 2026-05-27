# Task 20 — rusaint 확장 3도구 (채플·졸업요건·장학금)

> Created 2026-05-23. rusaint FFI에 이미 바인딩된 chapel/graduation_requirements/scholarships
> 모듈을 Java 서비스 레이어까지 연결해 MCP 도구 3개 추가.

## Status

- 🔲 Pending

## 1. Goal / Scope / Non-goals

### Goal

u-SAINT의 채플·졸업요건·장학금 데이터를 MCP 도구로 노출.
`rusaint_ffi.kt`에 `ChapelApplication`, `GraduationRequirementsApplication`,
`ScholarshipsApplication`이 이미 바인딩되어 있으므로 **네이티브 라이브러리 재빌드 없이**
Java 레이어만 추가.

### In scope

- `get_my_chapel_info` — 채플 이수 현황 (출결 이력 포함)
- `check_graduation_requirements` — 졸업 요건 충족 여부 + 항목별 잔여 학점
- `get_my_scholarships` — 내가 수혜받은 장학금 이력

### Non-goals

- 채플 결석 신청
- 실제 졸업 신청 처리
- 장학금 신청 / 기준 정보 크롤링 (내가 받은 이력만)

## 2. 확장 패턴

기존 grades/schedule과 완전히 동일한 패턴을 따른다.

```
RusaintClient.fetchChapelInfo()         → RusaintChapelConnector    → SaintChapelService    → MCP tool
RusaintClient.fetchGraduationReqs()     → RusaintGraduationConnector → SaintGraduationService → MCP tool
RusaintClient.fetchScholarships()       → RusaintScholarshipConnector → SaintScholarshipService → MCP tool
```

## 3. 패키지 레이아웃

```
domain/saint/
  connector/
    SaintChapelConnector.java            ← interface
    RusaintChapelConnector.java          ← @ConditionalOnProperty("rusaint")
    MockSaintChapelConnector.java        ← @ConditionalOnProperty("mock")
    SaintGraduationConnector.java        ← interface
    RusaintGraduationConnector.java
    MockSaintGraduationConnector.java
    SaintScholarshipConnector.java       ← interface
    RusaintScholarshipConnector.java
    MockSaintScholarshipConnector.java
  service/
    SaintChapelService.java
    SaintGraduationService.java
    SaintScholarshipService.java
  dto/
    ChapelInfo.java                      ← record
    ChapelAttendanceEntry.java           ← record
    GraduationStatus.java                ← record
    GraduationRequirementItem.java       ← record
    ScholarshipEntry.java                ← record

domain/mcp/tool/
  SaintExtendedMcpTools.java             ← 3개 도구 한 클래스
```

## 4. RusaintClient 인터페이스 추가

기존 `RusaintClient.java`에 3개 메서드 추가:

```java
ChapelInfo             fetchChapelInfo(String studentId, String sessionJson);
GraduationStatus       fetchGraduationRequirements(String studentId, String sessionJson);
List<ScholarshipEntry> fetchScholarships(String studentId, String sessionJson);
```

## 5. DTO 상세

### ChapelInfo

```java
record ChapelInfo(
    int year,
    String semester,
    String chapelTime,
    String chapelRoom,
    int absenceAllowedMinutes,
    int absenceUsedMinutes,
    String result,                           // "진행중" | "이수" | "미이수"
    List<ChapelAttendanceEntry> attendances
)

record ChapelAttendanceEntry(
    String date,
    String title,
    String instructor,
    String status                            // "출석" | "결석" | "공결"
)
```

`rusaint_ffi.kt` 소스:
- `ChapelInformation` → `ChapelInfo`
- `GeneralChapelInformation.absenceTime` → `absenceUsedMinutes`
- `ChapelAttendance` → `ChapelAttendanceEntry`

### GraduationStatus

```java
record GraduationStatus(
    boolean isGraduatable,
    String studentName,
    String department,
    int grade,
    float completedPoints,
    float graduationPoints,
    List<GraduationRequirementItem> requirements
)

record GraduationRequirementItem(
    String name,
    String category,
    float required,
    float completed,
    float remaining,
    boolean satisfied
)
```

`rusaint_ffi.kt` 소스:
- `GraduationStudent` → 상단 필드 (name, department, grade, completedPoints, graduationPoints)
- `GraduationRequirements.isGraduatable` → `isGraduatable`
- `GraduationRequirement` → `GraduationRequirementItem`
  - `requirement` → `required` (null 이면 0f)
  - `calculation` → `completed` (null 이면 0f)
  - `difference` → `remaining` (null 이면 0f)
  - `result` → `satisfied`

### ScholarshipEntry

```java
record ScholarshipEntry(
    int year,
    String semester,
    String name,
    long receivedAmount,
    String receiveType,
    String status
)
```

`rusaint_ffi.kt` 소스: `Scholarship` 필드 직접 대응.

## 6. MCP 도구 3개 명세

| 도구 | 파라미터 | 인증 | 설명 |
|------|---------|------|------|
| `get_my_chapel_info` | `year?:int`, `semester?:string` | mcp_session_id | 채플 이수 현황. 기본값: u-SAINT 현재 학기 |
| `check_graduation_requirements` | — | mcp_session_id | 졸업 가능 여부 + 요건별 충족 현황 |
| `get_my_scholarships` | `year?:int` | mcp_session_id | 장학금 수혜 이력. 기본값: 전체 |

모두 기존 grades/schedule과 동일하게:
1. `SaintToolContext`에서 `PortalCookies` 조회
2. 세션 만료 시 `SaintSessionExpiredException` → MCP 오류 메시지 반환
3. `McpServerConfig`의 `toolObjects(...)` 에 `SaintExtendedMcpTools` 등록 필수

## 7. application.yml 추가

```yaml
ssuai:
  connector:
    saint-chapel: rusaint       # rusaint | mock
    saint-graduation: rusaint   # rusaint | mock
    saint-scholarship: rusaint  # rusaint | mock
```

## 8. REST 엔드포인트

| Method | Path | 파라미터 |
|--------|------|---------|
| GET | `/api/saint/chapel` | year?, semester? |
| GET | `/api/saint/graduation` | — |
| GET | `/api/saint/scholarships` | year? |

모두 JWT 인증 필요 (기존 SaintGradesController 패턴 참고).

## 9. 예외 처리

기존 `RusaintClientException` → `SaintSessionExpiredException` 패턴 그대로.
새 예외 클래스 없음.

## 10. 테스트 계획

### 단위 테스트
- `MockSaintChapelConnector` — 픽스처 반환 검증
- `MockSaintGraduationConnector` — `isGraduatable` 분기 검증
- `MockSaintScholarshipConnector` — 빈 리스트 / 다건 반환 검증

### 커넥터 통합 테스트
- `RusaintChapelConnector` / `RusaintGraduationConnector` / `RusaintScholarshipConnector`
- 실제 rusaint 호출 (테스트 계정 필요 시 `@Disabled` 처리)

### MCP 스모크 테스트
- `SaintExtendedMcpTools` 각 도구가 Service 올바르게 호출하는지 (Service mock)

## 11. PR 전략 (커밋 3단계)

1. `feat(saint): add chapel/graduation/scholarship DTOs and connector interfaces`
2. `feat(saint): add rusaint connectors and services for chapel, graduation, scholarships`
3. `feat(mcp): add get_my_chapel_info, check_graduation_requirements, get_my_scholarships tools`
