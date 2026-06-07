# ADR 0006 — 프론트엔드 MVP 스택

- **Status**: Accepted
- **Date**: 2026-05-07
- **Scope**: 저장소 루트 Next.js 애플리케이션 (`app/`, `components/`, `hooks/`, `lib/`)

## 맥락

Task 05에서 로컬 MVP용 첫 웹 대시보드를 추가한다. 프론트엔드는 기존 REST envelope을 end-to-end로 검증하고, 리뷰 가능한 수준으로 작게 유지하며, 프로덕션 배포 결정은 Task 06에 넘겨야 한다.

아키텍처 문서에 이미 Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query가 의도된 프론트엔드 형태로 명시되어 있다. 이 ADR은 그 스택을 MVP 구현 결정으로 공식화한다.

MCP 서버가 별도 저장소로 분리된 이후, 웹 애플리케이션은 기존 `frontend/` 워크스페이스에서 이 저장소 루트로 승격되었다.

## 결정

다음 스택을 사용한다:

- Next.js 15 App Router + TypeScript strict mode (이후 Next.js 16으로 업그레이드 — 현재 `next@16`)
- Tailwind CSS (스타일링)
- shadcn/ui copy-in 컴포넌트 (기본 컨트롤, 카드)
- TanStack Query v5 (서버 상태 관리, 리트라이, stale time, 카드 개별 로딩/에러 상태)
- Spring Boot 백엔드로의 직접 브라우저 fetch (dev 프로파일에서 `http://localhost:3000` CORS 허용)

프론트엔드는 env에서 `NEXT_PUBLIC_SSUAI_API_BASE`를 읽고, 타입 안전 API 클라이언트에서 백엔드의 `ApiResponse<T>` envelope을 언래핑한다.

## 결과

**장점**

- 대시보드가 미래의 웹·챗봇 표면이 의존하게 될 동일한 백엔드 계약을 사용한다.
- 각 카드가 독립적으로 실패·리트라이·`traceId` 표시를 처리해도 나머지 페이지에 영향을 주지 않는다.
- shadcn 컴포넌트가 저장소 안에 소스 코드로 존재하므로 나중에 설정하거나 교체할 UI 프레임워크 런타임이 없다.

**비용**

- Next.js는 로컬 전용 대시보드치고 일반 SPA보다 무겁다.
- 직접 fetch 방식은 개발 중 CORS를 드러나게 하므로, Task 06에서 프로덕션 CORS를 의도적으로 처리해야 한다.
- shadcn copy-in 컴포넌트는 프로젝트가 소유하는 소스 코드이므로, 향후 변경 시 일반적인 코드 리뷰가 필요하다.

## 검토한 대안

- **Vite SPA** — 작고 로컬 개발이 빠르지만, 아키텍처 결정과 어긋나며 라우팅·배포·서버/클라이언트 경계 결정을 미루게 된다.
- **SWR 대신 TanStack Query** — 단순 fetch에는 충분하지만, 공유 query key·재시도 정책·개인화 기능 추가 시 필요한 무효화 처리가 약하다.
- **MUI 또는 Chakra 대신 shadcn/ui** — 초기 조립이 빠르지만 무거운 런타임 디자인 시스템을 추가하고 포트폴리오 코드가 덜 명시적이 된다.
- **CORS 대신 Next.js rewrites** — 개발 중 브라우저 CORS를 숨기지만, Task 06에서 명시해야 할 프로덕션 정책도 함께 숨겨버린다.
