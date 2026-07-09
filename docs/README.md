# Documentation Map

`ssuAI/docs/`는 사용자 경험과 제품 진행 기록의 기준 위치입니다. 서버 구현
계약과 운영 자료는 별도 저장소 `ssuMCP/docs/`가 소유합니다.

## Active Documents

| 문서 | 역할 |
| --- | --- |
| [product.md](product.md) | 현재 배포된 제품 표면, 인증 경계, 남은 범위 |
| [vision.md](vision.md) | 장기 목표와 단계별 로드맵 |
| [adr/](adr/) | 프론트엔드 및 챗봇 설계 결정 (0001·0006·0009·0010·0086·0087) |

> ADR 번호는 ssuMCP와 **공유 시퀀스**입니다. 프론트엔드는 0001·0006·0009·0010·0086·0087을 소유하고, 나머지 번호는 ssuMCP가 소유합니다 — 빠진 번호는 삭제가 아니라 다른 저장소 소유입니다. 신규 ADR 번호는 두 저장소에서 아직 예약·사용되지 않은 다음 번호를 사용합니다(0087 작성 시점 ssuMCP도 0087을 mirror ADR로 기록).

`architecture.md`, `mcp-tools.md`, `security.md`는 ADR의 상대 링크를
유지하기 위한 포인터 문서이며, 실제 내용의 기준은 ssuMCP입니다.

## Backend Sources Of Truth

- [ssuMCP architecture](https://github.com/hoeongj/ssuMCP/blob/main/docs/architecture.md)
- [ssuMCP MCP tools](https://github.com/hoeongj/ssuMCP/blob/main/docs/mcp-tools.md)
- [ssuMCP security](https://github.com/hoeongj/ssuMCP/blob/main/docs/security.md)
- [ssuMCP deployment](https://github.com/hoeongj/ssuMCP/blob/main/deploy/README.md)
