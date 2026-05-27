# Session Handoff - 2026-05-27

> 현재 작업공간과 배포 확인 상태의 rolling snapshot입니다. 과거 작업 상세는
> `docs/dev-log.md`와 `docs/tasks/`에서 확인합니다.

## Repository Layout

```text
C:\Users\akftj\mp\
├── ssuAI\                  # Next.js client + product documentation
│   ├── app\, components\   # application code at repository root
│   ├── hooks\, lib\
│   └── docs\
│       ├── product.md, vision.md, dev-log.md, tasks\
│       ├── adr\
│       └── handoff\
├── ssuMCP\                 # Spring Boot REST/MCP server + deployment
│   ├── src\
│   ├── docs\
│   └── deploy\
└── yolo\                   # local tooling
```

상위의 개인 메모 및 인증 관련 파일과 `.claude/`는 로컬 전용이며 Git에
추가하지 않습니다.

## Current Product State

| 영역 | 상태 |
| --- | --- |
| 학식, 기숙사 식단, 시설, 도서 검색, 공지 | 제공 중 |
| 도서관 좌석/대출 | `LIBRARY` 연동 후 조회 |
| 시간표, 성적, 채플, 졸업요건, 장학금 | `SAINT` 연동 후 조회 |
| LMS 과제/퀴즈 | `LMS` 연동 후 조회 |
| MCP | 23 tools, Streamable HTTP `/mcp` |
| 도서관 좌석 자동 예약 | 아직 미구현, 다음 action 범위 |

## 2026-05-27 Maintenance

- `ssuAI`의 Next.js 애플리케이션을 불필요한 `frontend/` 하위 폴더에서
  저장소 루트로 이동했습니다.
- 제품/작업 문서를 비-Git 상위 폴더에서 `ssuAI/docs/`로 복귀시켜 버전
  관리 대상으로 정리했습니다.
- `ssuMCP`의 중복 Dockerfile과 추적할 필요 없는 생성 Kubernetes manifest를
  제거하고 Helm chart를 배포 리소스 기준으로 명시했습니다.
- 도서관 좌석 캐시는 인증 경계를 넘지 않도록 분리했고, MCP 좌석 도구는
  실제 운영 upstream 계약에 맞춰 `LIBRARY` 인증을 요구합니다.

## Verification Reference

- Frontend: repository root에서 `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`
- Backend: repository root에서 `.\gradlew.bat test`
- Deployment: GitHub Actions run 및
  `https://ssumcp.duckdns.org/actuator/health` 확인

## Document Ownership

- 제품 범위와 장기 방향: [../product.md](../product.md),
  [../vision.md](../vision.md)
- 백엔드 계약과 보안:
  [ssuMCP docs](https://github.com/hoeongj/ssuMCP/tree/main/docs)
- 과거 task/dev-log에는 분리 전 `frontend/`와 `backend/` 경로가 남아
  있으며 이는 역사 기록으로 유지합니다.
