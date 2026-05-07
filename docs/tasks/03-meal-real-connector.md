# Task 03 — Cafeteria Menu API: Real Jsoup Connector

> Hand-off spec for the implementer (Codex CLI). Read `docs/architecture.md`
> §5, §6, §9, §10 and `docs/security.md` §4, §10, §11 first. This task must
> not contradict them. Reply using the Required Output Format in `AGENTS.md`.

## Goal

Task 02에서 만든 mock 슬라이스 위에 **`RealMealConnector` (Jsoup 기반)**을
얹고, `application.yml` 의 `ssuai.connector.meal` 값으로 mock ↔ real 전환이
되도록 합니다. `MealConnector` 인터페이스는 변경하지 않습니다. 캐싱(Redis)은
Task 04로 분리합니다.

## Why this slice

- Connector 패턴(`docs/architecture.md` §5)을 처음으로 "real" 구현까지 닫는
  슬라이스. 인터페이스 + mock + real 세 piece가 한 곳에서 합쳐지면 이후
  도서관/좌석 connector가 같은 템플릿을 그대로 복사할 수 있습니다.
- 외부 사이트 호출의 모든 함정(타임아웃, User-Agent, 인코딩, 파싱 실패,
  rate-limit) 을 처음 만나는 곳이라 `ConnectorException` 계층과 그
  `GlobalExceptionHandler` 매핑을 함께 도입하기에 적기.
- 데이터는 여전히 "Public" 클래스 → 보안 영향이 작고 학습 비용이 낮습니다.

## Pre-requisites (developer가 본 task 시작 전에 명세에 채워둘 것)

Codex/Claude는 외부 사이트를 직접 분석할 수 없습니다. 다음 5개 변수가 모두
채워진 상태에서 Codex를 실행하세요. 하나라도 비어 있으면 Codex는 작업을
멈추고 flag합니다.

| Variable | 설명 | 값 |
|---|---|---|
| `MEAL_PAGE_URL` | 학생식당 메뉴 페이지 URL (단일/오늘 기준) | `TBD` |
| `MEAL_PAGE_FIXTURE` | 위 URL의 응답 HTML을 받아 PII redact 후 커밋한 경로. 권장: `backend/src/test/resources/fixtures/meal/today-success.html` | `TBD` |
| `MEAL_SELECTORS` | BREAKFAST / LUNCH / DINNER 각각의 CSS selector. 메뉴 텍스트 노드까지 도달하는 경로 | `TBD` |
| `MEAL_PAGE_ENCODING` | 응답 charset (예: `UTF-8`, `EUC-KR`) | `TBD` |
| `MEAL_PAGE_IS_STATIC` | 페이지가 SSR/정적인지 (`true`) 또는 JS 렌더링 필수인지 (`false`) | `TBD` |

`MEAL_PAGE_IS_STATIC=false` 면 본 Task는 폐기하고 Playwright 기반 변형 spec을
다시 씁니다 (Codex는 stop & flag).

`robots.txt` 확인은 명세 채우는 단계에서 사람이 수행: 학생식당 경로가
disallow면 stop & flag.

## Scope — in

1. `com.ssuai.global.exception` 에 connector 예외 계층 신설:
   - `ConnectorException` (RuntimeException) — base
   - `ConnectorTimeoutException`, `ConnectorUnavailableException`,
     `ConnectorParseException`
   - 각자 `ErrorCode` 상수 (`CONNECTOR_TIMEOUT`, `CONNECTOR_UNAVAILABLE`,
     `CONNECTOR_PARSE_ERROR`)
2. `GlobalExceptionHandler` 매핑 추가:
   - `ConnectorTimeoutException` → 504
   - `ConnectorUnavailableException` → 503
   - `ConnectorParseException` → 502
   - 위 셋 외 `ConnectorException` → 502
