# Session handoff — 2026-05-16 night

> Single rolling handoff file (CLAUDE.md / AGENTS.md "Session handoff
> to a different AI" 정책). 이전 핸드오프를 overwrite 한다.

## TL;DR

- **이번 세션 5 PR 머지** (#106 → #110): Task 17 LMS spec, ADR 0015
  action-tool 공용 인프라, Task 16 PR 16a storage 절반, Task 14
  spike resolved, 모바일/챗봇 follow-up, prod SSO env var fix.
- **Task 14 §7 #1 spike RESOLVED POSITIVE** — SmartID 가 임의
  `apiReturnUrl` 받음. web-port 패턴 retroactive 검증, 기존 Task 14
  PR 시리즈 (#94/#99/#100/#101/#102) 그대로 유효.
- **Prod 도서관/SSO 가 안 되는 root cause 찾음**: 1) prod 컨테이너가
  **Phase 1 시점 이미지로 frozen** (수동 `kubectl rollout restart` 로
  해소) 2) ConfigMap 에 `SSUAI_API_BASE_URL` 누락으로 SmartID 가 자기
  도메인 기준 상대경로 해석 → PR #110 으로 fix.
- **별도 발견된 인프라 버그 2개**: ArgoCD **Image Updater 가 한 번도
  write-back 한 적 없음** (git log 의 values.yaml 수정 commit 3개 다
  수동). 그래서 매 main 머지마다 `kubectl rollout restart` 가 임시
  workflow. 별도 진단 필요.
- **다음 세션 첫 액션**: PR #110 의 ConfigMap 변경이 prod 에 반영됐는지
  확인 + SmartID 로그인 end-to-end 검증. 자세한 commands 는 §"다음
  세션 액션" #1 참조.

## 이번 세션 머지/푸시 (2026-05-16, 5 PR)

| PR | 내용 | base | 비고 |
|----|------|------|------|
| #106 | docs(phase3+4): Task 17 (LMS 통합) spec + ADR 0015 (action-tool 공용 인프라) | main | 366 + 327 줄. vision/architecture/security/mcp-tools cross-link |
| #107 | feat(auth): SaintSessionStore + portal cookie retention (Task 16 PR 16a storage 절반) | main | AES-256-GCM, 12B IV, 30분 TTL, 1000-entry LRU. `SSUAI_CREDENTIAL_ENCRYPTION_KEY` env (empty=ephemeral random + WARN, JwtProvider 패턴). `SaintSessionStoreTests` 14 케이스. fixture-독립적이라 spike 전에 먼저 머지 |
| #108 | docs(task-14): apiReturnUrl spike RESOLVED POSITIVE + dev-log catchup | main | §7 #1 / §10 #1 spec annotation, 이번 세션 4 PR 의 dev-log entries |
| #109 | fix(chat+mobile): KST date inject 챗봇 prompt + iOS auto-zoom on input 해소 | main | `LlmChatService` Clock 주입, 두 번째 system message 로 오늘 KST 날짜+요일 전달. `text-base sm:text-sm` (mobile 16px → iOS auto-zoom 차단, desktop 14px 유지). viewport meta export |
| #110 | fix(prod): wire SSUAI_API_BASE_URL into Helm chart + fail fast if blank | main | `values.yaml` env.apiBaseUrl + `configmap.yaml` SSUAI_API_BASE_URL 추가. `SaintSsoCallbackController` 가 blank api-base-url 에 fail-fast (frontendOrigin 패턴) |

backend 257+ tests + frontend 38 tests + lint + typecheck 모두 그린. 자동 머지 정책으로 사람 review 없이 직접 머지.

## 열린 PR

| PR | 브랜치 | 내용 | 상태 |
|----|--------|------|------|
| #81 | `chore/spike-ssotoken-ttl-script` | Task 13 ssotoken TTL spike script | 사용자 PC 에서 실행 중. 결과 가져오면 사용자가 머지. **폴링 금지** ([[feedback-user-will-notify]]) |

## 외부 의존 — 사용자 직접 (폴링 금지)

| # | 항목 | 상태 |
|---|------|------|
| 1 | ~~SmartID `apiReturnUrl` whitelist spike~~ | ✅ **RESOLVED POSITIVE** 2026-05-16 |
| 2 | ssotoken TTL spike (PR #81) | ⏳ 대기. 사용자가 **마지막에 하겠다고 선언** ([[feedback-user-defers-ttl-spike]]) — 측정 오래 걸려서. 다른 트랙 다 끝난 후 |
| 3 | 모바일 CSS 실제 브라우저 검증 | ✅ 부분 완료. PR #104 의 헤더/카드 레이아웃은 정상. 단 추가 발견 이슈 (챗봇 날짜 / 좌석 404 / 로그인 404 / iOS zoom) 는 PR #109/#110 으로 fix. 마지막 prod 반영 후 재검증만 남음 |
| 4 | Task 16 PR 16b/16c 의 u-SAINT 시간표/성적 fixture capture | ⏳ 대기 |

남은 활성 외부 의존: **#4 만**. (#1 resolved, #2 user-deferred, #3 거의 done.)

## 다음 세션 액션 (우선순위 순서)

### 1. PR #110 prod 반영 + SmartID 로그인 end-to-end 검증 (제일 먼저)

세션 종료 시점에 PR #110 머지는 완료됐으나 prod ConfigMap 갱신 +
pod 재시작 + 로그인 흐름 verification 이 마무리 안 됨. 사용자 SSH
환경에서:

```bash
# 1) ArgoCD app 상태 + sync 시도 이력 확인
sudo kubectl get application -n argocd
sudo kubectl describe application ssuai-backend -n argocd | tail -20

# 2) SYNCED/Healthy 면 polling 주기 대기 또는 강제 sync
sudo kubectl patch application ssuai-backend -n argocd --type merge \
  -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'

# 3) ConfigMap 갱신 확인
sudo kubectl get configmap -n ssuai-prod -o yaml | grep API_BASE
# → SSUAI_API_BASE_URL: "https://ssumcp.duckdns.org" 보여야 함

# 4) Pod restart 해서 새 env var 반영
sudo kubectl rollout restart deployment ssuai-backend -n ssuai-prod
sudo kubectl get pod -n ssuai-prod -w
# 새 pod 1/1 Running 되면 Ctrl+C

# 5) pod 가 실제로 env var 잡고 있는지
sudo kubectl exec deployment/ssuai-backend -n ssuai-prod -- printenv | grep API_BASE
# → SSUAI_API_BASE_URL=https://ssumcp.duckdns.org
```

브라우저 검증 (위 4번까지 끝난 후):

1. `https://ssuai.vercel.app/auth/login` → "유세인트로 로그인" 클릭
2. SmartID 로그인 페이지에서 학번/비번 입력
3. 이번엔 SmartID 가 `https://ssumcp.duckdns.org/api/auth/saint/sso-callback?sToken=...&sIdno=...`
   로 302 (smartid 자기 도메인 아니라 **우리 도메인**). URL bar 가
   ssumcp.duckdns.org 로 잠깐 보이고
4. 곧 `https://ssuai.vercel.app/auth/return?ok=1` 으로 다시 redirect
5. 대시보드에 "안녕하세요, {이름} 학생" 표시되면 끝

만약 새 pod 가 CrashLoopBackOff 뜨면 fail-fast 발동 — `sudo kubectl
logs deployment/ssuai-backend -n ssuai-prod --tail=50` 로 메시지 확인.
ConfigMap 가 아직 sync 안 됐을 가능성이 높음 (그 경우 step 2 의
강제 sync 다시).

### 2. ArgoCD Image Updater 진단 (별도 인프라 버그)

`deploy/argocd/application-ssuai-backend.yaml` 에 image-updater
annotation 다 들어가 있는데, `deploy/charts/ssuai-backend/values.yaml`
의 git log 보면 image tag 가 자동으로 갱신된 적이 없음 (3개 commit
다 수동). 즉 Image Updater 가 처음부터 동작 안 함 → **매 main
머지마다 사용자가 수동으로 `kubectl rollout restart` 해야 prod 가
따라옴**.

진단:
```bash
# image-updater pod 있는지
sudo kubectl get pod -n argocd | grep image-updater
# 로그 확인 (없으면 install 부터)
sudo kubectl logs -n argocd deployment/argocd-image-updater --tail=100
```

가능한 원인:
- Image Updater 자체가 install 안 됨 (Helm install 누락)
- ghcr.io credential 없어서 tag 스캔 실패 (private repo 면 필요)
- git write-back credential (`argocd-image-updater-git-creds` secret)
  없음 — manifest 의 annotation 참조하는 secret 누락
- annotation regex (`^sha-[0-9a-f]{40}$`) 와 실제 CI tag 불일치 — CI
  는 `docker/metadata-action` 의 `type=sha,format=long` 사용, 기본
  prefix `sha-` 라 매치되어야 하지만 검증 안 됐음

진단 결과 보고 fix PR (별도) 작성. 임시 workflow (수동 rollout
restart) 가 동작하니까 긴급은 아님.

### 3. Task 16 PR 16b (`get_my_schedule`) — fixture 도착하면

외부 의존 #4 (u-SAINT 시간표/성적 fixture capture) 가 사용자 측에서
끝났을 때:

- PR 16b — `SaintScheduleConnector` (Mock + Real) + `SaintScheduleService`
  + `SaintScheduleController` (`GET /api/saint/schedule`) +
  `SaintScheduleMcpTool` (`get_my_schedule`)
- 사용자 commit 한 fixture (예: `backend/src/test/resources/fixtures/saint/schedule-success.html`)
  로 `RealSaintScheduleConnectorTests` 작성
- 인증: `JwtAuthFilter` 가 채우는 `ssuai.studentId` request attribute
  로 `SaintSessionStore.cookies(studentId)` 호출 (Storage 는 이미 PR
  #107 로 라이브)
- Default `ssuai.connector.saint-schedule: mock`

자세한 layout / DTO / 보안 체크리스트는 `docs/tasks/16-usaint-realtime-data.md`
§5, §7, §8 참조.

### 4. Task 16 PR 16c (`get_my_grades`)

PR 16b 와 동일 패턴. **단, 성적은 LLM prompt 에 절대 안 들어가야 함**
— `LlmChatService.compactToolResponse` 에서 성적 데이터 필터링.
tool-citation 패턴 (count 만 LLM 에, 본문은 controller path 로만)
적용. Task 16 spec §6 #6, §8 확정.

### 5. Task 13 PR 13b/13c — TTL spike 결과 받은 후

사용자가 마지막에 하겠다고 명시한 항목 (#2 외부 의존). 결과 받으면
Task 13 spec §12 storage 결정 → PR 13b (Real seat connector) + PR
13c (manual paste UI) 시작.

### 6. Task 17 PR 17a (LMS) — fixture/spike 도착하면

LMS 의 host + auth shape (SmartID-fronted vs form-login) spike 가
필요. Task 16 #4 의 u-SAINT fixture capture 끝난 후 자연스럽게 다음
작업. 자세히는 `docs/tasks/17-lms-integration.md` §3, §7.

### 7. Phase 4 ActionInfrastructure PR (낮은 우선순위)

ADR 0015 Consequences 첫 항목 — `reserve_library_seat` 시작 전에
`action_audit` 테이블 + `ActionAuditService` + `ActionLock` 인터페이스
(in-process 시작, Redis SETNX swap-ready) + `PreparedActionExpiryRunner`
한 PR 으로 깔아야 함. Task 16 PR 16b/16c 안정 후.

## 사용자 컨텍스트 — 잊지 말 것

- **숭실대 컴퓨터학부 3학년**, 포트폴리오 프로젝트
- **3-AI rotation** (claude1/claude2/codex), 토큰 사정 따라 한 명씩 active
  ([[role-3-ai-rotation]]). 정책 변경 시 CLAUDE.md + AGENTS.md 양쪽 같은
  commit 으로 sync.
- **commit/PR body 에 Claude/AI 흔적 절대 금지** (`Co-Authored-By: Claude`
  trailer X, "🤖 Generated with..." footer X). [[feedback-no-claude-coauthor]]
- **안전한 PR 자동 머지** — mergeable + tests pass + mock default 면 묻지
  말고 즉시 `gh pr merge --auto --rebase --delete-branch`.
- **외부 작업 사용자 통지 대기** — "내가 알려줄게" / "끝나면 알려줄게"
  한 작업은 그 후 언급/폴링 금지. [[feedback-user-will-notify]]
- **사용자 본인 학번/sIdno chat paste 시 redaction 경고 안 함**. project
  policy (server log / fixture) 는 그대로 적용 — chat hygiene 만 relax.
  [[feedback-user-student-id-not-sensitive]]
- **TTL spike 는 마지막에**. 사용자가 명시함 — 측정이 오래 걸리니까
  다른 active 작업 다 정리 후. [[feedback-user-defers-ttl-spike]]
- **두 제품 framing** — "MCP 서버" 와 "ssuAI 웹/앱" 은 분리된 제품
  ([[project-final-goal]])
- **간결한 한국어 응답 선호**.
- **in-flight context 는 in-repo (handoff doc / task spec / dev-log)** 에
  쓰고 auto-memory 에는 안 씀 ([[feedback-save-progress-to-project]]).

## 보안 주의

- SmartID spike 시 사용자가 채팅에 paste 한 `sToken` 값들은 one-shot
  이라 already consumed. literal 학번 `20221528` 도 chat 에 있었으나
  사용자가 "본인 학번은 public OK" 라고 명시. **commit/log/fixture
  어디에도 들어가지 않았고 앞으로도 절대 안 됨** — fixture 학번
  placeholder 는 `20999999` 그대로.
- JWT secret: dev/test ephemeral random (재시작마다 invalid), prod
  `SSUAI_JWT_SECRET` env 필수 (≥ 32 bytes). `application-prod.yml` 에
  빈 default 라 미설정 시 startup 실패.
- `SSUAI_CREDENTIAL_ENCRYPTION_KEY` (saint session store 의 AES-256-GCM
  키): 비면 ephemeral random + WARN. prod 에 실제 값 set 안 돼 있을
  수도 있음 — pod 로그의 "ssuai.saint.session.encryption-key is empty"
  WARN 확인. 매 pod 재시작마다 저장된 saint 세션 invalidate 됨 (사용자
  re-SSO 필요). 현재 storage 가 PR 16b/16c 라이브 전이라 운영 영향 없음.
  PR 16b 시작 전에 prod env var 잡아주는 follow-up 권장.
- ssutoday `sToken`/`sIdno` 는 method-scoped — `SaintSsoService.authenticate`
  내부에서만 살아있음. 로그/DB/세션 어디에도 안 남김.
- 성적 (`get_my_grades`) 은 **LLM 프롬프트에 절대 안 들어가야 함** —
  Task 16 spec §6, §8. 챗봇은 tool 호출 결과를 controller path 로만
  반환, LLM compaction 거치지 않음.

## 자동 메모리

`~/.claude-personal/projects/C--Users-akftj-ssuAI/memory/`

핵심 파일 (인덱스는 `MEMORY.md` 자동 로드):
- `project-final-goal.md` — 두 제품 framing + flagship 인용
- `role-3-ai-rotation.md` — 3-AI 정책 + handoff 루틴
- `feedback-no-claude-coauthor.md` — commit/PR body 에 Claude trailer 금지
- `feedback-auto-merge-safe-prs.md` — 자동 머지 정책
- `feedback-user-will-notify.md` — 사용자 외부 작업 폴링 금지
- `feedback-user-student-id-not-sensitive.md` — 본인 학번 chat redaction X (NEW 이번 세션)
- (TODO 다음 AI: `feedback-user-defers-ttl-spike.md` 신규 메모 작성 권장 — 사용자가 TTL spike 마지막에 한다고 명시)

(이번 세션 끝에 `MEMORY.md` 에 `feedback-user-student-id-not-sensitive`
포인터 추가됨.)
