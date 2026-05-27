# Documentation Map

`ssuAI/docs/`는 사용자 경험과 제품 진행 기록의 기준 위치입니다. 서버 구현
계약과 운영 자료는 별도 저장소 `ssuMCP/docs/`가 소유합니다.

## Active Documents

| 문서 | 역할 |
| --- | --- |
| [product.md](product.md) | 현재 배포된 제품 표면, 인증 경계, 남은 범위 |
| [vision.md](vision.md) | 장기 목표와 단계별 로드맵 |
| [handoff/latest.md](handoff/latest.md) | 최근 운영/인계 스냅샷 |
| [adr/](adr/) | 프론트엔드 및 챗봇 설계 결정 |

`architecture.md`, `mcp-tools.md`, `security.md`는 분리 전 task/ADR의 상대
링크를 유지하기 위한 포인터 문서이며, 실제 내용의 기준은 ssuMCP입니다.

## Historical Archive

`tasks/`와 [dev-log.md](dev-log.md)는 프론트엔드와 서버가 한 저장소에 있던
시기의 작업 기록도 포함합니다. 따라서 해당 기록 안의 `frontend/`는 현재
`ssuAI/` 루트를, `backend/`는 현재 `ssuMCP/` 루트를 뜻할 수 있습니다.
과거 결정을 보존하기 위해 기록 자체의 경로와 당시 상태 문구는 일괄
재작성하지 않습니다.

## Backend Sources Of Truth

- [ssuMCP architecture](https://github.com/hoeongj/ssuMCP/blob/main/docs/architecture.md)
- [ssuMCP MCP tools](https://github.com/hoeongj/ssuMCP/blob/main/docs/mcp-tools.md)
- [ssuMCP security](https://github.com/hoeongj/ssuMCP/blob/main/docs/security.md)
- [ssuMCP deployment](https://github.com/hoeongj/ssuMCP/blob/main/deploy/README.md)
