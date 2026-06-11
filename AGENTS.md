# AGENTS.md — ssuAI

ssuAI is the **Soongsil University AI web/app client**. The MCP server lives in a separate repo, **[ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP)**; ssuAI is the consuming frontend — card dashboard + natural-language chatbot + AI agent.

**🏆 Flagship — library seat auto-reservation agent.** *"이 자리 예약해줘"*

> **Workflow source of truth: `../AGENTS.md` (mp root).** Claude = design / spec / review; Codex = ALL git & deploy execution. Core rules are inlined below for executors that read only this file.
> (`CLAUDE.md` is a 1-line `@AGENTS.md` import — no mirror sync needed.)

## Docs

- `docs/vision.md` — long-term direction / `docs/product.md` — current release scope (**read relevant sections ONLY**)
- MCP server architecture & security: `../ssuMCP/docs/`

## Core Rules (source: ../AGENTS.md)

1. **Authorship** — commit author/committer = ghdtjdwn. AI attribution ABSOLUTELY FORBIDDEN: no `Co-Authored-By: Claude`, no `🤖 Generated with…`, no "Claude" / "Anthropic" / "Codex" / "Gemini" anywhere. Post-commit check: `git log -1 --format='%an <%ae> | %cn <%ce>'`.
2. **Decisions** (spec / method / logic / framework) — web search FIRST → evaluate ① portfolio value (top priority) ② trend fit ③ completion & provability → report to the user and finalize TOGETHER. NO improvised decisions. Target: top-tier, job-winning portfolio — IF a better direction exists (incl. teardown), report it as an option.
3. **User confirmation REQUIRED** — prod env-var change, major dependency bump, force-push, DB migration. Everything else is autonomous: tests, commit, push, PR, merge (tests pass + no runtime impact), main pull, deploy verification.
4. **Troubleshooting** — on ANY trigger, record IMMEDIATELY in `../ssuMCP/TROUBLESHOOTING.md`. REQUIRED fields: wrong hypothesis / actual cause / key files & commits / portfolio point / 2–3 expected interview questions. Records are human-facing → write in KOREAN.
5. **Docs sync** — after each major unit, update `../MASTERPLAN.md` + affected `docs/` in the same flow. Study-grade records in KOREAN: background / alternatives + rejection reasons / rationale (incl. sources) / how it works. NO summarizing away.
6. **Solo mode** — when the user reports one AI's usage-limit outage, the remaining AI runs design → implement → test → commit → push → deploy verification end-to-end. Work basis: `../MASTERPLAN.md` "다음 작업"; update status on completion. Codex solo: docs / simple work via `-p git` (mini) to save tokens.

## Dev Rules

- Verification: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- DO NOT read in routine work: `node_modules/`, `.next/`, `scratch/`, the entire stale `docs/tasks/`
- Branch: `feat/` `fix/` `refactor/` `chore/` `docs/` + kebab-case. One feature = one PR.
- Commit: Conventional Commits (`feat(frontend): ...`)
- pre-commit: lefthook → gitleaks (secret-leak scan)
- Deploy: main push → Vercel auto (`https://ssuai.vercel.app`, force-dynamic)

## Credentials

1. `C:/Users/akftj/mp/myInfo.txt` — student ID, password, server IP, etc.
2. `C:/Users/akftj/mp/ssuAI/.env.local` — frontend env vars
3. ONLY if absent above → ask the user

## User Context

SSU Computer Science junior. Job-direct portfolio project — top-tier results proven with real operation and numbers, using trending tech. NO over-abstraction. The user prefers concise KOREAN responses — always reply to the user in Korean.
