# AGENTS.md — ssuAI

ssuAI 는 **숭실대학교 AI 웹/앱 클라이언트**다.
MCP 서버는 별도 repo **[ghdtjdwn/ssuMCP](https://github.com/ghdtjdwn/ssuMCP)** 에서 운영하고,
ssuAI 는 그 MCP 서버를 소비하는 프론트엔드 — 카드형 대시보드 + 자연어 챗봇 + AI 에이전트.

**🏆 Flagship — 도서관 좌석 자동 예약 에이전트.** *"이 자리 예약해줘"*

> **워크플로우 원본: `../AGENTS.md` (mp 루트).** Claude(Fable 5)가 설계·구현·테스트,
> Codex가 commit/push/PR/merge/배포 확인을 전담한다. 핵심 규칙 요약은 아래 인라인.
> (CLAUDE.md 는 `@AGENTS.md` 1줄 import — 미러 동기화 불필요)

## 문서

- `docs/vision.md` — 장기 방향 / `docs/product.md` — 현재 출시 범위 (**관련 섹션만 read**)
- MCP 서버 아키텍처·보안: `../ssuMCP/docs/`

## 핵심 규칙 (원본: ../AGENTS.md)

1. **Authorship** — author/committer = 본인 계정(ghdtjdwn). AI attribution
   (`Co-Authored-By: Claude`, `🤖 Generated with…`, "Claude"/"Anthropic"/"Codex" 표기) 절대 금지.
   커밋 후 `git log -1 --format='%an <%ae> | %cn <%ce>'` 확인.
2. **의사결정** — 스펙·방법·로직·프레임워크 결정 전 반드시 웹검색 → 포트폴리오 가치(최우선)·
   트렌드 적합성·구현 가능성 평가 → 사용자에게 보고 후 확정. 즉흥 결정 금지.
3. **사용자 확인 필수** — prod 환경변수 변경, major dep bump, force-push, DB 마이그레이션.
   그 외 테스트·커밋·푸시·PR·머지(tests pass + 런타임 영향 없음)·main pull·배포 확인은 자율 실행.
4. **트러블슈팅** — 트리거 발생 시 **즉시** `../ssuMCP/TROUBLESHOOTING.md` 기록.
   필수 포함: 틀린 가설 / 실제 원인 / 핵심 파일·커밋 / 포트폴리오 포인트 / 면접 예상 질문 2~3개.
5. **문서 최신화** — 큰 작업 완료 시 `../MASTERPLAN.md` + 변경 영역 `docs/` 즉시 갱신.

## 개발 규칙

- 검증: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- 일반 작업에서 읽지 말 것: `node_modules/`, `.next/`, `scratch/`, 오래된 `docs/tasks/` 전체
- Branch: `feat/` `fix/` `refactor/` `chore/` `docs/` + kebab-case. 한 feature = 한 PR.
- Commit: Conventional Commits (`feat(frontend): ...`)
- pre-commit: lefthook → gitleaks (secret 유출 검사)
- 배포: main push → Vercel 자동 (`https://ssuai.vercel.app`, force-dynamic)

## Credentials

1. `C:/Users/akftj/mp/myInfo.txt` — 학번·비밀번호·서버 IP 등
2. `C:/Users/akftj/mp/ssuAI/.env.local` — 프론트 환경변수
3. 위에 없을 때만 사용자에게 요청

## User Context

숭실대 컴퓨터학부 3학년. 포트폴리오 프로젝트 — "학생 1명이 현실적으로 만들 수 있는
인상적 결과물" 지향. 과한 추상화 금지. 간결한 한국어 응답 선호.
