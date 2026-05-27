# Session handoff — 2026-05-27 (Repo Split 완료 후)

> Single rolling handoff. 이전 handoff overwrite.

## TL;DR

- **Repo Split 완료**: `ghdtjdwn/ssuAI` (모노레포) → `ghdtjdwn/ssuMCP` (MCP 서버) + `ghdtjdwn/ssuAI` (프론트엔드) 분리
- **ssuAI**: 프론트엔드 전용. `backend/`, `deploy/`, `smithery.yaml` 제거됨. CI = 프론트만.
- **ssuMCP**: 새 public repo. 첫 커밋 완료. CI ✅. PR #1 (`chore/migrate-server-maintenance`) = 의존성 업데이트, 병합 대기.
- **Task 27 완료**: 채플 결석신청 정보 (`feat/chapel-absence-applications` → main, `395b18a`)
- **문서 재구성**: 백엔드 docs → `ssuMCP/docs/`. 공용 참조 → `mp/docs/`. ssuAI = 운영 문서만.

## 현재 prod 상태 (ssuMCP 서버)

| 기능 | 상태 |
|------|------|
| 학식 / 기숙사 식단 | ✅ |
| 도서관 좌석·도서 검색 | ✅ |
| 공지사항 | ✅ |
| 시간표 / 성적 / 채플 / 졸업요건 / 장학금 | ✅ (rusaint FFI) |
| 과제 (LMS) | ✅ (Canvas phase 3 수정 후) |
| 도서관 대출 현황 | ✅ |
| 채플 결석신청 정보 | ✅ (Task 27) |

## 미완료 사용자 액션

1. **`KUBE_CONFIG` secret 추가** — GitHub → `ghdtjdwn/ssuMCP` → Settings → Secrets → Actions → New secret → `KUBE_CONFIG` (기존 ssuAI repo 값과 동일)
2. **ssuMCP PR #1 병합 승인** — `chore/migrate-server-maintenance` (Kotlin 2.3.21, Spring AI 1.1.7 등)

## 열린 PR

| Repo | PR | 내용 | 상태 |
|------|----|----- |------|
| ssuMCP | #1 | chore/migrate-server-maintenance | CLEAN, CI ✅, 병합 대기 |
| ssuAI | #172 | 프론트엔드 의존성 업데이트 | 확인 필요 |

## 다음 세션 액션

1. `.codex/current-task.md` = "no active task" 확인 → 다음 feature 논의
2. ssuMCP PR #1 병합 승인 후 Codex 로 merge (런타임 의존성 변경이므로 사용자 승인 먼저)
3. 다음 task 후보: 도서관 좌석 자동 예약 에이전트 (Flagship) 설계

## 폴더 구조 (2026-05-27 기준)

```
C:\Users\akftj\mp\
├── docs/                  # 공용 참조 (git 비추적)
│   ├── vision.md
│   ├── product.md
│   ├── dev-log.md
│   └── tasks/             (01-20 완료 spec들)
├── ssuAI/                 # Next.js 프론트엔드
│   ├── docs/
│   │   ├── adr/           (0006 프론트스택, 0009 챗봇)
│   │   └── handoff/       (latest.md, runbook.md)
│   └── .codex/current-task.md  ("no active task")
├── ssuMCP/                # Spring Boot MCP 서버
│   └── docs/              (architecture, security, mcp-tools, adr/)
└── yolo/
```

## 보안 주의

- `docs/security.md` §4: 비밀번호, 쿠키, JWT, 학생번호, 성적/과제 본문, authenticated upstream HTML 전체는 로그 금지.
- ssuMCP 서버 배포 활성화 전까지 KUBE_CONFIG 없으면 deploy job skip (no-op).

## Next-AI opener block

### Claude 로 이어갈 때

```text
/model opusplan

ssuAI 프로젝트 이어받음. 다음 순서:

1. CLAUDE.md 읽기
2. docs/handoff/latest.md 읽기
3. git -C C:/Users/akftj/mp/ssuAI status --short --branch 확인

현재 상태:
- Repo Split 완료 (ssuMCP 분리)
- Task 27 채플 결석신청 완료
- ssuMCP PR #1 병합 승인 대기 (사용자 확인 후)
- 다음 task 미정
```

### Codex 로 이어갈 때

```text
ssuAI 프로젝트 이어받음. Codex 는 ~/.codex/config.toml 의 ssuai profile 기준으로 시작.

1. AGENTS.md 읽기
2. docs/handoff/latest.md 읽기
3. .codex/current-task.md 읽기 (현재 task 없으면 사용자에게 요청)
4. git -C C:/Users/akftj/mp/ssuAI status --short --branch 확인
```
