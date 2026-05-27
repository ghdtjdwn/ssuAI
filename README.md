# ssuAI - 숭실대학교 AI 웹 클라이언트

[![CI](https://github.com/ghdtjdwn/ssuAI/actions/workflows/ci.yml/badge.svg)](https://github.com/ghdtjdwn/ssuAI/actions/workflows/ci.yml)

숭실대학교 [MCP 서버(ssuMCP)](https://github.com/ghdtjdwn/ssuMCP)를 소비하는 자체 웹/앱 클라이언트.

카드형 대시보드와 자연어 챗봇으로 공개 캠퍼스 정보와 연동된 개인 정보를
조회하는 Next.js 애플리케이션입니다.

**Flagship 목표 - 도서관 좌석 자동 예약 에이전트.**
현재는 도서관 연동 후 좌석 현황과 대출 정보를 조회할 수 있으며,
*"이 자리 예약해줘"*를 안전한 확인 절차와 함께 실행하는 기능은 후속 범위입니다.

## 라이브

| 항목 | URL |
|------|-----|
| 웹 챗봇 | <https://ssuai.vercel.app/chat> |
| 웹 대시보드 | <https://ssuai.vercel.app/> |

## MCP 서버

이 앱이 소비하는 MCP 서버는 별도 repo입니다:
**[ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP)**

MCP 엔드포인트: `https://ssumcp.duckdns.org/mcp`

## 현재 제공 기능

- 학식, 기숙사 식단, 교내 시설, 공지사항, 도서 검색 대시보드
- 도서관 연동 기반 좌석 현황 및 대출 현황 조회
- SmartID/LMS 연동 기반 시간표, 성적, 채플, 졸업요건, 장학금, 과제 조회
- 위 데이터를 사용하는 자연어 챗봇

## 기술 스택

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- TanStack Query v5
- pnpm

## 로컬 개발

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

<http://localhost:3000>

브라우저는 같은 origin의 `/api/*` 를 호출하고, Next.js rewrite가
`NEXT_PUBLIC_SSUAI_API_BASE`로 설정된 ssuMCP 서버에 요청을 전달합니다.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 구조

```text
app/          # Next.js App Router pages and providers
components/   # Feature and shared UI components
contexts/     # Client-side auth state
hooks/        # Query and auth hooks
lib/          # Typed API client and utilities
docs/         # 제품 문서, 작업 기록, frontend ADRs, handoff notes
```

## 문서

- [제품 현황 및 범위](docs/product.md)
- [장기 비전과 로드맵](docs/vision.md)
- [문서 소유권 지도](docs/README.md)
- [서버 MCP 도구 문서](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/mcp-tools.md)

## 라이선스

MIT - [LICENSE](LICENSE)
