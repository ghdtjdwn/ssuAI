# ssuAI - 숭실대학교 AI 웹 클라이언트

[![CI](https://github.com/ghdtjdwn/ssuAI/actions/workflows/ci.yml/badge.svg)](https://github.com/ghdtjdwn/ssuAI/actions/workflows/ci.yml)

숭실대학교 [MCP 서버(ssuMCP)](https://github.com/ghdtjdwn/ssuMCP)를 소비하는 자체 웹/앱 클라이언트.

카드형 대시보드 + 자연어 챗봇 + AI 에이전트.

**Flagship - 도서관 좌석 자동 예약 에이전트.**
*"이 자리 예약해줘"* 한 마디로 실제 학교 도서관에서 좌석을 예약합니다.

## 라이브

| 항목 | URL |
|------|-----|
| 웹 챗봇 | <https://ssuai.vercel.app/chat> |
| 웹 대시보드 | <https://ssuai.vercel.app/> |

## MCP 서버

이 앱이 소비하는 MCP 서버는 별도 repo입니다:
**[ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP)**

MCP 엔드포인트: `https://ssumcp.duckdns.org/mcp`

## 기술 스택

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- TanStack Query v5
- pnpm

## 로컬 개발

```bash
cp frontend/.env.example frontend/.env.local
pnpm --dir frontend install
pnpm --dir frontend dev
```

<http://localhost:3000>

## 라이선스

MIT - [LICENSE](LICENSE)
