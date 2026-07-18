# Documentation Map

`ssuAI/docs/`는 사용자 경험과 제품 진행 기록의 기준 위치입니다. 서버 구현
계약과 운영 자료는 별도 저장소 `ssuMCP/docs/`가 소유합니다.

## Active Documents

| 문서 | 역할 |
| --- | --- |
| [product.md](product.md) | 현재 배포된 제품 표면, 인증 경계, 남은 범위 |
| [architecture.md](architecture.md) | 브라우저, Vercel, ssuMCP, ssuAgent 사이의 프론트엔드 런타임·신뢰 경계 |
| [troubleshooting.md](troubleshooting.md) | 실제 CI·운영 장애의 증거, 원인, 해결과 재발 방지 기록 |
| [portfolio-verification-boundary.md](portfolio-verification-boundary.md) | 브라우저·에이전트·부하 증거의 조건, 운영 주장 한계, 배포 drift |
| [adr/](adr/) | 프론트엔드 및 챗봇 설계 결정 (0001·0006·0009·0010·0086·0087·0088·0089·0090·0099) |

> ADR 번호는 ssuMCP와 **공유 시퀀스**입니다. 프론트엔드는 0001·0006·0009·0010·0086·0087·0088·0089·0090·0099를 소유하고, 나머지 번호는 다른 서비스가 소유합니다 — 빠진 번호는 삭제가 아닙니다. 신규 ADR 번호는 전체 서비스에서 아직 예약·사용되지 않은 다음 번호를 사용합니다.

`mcp-tools.md`, `security.md`는 ADR의 상대 링크를 유지하기 위한 포인터
문서이며, 실제 내용의 기준은 ssuMCP입니다. `architecture.md`는 ssuAI가
직접 소유하는 프론트엔드 경계를 설명하고 서버 내부 구조는 ssuMCP에 위임합니다.

## Historical Product Direction

- [vision.md](vision.md) — 2026-07-02 시점의 장기 방향과 단계별 계획 기록. 현재 backlog나 구현
  상태의 기준이 아니며, 현재 상태는 `product.md`, 코드, 최근 ADR을 따른다.

## Backend Sources Of Truth

- [ssuMCP architecture](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/architecture.md)
- [ssuMCP MCP tools](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/mcp-tools.md)
- [ssuMCP security](https://github.com/ghdtjdwn/ssuMCP/blob/main/docs/security.md)
- [ssuMCP deployment](https://github.com/ghdtjdwn/ssuMCP/blob/main/deploy/README.md)