3. `RealMealConnector` (`backend/.../domain/meal/connector/RealMealConnector.java`):
   - `@Component` + `@ConditionalOnProperty(name="ssuai.connector.meal", havingValue="real")`
   - `Jsoup.connect(url)` 사용. 명시적으로 다음 설정:
     - `userAgent("ssuAI/0.1 (+akftjdwn@gmail.com)")`
     - `timeout(10_000)` (read)
     - `connectTimeout` 은 Jsoup 11+ 에서 `timeout()`이 connect+read 둘 다
       커버 — 같은 값 사용.
     - `header("Accept-Language", "ko-KR,ko;q=0.9")`
     - 인코딩이 `EUC-KR` 등이면 Jsoup 가 `Content-Type` 헤더로 자동 처리.
       헤더가 부정확할 가능성이 있으면 `parse(InputStream, charset, baseUri)`
       경로로 폴백.
   - 파싱: `MEAL_SELECTORS` 의 각 selector 로 elements 추출 → 텍스트 trim →
     빈 토큰 제거 → `MealItem(type, List.of(...))`.
   - 모든 끼니가 비어 있거나 selector 가 0개를 반환하면
     `ConnectorParseException`.
   - 네트워크 / Jsoup 예외는 다음과 같이 매핑:
     - `SocketTimeoutException` / `org.jsoup.HttpStatusException` 의 timeout →
       `ConnectorTimeoutException`
     - HTTP 5xx 또는 IOException → `ConnectorUnavailableException`
     - `Selector.SelectorParseException` 또는 모양 불일치 →
       `ConnectorParseException`
4. 단순 outbound rate-limit:
   - `RealMealConnector` 내부에 thread-safe `synchronized` 가드 또는
     `Semaphore` + `lastCallAt` 기반 sleep. 최소 호출 간격 **1초**
     (`security.md` §11).
   - 외부 라이브러리(Guava 등) 추가 금지. 8~15줄 정도면 충분.
5. `application.yml` 의 `ssuai.connector.meal` 주석 갱신:
   `# mock | real (real implemented in Task 03)`
6. `application-prod.yml` 신규:
   ```yaml
   ssuai:
     connector:
       meal: real
   ```
   (port / logging / DB 설정은 본 Task 범위 외 — meal connector 만 추가)
7. 테스트:
   - `RealMealConnectorParseTests` — 로컬 fixture HTML 을 `Jsoup.parse(File, charset)`
     로 직접 파싱 → 3끼 전부 non-empty, type 순서 확인.
   - `RealMealConnectorHttpTests` — `okhttp3.mockwebserver.MockWebServer`
     **또는** `WireMock` (둘 중 이미 starter 에 들어와 있는 것을 우선
     사용; 없으면 MockWebServer 의존성 추가 testImplementation).
     케이스: 200 + fixture body, 503 → `ConnectorUnavailableException`,
     소켓 타임아웃 → `ConnectorTimeoutException`.
   - 새 의존성 추가가 필요하면 그 사실과 좌표를 Work Summary 에 명시.

## Scope — out (do NOT write)

- Redis 캐싱 — Task 04.
- 날짜 query parameter (`?date=YYYY-MM-DD`) — 별도 task.
- 다중 식당/캠퍼스 선택.
- Connector 실패 시 mock fallback — Service 레이어가 결정할 사안. MVP는
  5xx 노출 그대로.
- MCP tool wrapping (`get_today_meal`).
- 다른 도메인 connector (library*, lms*, usaint*).
- Playwright. (`MEAL_PAGE_IS_STATIC=false` 면 stop & flag.)
- `MealConnector` 인터페이스 시그니처 변경.
- `MealService` / `MealController` 로직 변경. (real 로 바꿔도 service 는
  여전히 thin pass-through.)

If a requirement seems to need any of the above, stop and flag rather than
expanding scope.

## Files to create / modify

```
backend/src/main/java/com/ssuai/
├── domain/meal/connector/
│   └── RealMealConnector.java                 (NEW)
└── global/exception/
    ├── ConnectorException.java                (NEW)
    ├── ConnectorTimeoutException.java         (NEW)
    ├── ConnectorUnavailableException.java     (NEW)
    ├── ConnectorParseException.java           (NEW)
    ├── ErrorCode.java                         (MODIFIED — add 3 codes if absent)
    └── GlobalExceptionHandler.java            (MODIFIED — add 3+1 mappings)

backend/src/main/resources/
├── application.yml                            (MODIFIED — comment only)
└── application-prod.yml                       (NEW)

backend/src/test/java/com/ssuai/domain/meal/connector/
├── RealMealConnectorParseTests.java           (NEW)
└── RealMealConnectorHttpTests.java            (NEW)

backend/src/test/resources/fixtures/meal/
└── today-success.html                         (NEW — provided by developer per Pre-requisites)
```

## Contracts

