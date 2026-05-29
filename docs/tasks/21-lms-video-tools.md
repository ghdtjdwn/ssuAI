# Task 21 — LMS 동영상 도구 (다운로드 · 오디오 추출 · 자막 추출 · STT)

> 생성일: 2026-05-28. Task 17(LMS 과제 조회)이 LMS 인증과 세션 스토어를
> 확립했으므로 그 위에 동영상 관련 기능을 추가하는 자연스러운 후속 범위다.
> 강의 영상 콘텐츠를 텍스트로 만들어 학습 효율을 높이는 것이 목표.

## Status

- 🗂 계획 중 — 설계 미시작

## 1. Goal

LMS에 업로드된 강의 동영상을 학생이 **텍스트로 접근**할 수 있도록 4가지
MCP tool을 ssuMCP에 추가한다.

1. `download_lms_video` — LMS 강의 동영상 다운로드 (세션 인증 후 스트림 수신)
2. `extract_audio` — 동영상 파일에서 오디오 트랙 추출 (ffmpeg)
3. `extract_subtitles` — 동영상 내장 자막 또는 LMS 제공 자막 파일 추출
4. `transcribe_video` — 오디오/동영상에서 음성 → 텍스트 변환 (Whisper)

## 2. 작업 순서 (순차 의존)

```
[선결] LMS 동영상 URL 구조 스파이크
  → 재생 시 Network 탭에서 실제 요청 URL 확인
  → HLS(.m3u8) vs 직접 .mp4 vs DRM 여부 판단

Step 1. download_lms_video
  - LMS 세션 쿠키(LmsSessionStore, Task 17 기반)로 인증
  - yt-dlp 또는 ffmpeg subprocess로 스트림 저장
  - DRM 걸린 경우 → 불가, 사용자에게 안내

Step 2. extract_audio
  - ffmpeg -i <video> -vn <output.mp3>
  - Step 1과 독립적으로도 로컬 파일 입력 지원 가능

Step 3. extract_subtitles
  - 내장 자막: ffmpeg으로 추출
  - 플랫폼 제공 자막(URL): LMS 응답 파싱으로 .srt/.vtt 파일 다운로드
  - 자막 없는 경우 → Step 4(STT)로 대체 안내

Step 4. transcribe_video (STT)
  - 의존: Step 2 (오디오 추출 결과)
  - OpenAI Whisper API 또는 faster-whisper 로컬 실행
  - 한국어 강의 지원 필수
```

## 3. 열린 질문 (스파이크 전 미결)

- LMS 동영상이 HLS인지, 직접 MP4인지, DRM 적용 여부
- ffmpeg 서버 설치 여부 (Oracle K3s 환경)
- Whisper API 비용 vs faster-whisper 로컬 GPU/CPU 자원
- 파일 크기 제한 — 강의 1시간 = 수백MB, MCP 응답 방식 검토 필요
- LMS 이용약관 검토 (개인 학습 목적 사용 범위)

## 4. Non-goals

- ❌ DRM 우회 — Widevine 등 걸린 영상은 다운로드 불가, 시도하지 않음
- ❌ 영상 자동 업로드 / 외부 서비스 전송
- ❌ LMS 강의 외 외부 동영상 지원 (이 태스크 범위 아님)

## 5. 관련 태스크

- Task 17 — LMS 인증 세션 스토어 (선행 의존)
- ADR 0017 — rusaint FFI 패턴 (참고)
