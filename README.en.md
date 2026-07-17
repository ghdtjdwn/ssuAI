# ssuAI

[![CI](https://github.com/ghdtjdwn/ssuAI/actions/workflows/ci.yml/badge.svg)](https://github.com/ghdtjdwn/ssuAI/actions/workflows/ci.yml)
[![Security](https://github.com/ghdtjdwn/ssuAI/actions/workflows/security.yml/badge.svg)](https://github.com/ghdtjdwn/ssuAI/actions/workflows/security.yml)

[한국어](README.md) · **English**

A Next.js application that brings public campus information, private academic/LMS/library data,
and approval-gated AI actions into one web experience. It provides dashboards and an SSE chat UI
without exposing server credentials to the browser.

[Live app](https://ssuai.vercel.app) · [Chat](https://ssuai.vercel.app/chat) ·
[Platform case study](https://seongju.vercel.app/en/projects/ssu-platform/) · [Documentation map](docs/README.md)

![ssuAI home with a daily briefing and user-configurable dashboard widgets](docs/assets/dashboard.png)

## Role in the platform

| Service | Responsibility | Repository |
| --- | --- | --- |
| **ssuAI** | **User interface, same-origin BFF, authentication state, and SSE/HITL UX** | This repository |
| ssuAgent | LangGraph routing, conversation state, and HITL orchestration | [ghdtjdwn/ssuAgent](https://github.com/ghdtjdwn/ssuAgent) |
| ssuMCP | Campus domain logic, MCP/REST contracts, authentication, and state changes | [ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP) |
| ssu-ai-service | Isolated embedding-request gateway | [ghdtjdwn/ssu-ai-service](https://github.com/ghdtjdwn/ssu-ai-service) |

This repository owns only the frontend and BFF boundary. `ssuMCP` owns university integrations and
data consistency; `ssuAgent` owns natural-language routing and conversation checkpoints.

## Product flows

| User path | Capability | Trust boundary |
| --- | --- | --- |
| Public lookups | Meals, notices, facilities, calendar, books, and live seat status | Only credential-free GET/SSE may call the backend origin directly |
| Connected dashboard | Schedule, grades, graduation, chapel, scholarships, LMS, and loans | Access token stays in memory; refresh and provider sessions remain same-origin |
| AI chat | Domain handoff, tool progress, and streamed answers | A server route injects the agent key and verified principal |
| State changes | Seat actions and LMS exports | A `prepare` result is shown before user approval triggers `resume/confirm` |

Home, academics, library, campus, and chat share a desktop sidebar and mobile bottom navigation.
The design and accessibility decisions are recorded in the [UI redesign ADR](docs/adr/0010-ui-redesign.md)
(Korean).

<details>
<summary>More product screens</summary>

Names and personal academic, financial, loan, and seat values are de-identified in public images.

| Live library seats | Academic dashboard |
| --- | --- |
| ![Live library-seat status and book search](docs/assets/dashboard-library.png) | ![Graduation, grades, and chapel status](docs/assets/dashboard-academic.png) |

| Campus information | Connected services |
| --- | --- |
| ![Meals, notices, calendar, and facility search](docs/assets/dashboard-campus.png) | ![u-SAINT, LMS, and library connection status](docs/assets/service-connections.png) |

| Seat reservation approval | Completed after approval |
| --- | --- |
| ![The chat asks for approval before reserving a seat](docs/assets/chat-seat-approval.png) | ![The reservation completes after explicit approval](docs/assets/chat-seat-reserved.png) |

</details>

## Architecture

![ssuAI frontend architecture showing the public direct path and same-origin authentication and agent proxy boundary](docs/assets/architecture.svg)

Public GET/SSE requests may call the backend origin directly to avoid an unnecessary Vercel function
hop. Requests carrying cookies, bearer tokens, API keys, or `/api/agent/*` traffic always stay on
same-origin server paths. This keeps public CORS from expanding into authenticated surfaces while
reducing latency for public data. See the [frontend architecture](docs/architecture.md) for details.

## Engineering evidence

| Problem | Implementation and verification |
| --- | --- |
| Public-read optimization expanding the authentication boundary | Separate public GET/SSE allow-list and server-only proxy — [ADR 0087](docs/adr/0087-public-direct-origin-sse.md) · [boundary tests](lib/api/public-origin.test.ts) |
| Browser cookies disappearing during an SSO redirect | Exchange a single-use code in a 200 response — [ADR 0089](docs/adr/0089-sso-code-exchange.md) · [return-page tests](app/auth/return/page.test.tsx) |
| UI connection state disagreeing with real MCP grants | Treat backend grants as authoritative and issue sessions through single-flight — [ADR 0099](docs/adr/0099-authoritative-web-session-grants.md) |
| HITL state or final links disappearing after a stream settles | Stable-thread SSE, resume endpoint, and restricted safe-link rendering — [chat tests](components/chat/ChatPanel.test.tsx) · [message tests](components/chat/MessageBubble.test.tsx) |
| Browser control of the agent key or trusted principal | Server route verifies the bearer and forwards only trusted values — [agent proxy](lib/server/agentProxy.ts) · [proxy tests](lib/server/agentProxy.test.ts) |
| UI behavior that only works by accident locally | Lint, TypeScript, Vitest, and production build are all required — [CI workflow](.github/workflows/ci.yml) |

The main stack is Next.js 16, React 19, TypeScript 6, TanStack Query, Tailwind CSS, Radix UI,
Vitest, Testing Library, and Vercel.

## Local development and verification

Use Node.js 20 and pnpm 9. The app can target the public ssuMCP deployment without a local backend.

```bash
git clone https://github.com/ghdtjdwn/ssuAI.git
cd ssuAI
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

To run without a local ssuMCP, replace the active localhost value in `.env.local` with the public
backend:

```dotenv
NEXT_PUBLIC_SSUAI_API_BASE=https://ssumcp.duckdns.org
NEXT_PUBLIC_BACKEND_ORIGIN=https://ssumcp.duckdns.org
```

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See [`.env.example`](.env.example) for public versus server-only variables. Production proxy targets
and secrets must be verified with Vercel configuration; localhost defaults do not describe production.

## Documentation

- [Documentation map](docs/README.md)
- [Product scope](docs/product.md) (Korean)
- [Frontend architecture](docs/architecture.md) (Korean)
- [Security boundary](docs/security.md) (Korean)
- [Architecture decision records](docs/adr/) (Korean)
- [ssuMCP tool contract](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/mcp-tools.md) (Korean)

## Scope and limitations

- This is not an official Soongsil University service and cannot guarantee upstream availability.
- Private views and state changes require a valid university account and provider connection.
- CI verifies the code build and tests, not Vercel environment wiring or external end-to-end health.

## License

[MIT](LICENSE)
