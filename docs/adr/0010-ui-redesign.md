# ADR 0010 — 전면 UI 리디자인: 디자인 토큰 + 5탭 IA + 커스터마이즈 홈 + 다크모드

- **Status**: Accepted (PR #210 merged 2026-07-02, `024009f`)
- **Date**: 2026-07-02
- **Scope**: ssuAI 전체 프레젠테이션 레이어. 데이터 훅·API 계약·인증 흐름·prepare→confirm 예약 계약은 변경 없음(단 하나의 실계약 버그 수정 제외, §5).

## 1. 배경

기존 UI는 MVP 단계의 "단일 대시보드에 카드 나열" 구조였다. 별도로 제작된 하이파이 디자인 핸드오프(`design_handoff_ssuai_redesign/` — HTML 프로토타입 + 픽셀 스크린샷 + 토큰 스펙)가 나오면서, 이를 기존 Next.js 스택 위에 재구현하는 리디자인을 수행했다. 핸드오프의 요구: 5개 목적지(홈·챗봇·학사·도서관·캠퍼스) 단일 디자인 시스템, 데스크톱(사이드바+멀티컬럼)/모바일(하단탭+단일컬럼) 반응형 분기, 시스템 추종 다크모드, 커스터마이즈 가능한 홈.

## 2. 검토한 대안

- **프로토타입 HTML을 그대로 이식**: 기각. 프로토타입은 인라인 스타일 + Material Symbols + 기기 프레임 기반의 데모 코드라 유지보수 불가, 기존 데이터 훅/테스트 자산과 단절된다.
- **CSS 오버라이드만으로 스킨 교체**: 기각. IA 자체가 단일 대시보드 → 5탭으로 바뀌므로 스타일 패치로는 레이아웃 분기·위젯 시스템·홈 편집기를 표현할 수 없다.
- **선택 — 토큰을 Tailwind 테마로 이관 + 화면 재구현**: 디자인 토큰(색·타이포·radius·shadow·모션)을 `tailwind.config.ts` + CSS 변수로 옮기고, 화면은 기존 훅을 그대로 소비하는 새 컴포넌트로 재구현. 기존 컴포넌트는 props/exports를 유지한 채 재스타일해 테스트 자산(73건)을 보존했다.

## 3. 결정 사항

1. **토큰 시스템**: 브랜드 스케일(숭실 블루 primary 50–800, 민트 accent)은 정적 hex, 표면·시맨틱 색은 CSS 변수(`:root`/`.dark`)로 이원화 — 다크모드가 클래스 하나로 전환되고, 컴포넌트는 `bg-surface`·`text-subtle` 같은 시맨틱 클래스만 사용한다. 타이포는 Pretendard Variable(본문) + JetBrains Mono(모든 숫자·시간·D-day — `font-mono`).
2. **라우팅**: 디자인의 5탭을 실제 App Router 라우트(`/`, `/chat`, `/academics`, `/library`, `/campus`)로 매핑. 프로토타입의 `activeTab` 클라이언트 상태 대신 URL이 상태가 되어 공유·북마크·뒤로가기가 자연스럽다. 기존 URL(`/`, `/chat`, `/auth/*`)은 그대로 유지.
3. **앱 셸**: `AppShell`이 데스크톱 246px 사이드바 + 상단바(연결 뱃지 N/3·테마 토글·아바타), 모바일 하단 탭바(터치 타깃 ≥44px)를 제공. `/auth/*`·`/mcp/auth/*`는 bare 렌더.
4. **다크모드**: `next-themes` class 전략, 시스템 추종 + 수동 토글. hydration mismatch는 `useSyncExternalStore` 기반 mounted 감지로 회피(eslint의 setState-in-effect 규칙과도 호환 — `setMounted(true)` 패턴은 이 규칙에 걸린다).
5. **홈 위젯 시스템**: 레지스트리(id·섹션·기본 on/span) 기반 13종 위젯. 위젯은 기존 대형 카드를 임베드하지 않고 **기존 훅을 직접 소비하는 컴팩트 컴포넌트**로 새로 작성 — 도메인 카드와 홈이 서로 독립적으로 진화할 수 있다. 사용자 구성(`order/on/span/briefingOn/density`)은 `localStorage(ssuai:home-layout:v1)`에 영속화하고, 레지스트리 대조 정규화(모르는 id 제거·신규 id 추가)로 스키마 진화에 대비했다. 학사일정 위젯은 프론트에 캘린더 API가 없어 **의도적으로 제외**(가짜 데이터 금지 원칙).
6. **정직한 데이터 표현**: 도서관 좌석 3-뷰(도넛 오버뷰/공간/전체)는 실제 API 입도에 맞춰 렌더 — prod 좌석 status는 좌석 단위 목록이 비어 있으므로(`RealLibrarySeatConnector`가 aggregate만 채움) dot 그리드는 `zone.seats`가 있을 때만 그리고, 없으면 집계 + 추천 패널 경로를 유지한다. 미연동 서비스의 위젯/카드는 연결 유도 상태를 렌더하며 어떤 경우에도 데이터를 지어내지 않는다.
7. **모션**: 상태 변화는 스프링(`cubic-bezier(.34,1.56,.64,1)`) — HITL 승인 체크(springPop), 토스트(toastIn), 바텀시트(sheetUp), 편집 패널(slideInRight), 스켈레톤(shimmer). `prefers-reduced-motion` 전면 존중.

## 4. 결과

- 73개 테스트 전부 그린(홈 레이아웃 영속화 신규 스위트 포함), lint/typecheck/build 클린, Vercel prod 5개 라우트 전부 200 확인.
- 기존 컴포넌트 API를 보존한 재스타일 덕에 도메인 테스트는 대부분 셀렉터 수정 없이 통과했다(변경은 스켈레톤 클래스명 등 최소).

## 5. 함께 수정한 실계약 버그 — 좌석 추천 응답 envelope 불일치

리디자인 중 발견: `getLibrarySeatRecommendations`가 응답을 **bare 배열 + 숫자 `externalSeatId`**로 타이핑하고 있었으나, 실제 웹 API(`GET /api/library/reservations/recommend`)는 `LibrarySeatRecommendationResponse` **envelope**(`{floor, floorLabel, …, recommendations: [...]}`)에 **문자열 `externalSeatId` + 구조화 `attributes` 객체**를 담아 반환한다. 그 결과 추천 패널이 `recommendations?.length`를 항상 falsy로 판정해 **조용히 "좌석 없음" 빈 상태만 렌더**하고 있었다(타입은 통과·테스트 mock도 배열이라 그린 — 침묵 회귀의 전형). 프론트 타입을 백엔드 record와 일치시키고, `prepare`에는 `Number(externalSeatId)`를 전달하도록 수정. 상세 기록은 ssuMCP 트러블슈팅 로그 참조.

> **후속 조치 (2026-07-02)**: 같은 유형의 침묵 회귀를 구조적으로 차단하기 위해 네트워크 경계에 런타임 스키마 검증을 추가했다. `fetchJsonParsed`(`lib/api/schema.ts`)가 `fetchJson`의 envelope 해제 결과를 zod 스키마로 검증하고, 불일치 시 요청 경로+필드별 이슈 요약을 담은 `ApiSchemaError`를 던져 React Query가 빈 UI 대신 에러 상태를 표면화한다(fail-loud). 적용 대상은 이미 사고가 났던 고위험 도서관 엔드포인트 3종(좌석 추천·예약 prepare·좌석 현황)이며, 스키마는 loose object로 정의해 백엔드의 additive 필드 추가에는 깨지지 않고, `z.ZodType<Interface>` 주석으로 TS 계약과의 드리프트를 컴파일 타임에 잡는다.

## 3 Core Interview Questions (예상 면접 질문)

### Q1. 디자인 토큰을 정적 Tailwind 값과 CSS 변수로 이원화한 이유는?
> 브랜드 스케일(primary 50–800)은 라이트/다크에서 동일한 절대값이므로 정적 hex로 두어 Tailwind의 정적 분석·퍼지에 유리하게 했고, 표면·텍스트·시맨틱 색은 테마에 따라 값이 바뀌므로 CSS 변수로 두어 `.dark` 클래스 하나로 전체가 전환되게 했습니다. 컴포넌트가 `dark:` 분기를 거의 쓰지 않게 되어 화면 코드가 테마 무지(theme-agnostic)해집니다.

### Q2. 프로토타입은 탭 상태(SPA)인데 실제 구현은 라우트로 나눈 이유는?
> URL이 곧 상태가 되면 공유·북마크·브라우저 히스토리·코드 스플리팅이 공짜로 따라옵니다. App Router에서 라우트 단위 번들 분리가 되므로 5탭 전체를 한 클라이언트 번들에 담는 것보다 초기 로드가 가볍고, 기존 `/`·`/chat` URL 하위호환도 자연스럽게 유지됩니다.

### Q3. 홈 위젯을 기존 카드 재사용이 아니라 새 컴팩트 컴포넌트로 만든 이유는?
> 대시보드 카드와 홈 위젯은 밀도·정보량·상호작용 목표가 다릅니다. 기존 카드를 강제로 축소하면 두 표면이 서로의 변경에 취약해집니다. 위젯이 "훅(데이터 계층)만 공유"하게 하면 도메인 화면과 홈이 독립적으로 진화하고, 데이터 페칭은 React Query 캐시로 자동 중복 제거됩니다.

### Q4. "정직한 데이터 표현" 원칙이 설계에 어떻게 반영됐나요?
> prod 좌석 API가 좌석 단위 데이터를 주지 않는데 디자인은 좌석 dot 그리드를 요구했습니다. 가짜 dot을 그리는 대신 데이터 입도를 코드로 확인해(`zone.seats` 유무) 있을 때만 그리드를 그리고, 없으면 실제 집계 + 기존 추천→prepare→confirm 예약 경로를 노출했습니다. 미연동 서비스도 mock 값 대신 연결 유도 상태를 렌더합니다. 화면이 백엔드의 실제 능력을 넘어서 약속하지 않도록 UI가 데이터 계약을 따라가게 한 것입니다.
