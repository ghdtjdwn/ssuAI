# Task 01 — Backend Skeleton

> Hand-off spec for the implementer (Codex CLI). Read
> `docs/architecture.md` and `docs/security.md` first — this task must not
> contradict them.

## Status

- ✅ Done — main 머지 완료

## Goal

Stand up the Spring Boot backend skeleton that every later feature will
build on. After this task is merged, a fresh clone should:

1. Build with `gradlew.bat test` (Windows) without errors.
2. Run with `gradlew.bat bootRun` and serve `/actuator/health`.
3. Have the global response envelope, exception handling, and package
   structure already wired so the cafeteria slice (Task 02) only needs to
   add a Controller / Service / Connector.

## Scope — in

1. Gradle project under `backend/` (Gradle wrapper committed).
2. Spring Boot 3.3.x application bootstrap (`SsuaiApplication`).
3. Package structure under `com.ssuai` (see `docs/architecture.md` §4).
4. `global.response` — `ApiResponse<T>`, `ErrorResponse`.
5. `global.exception` — `ApiException`, `ErrorCode`, `GlobalExceptionHandler`.
6. `application.yml` + `application-dev.yml` + `application-test.yml`
   profiles (no `prod` yaml yet — placeholder is fine).
7. `/actuator/health` reachable.
8. One trivial `HelloController` at `GET /api/hello` to prove the response
   envelope works end-to-end. **This will be deleted in Task 02.**
9. `.gitignore` covering `.env`, `.env.*`, `build/`, `.gradle/`, `.idea/`,
   `out/`, `*.log`.
10. `.env.example` (empty values) listing every env var from
    `docs/architecture.md` §8 that this task needs (none for the skeleton —
    file may exist with only comments).

## Scope — out (do NOT write)

- `domain.meal`, `domain.library`, `domain.chat`, `domain.mcp` code — those
  are later tasks.
- Any Connector, Service, Repository, or Entity.
- PostgreSQL / Redis configuration (no `spring-boot-starter-data-jpa`,
  no `spring-boot-starter-data-redis`). They land when a feature needs
  them.
- Spring Security, JWT, sessions.
- OpenAPI / springdoc.
- Frontend changes.
- Docker, CI workflows.

If a requirement here seems to need any of the above, stop and flag it for
review rather than expanding scope.

## Tech / dependency contract

- **Java 21**, toolchain pinned in `build.gradle` so the build works on
  any machine with the wrapper.
- **Spring Boot 3.3.x** (latest patch in that minor at task time).
- Starters: `spring-boot-starter-web`, `spring-boot-starter-validation`,
  `spring-boot-starter-actuator`.
- Test: `spring-boot-starter-test` (JUnit Jupiter, MockMvc).
- Build with the **Gradle wrapper** committed — `gradlew`, `gradlew.bat`,
  `gradle/wrapper/*` all in the repo.
- Single-module Gradle project under `backend/`. No multi-module setup
  yet.

## Files to create

```
backend/
├── .gitignore
├── .env.example
├── build.gradle
├── settings.gradle
├── gradlew
├── gradlew.bat
├── gradle/wrapper/gradle-wrapper.jar
├── gradle/wrapper/gradle-wrapper.properties
├── src/main/java/com/ssuai/SsuaiApplication.java
├── src/main/java/com/ssuai/global/response/ApiResponse.java
├── src/main/java/com/ssuai/global/response/ErrorResponse.java
├── src/main/java/com/ssuai/global/exception/ApiException.java
├── src/main/java/com/ssuai/global/exception/ErrorCode.java
├── src/main/java/com/ssuai/global/exception/GlobalExceptionHandler.java
├── src/main/java/com/ssuai/global/web/HelloController.java       (temporary)
├── src/main/resources/application.yml
├── src/main/resources/application-dev.yml
├── src/main/resources/application-test.yml
├── src/test/java/com/ssuai/SsuaiApplicationTests.java
└── src/test/java/com/ssuai/global/web/HelloControllerTests.java
```