### Endpoint
변경 없음. `GET /api/meals/today` → `ApiResponse<MealResponse>`.

### Error envelope (신규 케이스)

| Exception                       | HTTP | `error.code`             |
|---------------------------------|------|--------------------------|
| `ConnectorTimeoutException`     | 504  | `CONNECTOR_TIMEOUT`      |
| `ConnectorUnavailableException` | 503  | `CONNECTOR_UNAVAILABLE`  |
| `ConnectorParseException`       | 502  | `CONNECTOR_PARSE_ERROR`  |
| `ConnectorException` (base)     | 502  | `CONNECTOR_ERROR`        |

`error.message` 는 사용자에게 보여줘도 안전한 한국어 문구로 고정 — 내부 예외
메시지를 그대로 노출하지 않습니다 (`security.md` §4 / §9).

### Connector behavior

```java
@Component
@ConditionalOnProperty(name = "ssuai.connector.meal", havingValue = "real")
class RealMealConnector implements MealConnector {

    private static final String URL = "<MEAL_PAGE_URL>";
    private static final String UA = "ssuAI/0.1 (+akftjdwn@gmail.com)";
    private static final long MIN_INTERVAL_MS = 1_000L;

    @Override
    public MealResponse fetchMeal(LocalDate date) {
        // 1) rate-limit guard
        // 2) Jsoup.connect(URL).userAgent(UA).timeout(10_000).get()
        // 3) parse with MEAL_SELECTORS
        // 4) build MealResponse(date, [BREAKFAST, LUNCH, DINNER])
        // 5) on failure → throw appropriate ConnectorException
    }
}
```

- `MealConnector.fetchMeal(LocalDate)` 시그니처는 그대로지만 v1 real
  구현은 사이트가 항상 "오늘"만 노출한다고 가정하고 입력 `date`는 현재
  사용하지 않습니다. 응답 DTO 의 `date`는 입력 `date` 그대로 채웁니다 (mock
  과 동일한 계약).

## Configuration

`application.yml` — 주석만 수정:
```yaml
ssuai:
  connector:
    meal: mock # mock | real (real implemented in Task 03)
```

`application-prod.yml` — 신규:
```yaml
ssuai:
  connector:
    meal: real
```

`application-test.yml` 은 손대지 마세요 (mock 이 default 라 그대로 동작).

## Security checklist (per `security.md` §11 + §4)

- [ ] User-Agent 명시: `ssuAI/0.1 (+akftjdwn@gmail.com)`.
- [ ] Outbound interval ≥ 1초.
- [ ] read/connect timeout 명시 (10초).
- [ ] HTTP 응답 본문(전체 HTML)을 로그로 남기지 않음. 로그는 `connector=meal,
      status=ok|fail, http={code}, items={n}, ms={latency}` 형식으로만.
- [ ] Fixture HTML 에 학생 이름/학번/이메일 등 PII 없음 (커밋 전 수동 확인).
- [ ] `error.message` 에 내부 예외 메시지/스택트레이스 노출 금지.
- [ ] 새 production dependency 추가 시 명시 (테스트 dependency 는 OK).

## Test plan

- `RealMealConnectorParseTests` (no Spring, no network)
  - given 로컬 fixture HTML, `RealMealConnector` 의 파싱 메서드(테스트
    가시성을 위해 package-private 으로 분리 권장)에 직접 입력
  - then `MealResponse.meals` 사이즈 3, type 순서 정확, 각 menu non-empty.
- `RealMealConnectorHttpTests` (MockWebServer 또는 WireMock)
  - 200 + fixture body → 정상 파싱.
  - 503 응답 → `ConnectorUnavailableException`.
  - 응답 지연 > timeout → `ConnectorTimeoutException`.
  - 200 + 빈 HTML → `ConnectorParseException`.
- `MealServiceTests`, `MealControllerTests` 변경 불필요.
- 기존 `MockMealConnectorTests` 변경 불필요.

테스트는 모두 `test` 프로파일(=mock default) 에서 동작해야 하며, real
connector 인스턴스를 직접 생성해 검증합니다 (Spring context 경유 X).

## Acceptance Criteria

- `gradlew.bat test` 가 깨끗이 통과 (모든 신규/기존 테스트).
- `gradlew.bat bootRun` 기본 실행 시 여전히 mock 으로 응답
  (default profile = `dev`, default `ssuai.connector.meal` = `mock`).
