# ADR 0001 — `MealResponse` 에 `closures` 필드 추가

- **Status**: Accepted (이미 구현되어 머지됨 — `f54ba70`)
- **Date**: 2026-05-07
- **Scope**: `com.ssuai.domain.meal.dto.MealResponse`

## Context

Task 03 (`docs/tasks/03-meal-real-connector.md`) 의 §"Contracts" 는
`MealResponse(LocalDate date, List<MealItem> meals)` 만 정의했습니다.

실제 구현 시 `RealMealConnector` 가 어린이날 등 휴무 식당을 만났습니다.
이를 표현할 자리가 record 에 없었기 때문에 두 가지 선택이 있었습니다:

1. 휴무도 `MealItem.menu` 에 `["휴무"]` 식으로 끼워 넣기.
2. 별도 `closures: List<MealClosure>` 필드 추가.

옵션 1 은 클라이언트가 "메뉴인지 휴무 사유인지" 를 문자열 매칭으로 판별해야
해서 깨지기 쉽습니다. 옵션 2 를 선택했습니다.

## Decision

`MealResponse` 에 `closures: List<MealClosure>` 를 추가합니다.

```java
public record MealResponse(
        LocalDate date,
        List<MealItem> meals,
        List<MealClosure> closures
) {
    public MealResponse(LocalDate date, List<MealItem> meals) {
        this(date, meals, List.of());
    }
}
```

기존 `(date, meals)` 보조 생성자를 남겨, mock connector 와 단위 테스트의
호출부 변경을 최소화합니다.

`MealClosure(restaurant, reason)` 는 dto 패키지에 신규 record 로 추가.

## Consequences

**좋은 점**
- 클라이언트가 "휴무" 와 "정상 메뉴" 를 구조적으로 분리해서 받습니다.
- mock 응답은 여전히 `closures: []` 로 떨어져 호환 깨짐 없음.

**대가**
- Task 03 spec 의 `Contracts` 섹션과 실제 응답이 한 칸 다릅니다 — 본 ADR
  로 그 갭을 명시적으로 메웁니다.
- MCP tool wrapping 단계에서 tool schema 에도 `closures` 가 들어가야 함
  (`docs/mcp-tools.md` 갱신 필요 — Task 04 또는 별도 ticket).
- Service 레이어가 `closures` 를 어떻게 처리할지(병합·제외·집계) 는 본
  ADR 범위 외. P3 분해(connector 단일 식당 단위로 축소) 시 함께 정합니다.

## Alternatives considered

- **`MealItem.status: enum { OPEN, CLOSED }` 추가** — 끼니 단위로 휴무를
  표현할 수 있지만, "조식만 휴무" 같은 케이스가 현재 데이터에 없고 식당
  단위 휴무가 더 자연스러워 채택하지 않음.
- **HTTP 상태 코드로 표현** — 부분 휴무를 5xx 로 못 보냄. envelope 형식
  유지가 우선.
