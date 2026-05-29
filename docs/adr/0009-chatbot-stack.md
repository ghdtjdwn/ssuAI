# ADR 0009 — MVP 챗봇 스택 및 Fallback 예산

- **Status**: Accepted (`feat/chatbot-slice` 머지 완료; 챗봇 <https://ssuai.vercel.app/chat> 에서 9개 프로바이더 fallback으로 라이브)
- **Date**: 2026-05-12
- **Scope**: 이 저장소의 `app/chat/`과 ssuMCP의 `src/main/java/com/ssuai/domain/chat/`, LLM 프로바이더 설정, 챗 도구 사용

## 맥락

MVP 제품 범위에 공개 캠퍼스 데이터(학식, 기숙사 식단, 교내 시설)를 위한 기본 텍스트 챗봇이 포함된다. 이 프로젝트에는 이미 같은 서비스 레이어를 기반으로 한 REST 엔드포인트와 MCP 서버가 있다. 챗봇은 인증된 학교 데이터나 write 도구를 도입하지 않고 그 작업을 재사용해야 한다.

초안에서는 Anthropic/Spring AI ChatClient 단일 경로를 가정했다. 구현 과정에서 프로바이더 할당량과 프라이버시 제약이 공개 데모에서 단일 프로바이더 선택을 취약하게 만들었다. 따라서 구현에는 소규모 프로바이더 추상화와 명시적 요청 수준 예산 제한이 필요하다.

## 결정

Spring `RestClient` 위에 커스텀 OpenAI 호환 프로바이더 레이어를 사용한다.

- `MockChatService`가 `dev`와 `test`의 기본값이다.
- `LlmChatService`는 `ssuai.connector.chat=llm`으로 활성화된다.
- 프로덕션 manifest는 chat을 기본적으로 `mock`으로 설정한다. 호스팅 LLM 모드는 API 키와 할당량을 설정한 후 운영자가 명시적으로 선택한다.
- 프로바이더 순서는 설정 기반이다.
- API 키가 없는 프로바이더는 요청 시도 전에 건너뛴다.
- Fallback은 다음으로 제한된다:
  - `SSUAI_LLM_MAX_TOKENS`
  - `SSUAI_LLM_AVAILABILITY_VERIFICATION_PASSES`
  - `SSUAI_LLM_MAX_PROVIDER_ATTEMPTS`
  - `SSUAI_LLM_MAX_MODELS_PER_PROVIDER`
  - `SSUAI_LLM_MAX_TOOL_CALLS`
- 기존 `MealMcpTools`, `DormMcpTools`, `CampusMcpTools` 빈은 채팅 서비스에서 직접 호출된다.
- 도구 결과는 LLM에 전달하기 전에 compact 처리된다.

## 결과

**장점**

- CI와 로컬 개발이 기본적으로 완전히 오프라인으로 유지된다.
- 하나의 채팅 구현이 여러 OpenAI 호환 프로바이더를 사용할 수 있다.
- 프로바이더 실패가 메시지 본문이나 시크릿을 로깅하지 않고도 분리·관찰 가능하다.
- 요청 수준 상한이 한 사용자 질문에서 출력 토큰·프로바이더/모델 fallback·도구 결과 fan-out이 무한으로 늘어나는 것을 방지한다.
- 챗봇과 MCP 서버가 여전히 동일한 서비스 기반 도구 빈을 공유한다.

**트레이드오프**

- 챗봇에서 MCP 클라이언트 프로토콜을 아직 self-dogfood하지 않는다.
- 프로바이더별 동작은 코드에서 여전히 정규화해야 한다.
- 지속적인 채팅 메모리가 없다. 대화 상태는 `conversationId` 라운드트립과 현재 메시지만이다.

## 검토한 대안

- **Spring AI ChatClient + Anthropic only** — API가 단순하지만, 하나의 키/할당량이 데모의 단일 장애점이 된다.
- **OpenRouter only** — 쉬운 fallback 문법이지만, 계정 수준 무료 할당량과 프라이버시/ZDR 지원이 가용성을 여전히 제한한다.
- **같은 JVM 내 MCP client dogfooding** — 더 강한 포트폴리오 스토리지만, MVP로는 너무 큰 변동 요소다. GitOps 이후 후속 작업으로 유지.
- **로컬 모델** — 호스팅 프로바이더 데이터 정책 우려를 피하지만, 현재 무료 티어 인프라와 리뷰어 경험에 비해 너무 무겁다.
