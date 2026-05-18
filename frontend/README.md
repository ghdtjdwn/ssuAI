# ssuAI Frontend

Next.js dashboard for the local ssuAI MVP.

## Prerequisites

- Node.js 20
- pnpm 9
- Backend running on `http://localhost:8080`

## Setup

```powershell
Copy-Item .env.example .env.local
pnpm install
```

`NEXT_PUBLIC_SSUAI_API_BASE` points the Next.js `/api/*` rewrite at the
Spring Boot backend. Browser code calls same-origin `/api/*`, so auth cookies
stay first-party in production.

## Commands

```powershell
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` runs Vitest + React Testing Library component tests in jsdom.
Use `pnpm test --watch` while developing frontend components.

From the repository root:

```powershell
pnpm --dir frontend dev
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
```