- `gradlew.bat bootRun --args='--spring.profiles.active=prod'` 또는
  `SPRING_PROFILES_ACTIVE=prod gradlew.bat bootRun` 으로 실행 시
  real connector 가 활성화되고 `curl http://localhost:8080/api/meals/today`
  가 실제 사이트의 메뉴를 반환 (네트워크 도달 가능한 환경에서).
- 패키지 레이아웃은 `docs/architecture.md` §4 와 일치.
- 새 production dependency 없음 (Jsoup 는 새로 필요할 수 있음 — 본 Task
  에서 추가하면서 Work Summary 에 명시).

## Style / conventions

- **Java records / 생성자 주입 / Lombok 정책**은 Task 02 와 동일.
- **로깅**은 parameterized form 만. `security.md` §4 재확인.
- **package-private 우선** — `RealMealConnector` 도 외부 슬라이스에서 직접
  참조할 일 없으므로 `class RealMealConnector` (package-private) 권장.
- 파싱 헬퍼 메서드는 `static` + package-private 으로 분리해 단위 테스트가
  쉽도록.

## Hand-off checklist (the reviewer will check these)

- [ ] `MealConnector` 인터페이스 시그니처 변경 없음.
- [ ] `RealMealConnector` 가 `@ConditionalOnProperty(... havingValue="real")`
      만 가짐 (`matchIfMissing=true` 금지).
- [ ] `MockMealConnector` 와 `RealMealConnector` 가 동시에 active 되지
      않도록 두 `@ConditionalOnProperty` 가 상호 배타 (mock=matchIfMissing
      true / real=havingValue=real).
- [ ] `MealService` / `MealController` / DTO 미수정.
- [ ] HTTP 호출에 명시적 timeout + User-Agent.
- [ ] Outbound rate-limit (>=1초 간격) 구현.
- [ ] `ConnectorException` 4종 + `GlobalExceptionHandler` 매핑 4종 + `ErrorCode` 4종
      추가됐고, 응답 envelope 가 일관된 형태.
- [ ] `application-prod.yml` 신규.
- [ ] Fixture HTML 에 PII 없음.
- [ ] HTML 응답 본문 로그 미노출.
- [ ] 새 dependency (Jsoup / MockWebServer 등) 의 좌표가 Work Summary 에
      명시됐고 production vs test 구분이 명확.

## Verification commands (Windows, from `backend/`)

```
gradlew.bat test
gradlew.bat bootRun
```

다른 셸에서:

```
curl http://localhost:8080/api/meals/today
```

→ mock 응답 (Task 02 와 동일).

prod 모드 스모크 테스트 (네트워크 필요):

```
set SPRING_PROFILES_ACTIVE=prod
gradlew.bat bootRun
curl http://localhost:8080/api/meals/today
```

→ 실제 학생식당 메뉴.

## Commit guidance

권장 커밋 분할:
1. `feat(global): add ConnectorException hierarchy and GlobalExceptionHandler mappings`
2. `feat(meal): add RealMealConnector with Jsoup parsing and rate-limit`
3. `chore(config): add application-prod.yml and update connector comment`
4. `test(meal): add real connector parse + HTTP tests with fixture`

Squash on merge to `main` 가능.

## Out-of-band notes for the reviewer (Claude)

리뷰 시 특히 확인:

1. **Connector 경계** — `RealMealConnector` 가 `MealResponse` 외 어떤 Jsoup
   타입(`Document`, `Element`)도 반환하지 않는지. HTML 모양은 connector
   안에서 끝나야 함 (`architecture.md` §5).
2. **로그 누출** — 응답 HTML / URL 의 query string / 학생 메뉴 외 임의
   바디가 로그에 흘러나오지 않는지 (`security.md` §4).
3. **Rate-limit 동작** — 단순 구현이라도 thread-safe 한지 (실제 멀티
   요청에서 race 발생 가능성).
4. **Conditional 상호 배타** — mock/real 두 빈이 동시에 등록되어
   `NoUniqueBeanDefinitionException` 이 나지 않는지.
5. **인코딩** — `MEAL_PAGE_ENCODING` 가 `EUC-KR` 일 경우 Jsoup 의 자동
   감지에만 의존하지 않고 명시 처리됐는지.

Return at most 3 high-priority issues per the review style in `CLAUDE.md`.