(Empty `domain/` package directories may be created with a `.gitkeep` if
desired, but it's optional.)

## Contracts (these shapes must match exactly)

### `ApiResponse<T>`

JSON shape returned by every successful endpoint:

```json
{ "data": { "...": "..." }, "error": null, "traceId": "<id>" }
```

Java shape:

- `data` — the payload type `T` (nullable when error).
- `error` — `ErrorResponse` (nullable when success).
- `traceId` — `String`.

Provide static factories: `ApiResponse.success(T data)` and
`ApiResponse.error(ErrorResponse error)`. The `traceId` value is read from
`MDC.get("traceId")` if present, otherwise a freshly generated UUID
fallback.

### `ErrorResponse`

```json
{ "code": "VALIDATION_FAILED", "message": "name must not be blank" }
```

### `ErrorCode` (enum)

Initial values — extend in later tasks, do not rename:

- `VALIDATION_FAILED`
- `INTERNAL_ERROR`
- `CONNECTOR_TIMEOUT`         (defined now, used later)
- `CONNECTOR_UNAVAILABLE`     (defined now, used later)

Each enum constant carries a default HTTP status (`HttpStatus`) and a
default message. `ApiException` wraps an `ErrorCode` plus an optional
override message.

### `GlobalExceptionHandler` (`@RestControllerAdvice`)

Handles at least:

- `MethodArgumentNotValidException` → 400 + `VALIDATION_FAILED`, message
  composed from the first field error (`field + ": " + message`).
- `ApiException` → status from its `ErrorCode`, code from `ErrorCode.name()`.
- `Exception` (catch-all) → 500 + `INTERNAL_ERROR`, message
  `"Internal server error"` — **never** echo the exception message to the
  client (could leak internals). Log the exception server-side at ERROR.

All three return `ApiResponse.error(...)`.

### `HelloController` (temporary)

`GET /api/hello?name=...`

- `name` validated `@NotBlank @Size(max=50)`.
- 200: `ApiResponse.success({"greeting": "Hello, <name>"})`.
- Missing/blank/oversize `name` → 400 envelope via the handler above.

This controller exists only so the envelope and exception flow are
exercised end-to-end before any real domain code lands. **Task 02 deletes
it.**

## Configuration

`application.yml` (shared):

```yaml
spring:
  application:
    name: ssuai
  profiles:
    default: dev

management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      show-details: never
```

`application-dev.yml` and `application-test.yml`: include only what's
needed (port, log levels). No DB, no Redis yet. **No secrets** — even
placeholders use `${ENV_VAR}` form.

## Acceptance criteria

- `gradlew.bat test` passes from a clean checkout (no manual setup).
- `gradlew.bat bootRun` starts the app on port 8080.
- `GET /actuator/health` returns `200 {"status":"UP"}`.
- `GET /api/hello?name=World` returns 200 with the success envelope.
- `GET /api/hello?name=` returns 400 with the error envelope, code
  `VALIDATION_FAILED`.
- Forcing an internal failure (e.g., temporarily throwing inside the
  controller during local testing — do NOT commit this) returns 500 with
  `INTERNAL_ERROR` and the **server log** contains the stack trace, while
  the **HTTP response body** does not.
- The package layout matches `docs/architecture.md` §4 exactly. Empty
  domain packages are OK; misnamed packages are not.
- No secret values, real or fake, are committed anywhere.

## Test requirements

- `SsuaiApplicationTests` — `@SpringBootTest` smoke test that loads the
  context.
- `HelloControllerTests` — `@WebMvcTest(HelloController.class)` with at
  least:
  - success case — asserts response shape includes `data.greeting`,
    `error: null`, and a non-empty `traceId`.
  - validation failure case — asserts 400, `data: null`, and
    `error.code == "VALIDATION_FAILED"`.
- Tests run under the `test` profile and require **no network, no DB,
  no Redis**.

## Style / conventions

- Java records for immutable DTOs (`ApiResponse`, `ErrorResponse`) where
  reasonable.
- Constructor injection only — no `@Autowired` on fields.
- Lombok is allowed but not required. If used, only `@RequiredArgsConstructor`
  and `@Slf4j` — avoid `@Data` on DTOs (it leaks setters).
- Logging via `org.slf4j.Logger`. **Parameterized form only**
  (`log.info("name={}", name)`), never string concatenation. Re-read
  `docs/security.md` §4 before adding any log line.

## Hand-off checklist (the reviewer will check these)

- [ ] Java 21 toolchain declared in `build.gradle`.
- [ ] Spring Boot 3.3.x, only the four starters listed above.
- [ ] Gradle wrapper committed and works on Windows (`gradlew.bat`).
- [ ] Package layout matches `docs/architecture.md` §4.
- [ ] `ApiResponse` / `ErrorResponse` shape matches §6 of the same doc.
- [ ] `GlobalExceptionHandler` covers the three exception classes above.
- [ ] No DB / Redis / Security / OpenAPI starters added.
- [ ] `.gitignore` includes `.env`, `.env.*`, `build/`, `.gradle/`, `.idea/`.
- [ ] No real or placeholder secrets in any committed file.
- [ ] All log statements use parameterized form; no credentials, cookies,
      tokens, or full request bodies are logged.
- [ ] Two test classes pass; both run under the `test` profile.

## Verification commands (Windows, from `backend/`)

```
gradlew.bat test
gradlew.bat bootRun
```

Then in a second shell:

```
curl http://localhost:8080/actuator/health
curl "http://localhost:8080/api/hello?name=World"
curl "http://localhost:8080/api/hello?name="
```

Expected outputs:

- Health → `{"status":"UP"}`
- Hello (valid) → `{"data":{"greeting":"Hello, World"},"error":null,"traceId":"..."}`
- Hello (blank) → 400, `{"data":null,"error":{"code":"VALIDATION_FAILED",...},"traceId":"..."}`

## Commit guidance

Prefer a small number of focused commits, e.g.:

1. `chore(backend): bootstrap Spring Boot 3.3 skeleton with Gradle wrapper`
2. `feat(global): add ApiResponse envelope and ErrorCode enum`
3. `feat(global): add GlobalExceptionHandler with validation + fallback`
4. `feat(global): add temporary HelloController and slice tests`

Do **not** squash everything into a single "initial backend" commit — the
review is easier when the layers land separately.

## Out-of-band notes for the reviewer (Claude)

When reviewing this task, check specifically:

1. Does the response envelope match `architecture.md` §6 byte-for-byte?
   (Field names, null-vs-absent semantics, `traceId` source.)
2. Are there any premature additions — DB starters, Security, custom
   filters — that this task said NOT to include?
3. Is there a single log statement that violates `security.md` §4?
   (Even one is a blocker.)
4. Does the package structure exactly match `architecture.md` §4? Any
   drift here compounds in later tasks.

Return at most 3 high-priority issues per the review style in
`CLAUDE.md`.
