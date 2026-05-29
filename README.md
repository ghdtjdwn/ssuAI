# ssuAI — 숭실대학교 AI 웹 클라이언트

[![CI](https://github.com/hoeongj/ssuAI/actions/workflows/ci.yml/badge.svg)](https://github.com/hoeongj/ssuAI/actions/workflows/ci.yml)

숭실대학교 MCP 서버([ssuMCP](https://github.com/hoeongj/ssuMCP))를 소비하는 웹/앱 클라이언트.  
카드형 대시보드와 자연어 챗봇으로 공개 캠퍼스 정보와 개인 학사 정보를 조회하는 Next.js 애플리케이션이다.

**Flagship 목표 — 도서관 좌석 자동 예약 에이전트.**  
현재는 도서관 연동 후 좌석 현황과 대출 정보를 조회할 수 있으며,  
*"이 자리 예약해줘"*를 안전한 확인 절차와 함께 실행하는 기능은 후속 범위다.

---

## 라이브

| 항목 | URL |
|------|-----|
| 웹 챗봇 | <https://ssuai.vercel.app/chat> |
| 웹 대시보드 | <https://ssuai.vercel.app/> |

---

## 아키텍처

```
브라우저
   │  fetch /api/*  (same-origin)
   ▼
Next.js 서버 (Vercel)
   │  Next.js rewrite → NEXT_PUBLIC_SSUAI_API_BASE
   ▼
ssuMCP (Spring Boot, https://ssumcp.duckdns.org)
   │  REST API
   ▼
학교 시스템 (학식, 도서관, LMS, u-SAINT)
```

브라우저는 항상 같은 origin의 `/api/*`를 호출한다. Next.js rewrite가 실제 ssuMCP 서버로 요청을 투명하게 전달하므로, CORS 없이 API 키·세션도 노출되지 않는다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) + TypeScript 6 |
| 서버 상태 | TanStack Query v5 |
| UI | Tailwind CSS 3, shadcn/ui, Radix UI |
| 테스트 | Vitest 4, Testing Library (React) |
| 패키지 매니저 | pnpm |

---

## 현재 제공 기능

### 공개 조회

- 학생식당·기숙사 식단 (오늘/날짜별/주간)
- 교내 시설 검색
- 중앙도서관 소장 도서 검색
- 학교·학과 공지사항 목록, 검색, 상세, 진행 중 공지

### 연동 후 개인 조회

| 연동 | 기능 |
|------|------|
| SAINT (SmartID SSO) | 시간표, 성적, 채플 출석, 졸업요건, 장학금 |
| LMS (Canvas SSO) | 과제·퀴즈 목록 |
| 도서관 (세션 캡처) | 층별 좌석 현황, 본인 대출 현황 |

### 챗봇

대시보드와 동일한 데이터 범위에 대해 자연어로 질문할 수 있다.  
공개 질문은 로그인 없이 즉시 응답한다. 개인 데이터 질문은 연동 세션이 있는 경우에만 응답한다.

---

## 인증 흐름

ssuAI는 세 가지 인증 흐름을 처리한다.

```
1. SAINT (u-SAINT SmartID)
   로그인 버튼 → ssuMCP /api/auth/saint/sso → SmartID 리다이렉트
   → 콜백 → JWT 발급 (access: 메모리, refresh: HttpOnly 쿠키)

2. LMS (Canvas)
   로그인 버튼 → ssuMCP /api/auth/lms/sso → Canvas 리다이렉트
   → 콜백 → LMS 세션 연결

3. 도서관 (세션 캡처)
   /mcp/auth/library 페이지 → 도서관 자격증명 입력
   → ssuMCP가 도서관 API 토큰 확보 → 도서관 세션 연결
```

Access token은 메모리(`AuthContext`)에만 보관한다. localStorage/sessionStorage에 쓰지 않는다.  
`/api/auth/refresh`를 통해 HttpOnly 쿠키의 refresh token으로 access token을 재발급한다.

---

## 프로젝트 구조

```
app/              # Next.js App Router — 페이지, 레이아웃, 프로바이더
  auth/           # 인증 콜백 및 로그인 페이지
  chat/           # 챗봇 UI
  mcp/auth/       # 도서관 세션 캡처 UI
components/       # 기능별·공통 UI 컴포넌트
contexts/         # 클라이언트 인증 상태 (AuthContext)
hooks/            # TanStack Query 훅 (useSaintSchedule, useLibrarySeatStatus 등)
lib/
  api/            # 타입 안전 API 클라이언트 (fetchJson, ApiError)
  api/auth.ts     # 인증 API 호출
  api/client.ts   # 공통 fetch 래퍼 — 응답 envelope 파싱, 에러 처리
docs/             # 제품 문서, 아키텍처, 작업 기록, ADR
```

---

## 주요 설계 결정

**같은 origin 프록시**  
브라우저가 직접 ssuMCP를 호출하지 않고 Next.js를 통해 프록시한다.  
`next.config.ts`의 `rewrites`로 `/api/*`를 `NEXT_PUBLIC_SSUAI_API_BASE`로 전달한다.

**Access token 메모리 보관**  
XSS로 인한 토큰 탈취를 방지하기 위해 access token을 메모리(`AuthContext`)에만 보관한다.  
페이지 새로고침 시 `/api/auth/refresh`로 자동 재발급한다.

**TanStack Query**  
서버 상태 캐싱, 리트라이, 백그라운드 재검증을 TanStack Query에 위임한다.  
컴포넌트는 `useQuery`·`useMutation` 훅만 호출하고, 캐시 관리 코드를 직접 작성하지 않는다.

**응답 Envelope**  
ssuMCP의 모든 응답은 `{ data, error, traceId }` 형태다.  
`lib/api/client.ts`의 `fetchJson`이 envelope을 파싱하고, `error`가 있으면 `ApiError`를 throw한다.  
`traceId`는 에러 리포트 시 ssuMCP 로그와 대조하는 데 사용한다.

---

## 로컬 개발

```bash
cp .env.example .env.local
# .env.local에 NEXT_PUBLIC_SSUAI_API_BASE 설정
pnpm install
pnpm dev        # http://localhost:3000
```

로컬 ssuMCP 없이 실행하려면 `NEXT_PUBLIC_SSUAI_API_BASE=https://ssumcp.duckdns.org`로 설정하면 된다.

### 검증

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## 환경 변수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SSUAI_API_BASE` | ssuMCP 서버 URL (예: `https://ssumcp.duckdns.org`) |

실제 값은 `.env.example`을 참조한다. 시크릿은 절대 저장소에 커밋하지 않는다.

---

## 문서

- [제품 현황 및 범위](docs/product.md)
- [장기 비전과 로드맵](docs/vision.md)
- [보안 정책](docs/security.md)
- [문서 소유권 지도](docs/README.md)
- [서버 MCP 도구 목록](docs/mcp-tools.md)

---

## MCP 서버

이 앱이 소비하는 MCP 서버는 별도 저장소다:  
**[hoeongj/ssuMCP](https://github.com/hoeongj/ssuMCP)**

MCP 엔드포인트: `https://ssumcp.duckdns.org/mcp`

---

## 라이선스

MIT — [LICENSE](LICENSE)
