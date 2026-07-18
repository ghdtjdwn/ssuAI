# SSU campus AI platform verification boundary

This page keeps the four-service platform's evidence comparable without mixing
local synthetic measurements with production behavior.

## Thirty-second project explanation

- Problem: campus information and authenticated student actions were fragmented
  across legacy systems, while write actions needed explicit user approval.
- Boundary: ssuAI owns the browser and same-origin edge, ssuAgent owns natural
  language orchestration and HITL pauses, ssuMCP owns campus tools, sessions,
  resilience, and audits, and ssu-ai-service owns embeddings.
- Decision: keep domain tools deterministic and fail closed; let the LLM select
  and compose them, but stop side effects at a reviewed approval boundary.
- Verification: browser journeys and accessibility run in ssuAI, the versioned
  routing contract runs in ssuAgent, and backend load/correctness experiments
  run against WireMock in ssuMCP.
- Limit: the evidence below is not a continuous production uptime record, real
  user study, or live-model accuracy benchmark.

## Evidence register

| Evidence | Date and conditions | Result that can be claimed | Claim boundary |
|---|---|---|---|
| Browser journeys, axe, Web Vitals | 2026-07-18; merge commit `8af59ef`; CI production build; Chromium desktop and Pixel 7 profiles; five core routes; all `/api/**` calls replaced by an explicit 503 fixture | 190 Vitest cases and 12 Playwright checks passed; no critical/serious WCAG 2.0/2.1 A/AA axe violation; laboratory LCP ≤2.5 s and CLS ≤0.1 budgets passed | No school-system availability, authenticated journey, field RUM, or real-user result |
| Anonymous deployed-route smoke | 2026-07-18; one read-only HTTP probe each for `/`, `/chat`, `/academics`, `/library`, `/campus`, and the backend health endpoint | all six endpoints returned HTTP 200 at the observation time | Point-in-time reachability only; no uptime, authenticated workflow, data correctness, or latency SLO claim |
| Deployed accessibility drift check | 2026-07-18; the same five pages on `ssuai.vercel.app` before release `8af59ef`; Chromium desktop and Pixel 7; school API calls replaced by the 503 fixture | both Web Vitals checks passed, but all ten route-level axe checks failed on serious color-contrast findings | Historical pre-fix release-parity evidence; not a result for the later `8af59ef` deployment |
| Dependency advisory gate | 2026-07-18; exact direct versions plus patched transitive overrides; npm registry advisory snapshot | `pnpm audit` reported 0 low, moderate, high, or critical findings | Point-in-time package advisory result; not a source review or runtime penetration test |
| Vercel production release | 2026-07-18; merge commit `8af59ef`; GitHub deployment environment `Production`; read-only root probe | Vercel reported a successful production deployment for the exact commit and `https://ssuai.vercel.app` returned HTTP 200 | Release and point-in-time reachability evidence; no post-release live axe run, authenticated journey, or external-system verification |
| Supervisor routing contract | 2026-07-18; nine versioned Korean prompts; fake chat model; real routing tools, markers, parser, and graph destinations | 12 routing-contract tests and the complete 306-test agent suite passed | Does not measure provider/model tool-selection accuracy |
| Backend read load | 2026-07-03; local macOS 8 vCPU/16 GB, Colima services, host JVM, WireMock; fixed 50 RPS and 200 RPS five-minute runs | 50 RPS: 24k checks, p95 26.9 ms, 0% error, about 42 upstream calls; 200 RPS: 96k checks, p95 19.1 ms, 0% error, 82 dropped iterations | Synthetic upstream latency and local hardware; not campus network or production capacity |
| Same-seat contention | 2026-07-03; local synthetic Pyxis, 100 concurrent confirms for one seat | one success, 99 race failures, and exactly one upstream reserve POST | Demonstrates local contention control, not real Pyxis latency or availability |
| Circuit-breaker fault injection | 2026-07-03; 25 RPS local read load, cache disabled, WireMock changed from 200 to 500 and back | breaker opened in about 3 s, stopped upstream calls while open, then recovered through three half-open probes | Synthetic fault lifecycle, not a production incident |

The backend procedure and raw-condition narrative are maintained in
`ssuMCP/docs/performance/library-agent-load-test.md`. The browser gate is
reproduced with `pnpm build && pnpm test:e2e`; the agent contract with
`uv run pytest tests/test_eval_routing.py`.

## Production drift lifecycle

The live smoke returned HTTP 200, but the deployed accessibility run failed 10
of 12 checks. axe observed the deployed `text-subtle` token as `#8a94a2` against
light backgrounds, with contrast ratios from 2.86:1 to 3.21:1 at small text
sizes. The reviewed fix changes that token to `#5f6b7a`, removes one additional
opacity reduction, and passes the same 12-check production-build gate.

The deployed CSS still contained the pre-fix token, so the local and production
artifacts were not at release parity. Pull request
[#256](https://github.com/ghdtjdwn/ssuAI/pull/256) subsequently merged as
`8af59ef`. The same commit passed lint, typecheck, 190 Vitest cases, production
build, and the 12-check local browser gate in
[main CI](https://github.com/ghdtjdwn/ssuAI/actions/runs/29646211137), then Vercel
reported a successful Production deployment. A read-only root probe returned
HTTP 200 after the deployment.

No post-release live axe run was retained. The evidence therefore proves that
the reviewed fix passed the synthetic regression gate and that its exact commit
was released, but it does not prove live accessibility conformance. Closing that
last evidence gap requires rerunning the same browser suite against the deployed
origin and retaining the result.

## Operating-period statement

The repositories document a live deployment topology and point-in-time product
screens, but they do not contain an exported availability history that proves a
continuous operating period or uptime percentage. Until such an artifact is
retained from monitoring, describe the platform as deployed and independently
verified under the dated conditions above—not as having a measured SLA or a
specific uninterrupted operating duration.
