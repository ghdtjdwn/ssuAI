# Session handoff — 2026-05-27 (Post-split 정리 완료)

> Single rolling handoff. 이전 handoff overwrite.

## TL;DR

- **Repo Split 완료 + 정리 완료**: ssuMCP + ssuAI 완전 분리, 모든 PR 병합, CI ✅
- **KUBE_CONFIG 설정 완료**: ssuMCP → GitHub Actions Secrets에 등록 (05:27Z)
- **문서 재구성 완료**: 백엔드 docs → `ssuMCP/docs/`, 공용 참조 → `mp/docs/`, `TROUBLESHOOTING.md` → `ssuMCP/`
- **개인 파일 mp/ 최상위로 이동**: `myInfo.txt`, `내가모은정보들.txt/2.txt` (git 비추적)
- **다음 task 미정**: 도서관 좌석 자동 예약 에이전트(Flagship) 설계 준비 완료

## 현재 prod 상태 (ssuMCP 서버)

| 기능 | 상태 |
|------|------|
| 학식 / 기숙사 식단 | ✅ |
| 도서관 좌석·도서 검색 | ✅ |
| 공지사항 | ✅ |
| 시간표 / 성적 / 채플 / 졸업요건 / 장학금 | ✅ (rusaint FFI) |
| 과제 (LMS) | ✅ |
| 도서관 대출 현황 | ✅ |
| 채플 결석신청 정보 | ✅ (Task 27) |

## 이번 세션 완료 항목

| 항목 | 내용 |
|------|------|
| ssuMCP PR #1 병합 | chore/migrate-server-maintenance (Kotlin 2.3.21, Spring AI 1.1.7) |
| ssuAI PR #172 병합 | 프론트엔드 의존성 7개 업데이트 (rebase merge) |
| KUBE_CONFIG 설정 | ssuMCP Actions Secret, k3s public IP (168.110.104.199) 기반 |
| TROUBLESHOOTING.md 이전 | ssuAI → ssuMCP (git rm + add) |
| docs 재구성 | 백엔드 docs, ADR, deploy 문서 → ssuMCP/docs/ |
| mp/ 정리 | 개인 파일 mp/ 최상위 이동, myInfo.txt MCP URL 수정 (sse→mcp) |

## 열린 PR

없음 (모두 병합됨)

## 외부 의존 / 사용자 확인 필요

- **ssuMCP 배포 확인**: TROUBLESHOOTING.md 커밋(05:31Z) CI 완료 후 Deploy job이 KUBE_CONFIG를 정상 읽는지 확인. 이전 Deploy는 secret 설정 36초 전에 시작돼 skip됨.
  - 확인: `gh run list --repo hoeongj/ssuMCP --limit 5`
  - 배포 완료 후: `curl https://ssumcp.duckdns.org/actuator/health`

## 다음 세션 액션 (순서)

1. **ssuMCP Deploy 확인** — `gh run list --repo hoeongj/ssuMCP --limit 5` 로 최신 Deploy job 성공 여부 확인. 실패 시 로그 확인.
2. **다음 feature 설계** — 도서관 좌석 자동 예약 에이전트 (Flagship). `/plan` 모드로 설계 세션 시작.
   - 참조: `../docs/vision.md §3.4`, `../ssuMCP/docs/mcp-tools.md §8`
3. task spec 작성 → `.codex/current-task.md` → Codex 구현

## 폴더 구조 (2026-05-27 기준)

```
C:\Users\akftj\mp\
├── docs/                  # 공용 참조 (git 비추적)
│   ├── vision.md
│   ├── product.md
│   ├── dev-log.md
│   └── tasks/             (01-20 완료 spec들)
├── myInfo.txt             # 개인정보 (git 비추적, 절대 커밋 금지)
├── 내가모은정보들.txt        # 연구 메모 (git 비추적)
├── 내가모은정보들_2.txt      # 연구 메모 (git 비추적)
├── ssuAI/                 # Next.js 프론트엔드 (github.com/hoeongj/ssuAI)
│   ├── docs/
│   │   ├── adr/           (0006 프론트스택, 0009 챗봇)
│   │   └── handoff/       (latest.md, runbook.md)
│   └── .codex/current-task.md  ("no active task")
├── ssuMCP/                # Spring Boot MCP 서버 (github.com/hoeongj/ssuMCP)
│   ├── TROUBLESHOOTING.md
│   └── docs/              (architecture.md, security.md, mcp-tools.md, adr/, deploy/)
└── yolo/
```

## 보안 주의

- `myInfo.txt` — 학번/비밀번호 포함. git 절대 금지. mp/ 최상위에서만 참조.
- `docs/security.md §4`: 비밀번호, 쿠키, JWT, 학생번호, 성적/과제 본문, authenticated upstream HTML은 로그·commit 금지.
- `mcp_session_id` — secret 취급. 로그·에코 금지.

## Next-AI opener block

### Claude 로 이어갈 때

```text
/model opusplan

ssuAI 프로젝트 이어받음. 다음 순서:

1. CLAUDE.md 읽기 (C:/Users/akftj/mp/ssuAI/CLAUDE.md)
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/mp/ssuAI status --short --branch 확인
4. gh run list --repo hoeongj/ssuMCP --limit 3 로 최신 Deploy 상태 확인

현재 상태:
- Repo Split + 정리 완료. 열린 PR 없음.
- KUBE_CONFIG 등록됨. Deploy 첫 정상 실행 확인 필요.
- 다음 task: 도서관 좌석 자동 예약 에이전트 (Flagship) 설계 (/plan)
```

### Codex 로 이어갈 때

```text
ssuAI 프로젝트 이어받음. ssuai profile 기준으로 시작.

1. AGENTS.md 읽기 (C:/Users/akftj/mp/ssuAI/AGENTS.md)
2. docs/handoff/latest.md 읽기
3. .codex/current-task.md 읽기 (현재 task 없으면 사용자에게 요청)
4. git -C C:/Users/akftj/mp/ssuAI status --short --branch 확인
```
