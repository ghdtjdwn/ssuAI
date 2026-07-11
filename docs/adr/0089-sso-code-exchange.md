# ADR 0089 — SSO 콜백 세션 발급을 authorization-code 교환으로 전환

- **Status**: Accepted — 구현
- **Date**: 2026-07-12
- **Scope**: `proxy.ts`(삭제), `lib/api/auth.ts`, `app/auth/return/page.tsx`,
  `components/auth/AuthReturnContent.tsx`, `app/auth/login/page.tsx`,
  `app/auth/return/page.test.tsx`, `lib/api/auth.test.ts`
- **연관**: ssuMCP `POST /api/auth/exchange`(병행 구현), ssuMCP ADR 0092(멀티포드 MCP 세션 어피니티:
  Traefik sticky 쿠키), commit `8ef5bad`(`/`, `/chat` force-dynamic 캐시 우회)

## 배경

SmartID SSO 로그인 이후 브라우저가 `ssuai_refresh` 쿠키를 받지 못해 로그인이 항상 "세션을
만들지 못했어요"로 끝나는 장애가 있었다.

repo 루트의 `proxy.ts`가 `/api/auth/saint/sso-callback`을 가로채 백엔드를 서버사이드로 호출하고,
백엔드가 내려준 `Set-Cookie`를 `response.cookies.set()`으로 다시 발급하는 구조였다. 처음 세운
가설은 Vercel의 범용 rewrite(`next.config.ts`의 `/api/:path*`)가 쿠키를 제대로 통과시키지 못한다는
것이었지만, 실제로 확인해 보니 원인은 다른 곳에 있었다.

`backendRes.headers.get("set-cookie")`는 백엔드 응답에 실린 **여러 개의 Set-Cookie 헤더를 ", "로
합쳐서** 반환한다. 그런데 이 백엔드 앞단의 Traefik이 모든 응답에 자신의 sticky 세션 쿠키
`mcp_lb_affinity`(ssuMCP ADR 0092)를 함께 붙인다. `proxy.ts`는 합쳐진 문자열의 첫 세미콜론 이전
구간(`parts[0]`)만 쿠키 이름/값으로 파싱했는데, 헤더 결합 순서상 이 자리를 `mcp_lb_affinity`가
차지해 버려서 브라우저는 `Path=/api/auth`에 중복 스코프된 `mcp_lb_affinity`만 받고 정작
`ssuai_refresh`는 받지 못했다. 여기에 더해 "Fix A"(백엔드가 302 대신 200 + Set-Cookie로 응답하게
바꾸기) 이전에는 `proxy.ts`의 302 분기가 쿠키를 아예 복사하지 않는 별도 결함도 있었다.

## 검토한 대안

### A. `proxy.ts`의 파싱을 `getSetCookie()`로 교체

Fetch API의 `Headers.getSetCookie()`로 여러 Set-Cookie 헤더를 배열로 분리해 받으면 이번 파싱
버그 자체는 고칠 수 있다. 기각했다 — 프론트엔드 서버가 백엔드의 쿠키를 대신 파싱해서 재발급하는
구조 자체가 이미 두 번(302 분기 무복사, 다중 헤더 병합 파싱) 깨졌던 취약한 relay 계층이고, 이
계층이 살아있는 한 프론트엔드가 백엔드 쿠키 내부 형식(이름, 속성, 다중 헤더 유무)에 계속
결합된다.

### B. 백엔드가 rewrite를 통해 200 + Set-Cookie를 직접 내려주기

`proxy.ts` 자체를 없애고 `/api/auth/saint/sso-callback`을 `next.config.ts`의 범용
`/api/:path*` rewrite에 맡겨, 백엔드가 직접 200 + `Set-Cookie`로 응답하게 하는 방법도 검토했다.
기각했다 — Vercel rewrite를 통과하는 리다이렉트/스트리밍 응답의 쿠키 통과 특성은 이번 장애의
발단이 된 첫 가설이었을 만큼 계약으로 보장되지 않는 영역이라, 다시 이 경로에 쿠키 전달을
맡기면 같은 종류의 불확실성이 반복된다.

### C. authorization-code 교환 (채택)

백엔드 콜백은 더 이상 세션 쿠키를 직접 발급하지 않고, `/auth/return?code=<1회용 코드>`로
리다이렉트만 한다. 프론트엔드는 같은 오리진의 `POST /api/auth/exchange`로 그 코드를 교환하고,
백엔드는 리다이렉트가 아닌 평범한 200 응답에 `Set-Cookie`를 실어 돌려준다. 이 방식을 택한
이유는, 리다이렉트로는 민감한 값(1회용 코드는 탈취돼도 즉시 무효화되는 값일 뿐)만 흐르고, 쿠키는
이미 라이브러리 로그인에서 검증된 경로인 "same-origin, non-redirect 200 응답"으로만 설정되기
때문이다. 프론트엔드는 더 이상 백엔드의 Set-Cookie 헤더를 직접 파싱하거나 재발급하지 않는다.

## 결정

1. `proxy.ts`를 삭제한다. `/api/auth/saint/sso-callback`은 `next.config.ts`의 범용 `/api/:path*`
   rewrite로 그대로 백엔드까지 전달된다 — 이 경로는 브라우저가 직접 리다이렉트를 타는 구간이라
   쿠키 relay가 필요 없다.
2. `lib/api/auth.ts`에 `exchangeAuthCode(code)`를 추가한다. `refreshAccessToken`과 동일하게
   `credentials: "include"`로 호출하고, 백엔드는 같은 `ApiResponse<RefreshResponse>` envelope에
   `Set-Cookie`를 실어 응답한다. 코드가 유효하지 않거나 만료·재사용된 경우 401.
3. `app/auth/return/page.tsx`는 `code` 쿼리 파라미터가 있으면 `exchangeAuthCode` → 기존
   `refresh()`(=/me 조회 + 인증 상태 채움) 순서로 처리한다. 교환 실패는 치명적이지 않다 —
   이미 소비된 코드로 `/auth/return`을 새로고침한 사용자는 첫 교환에서 발급된 유효한 refresh
   쿠키를 이미 갖고 있으므로, 교환이 401이어도 `refresh()`를 그대로 한 번 시도하고
   `refresh()`까지 실패했을 때만 기존 "세션을 만들지 못했어요" 실패 UI를 재사용한다. 기존
   `ok=1` / `lms_ok=1` 분기(레거시 백엔드 및 LMS 리턴 경로)는 그대로 남겨 배포 전환 구간에서도
   동작하게 한다.
4. 1회용 코드 교환은 React StrictMode의 effect 중복 실행에도 한 번만 나가야 한다 — 같은 코드로
   두 번째 POST를 보내면 401이 나서 방금 성공한 로그인이 실패로 잘못 표시된다.
   `hooks/useSaintAuth.tsx`의 `refreshInFlight` 패턴과 동일하게, 진행 중인 교환 Promise를 ref에
   저장해 두 번째 effect 실행이 새 요청을 보내지 않고 같은 Promise를 기다리게 한다.
5. 코드 값은 로그·렌더링 어디에도 노출하지 않는다.

## 동작 방식 — force-dynamic 캐시 우회

`app/auth/return/page.tsx`, `app/auth/login/page.tsx`는 정적 생성 페이지라 Vercel edge가 오래된
HTML shell을 캐시해 배포 후에도 죽은 JS 청크 해시를 참조하는 문제가 있었다. `/`, `/chat`에 이미
같은 클래스의 버그를 고친 적이 있다(`8ef5bad`, force-dynamic 추가). 이번에 두 인증 페이지에도
동일하게 `export const dynamic = "force-dynamic"`을 추가해 매 요청마다 최신 번들을 참조하는
HTML을 새로 렌더링하게 한다. `/auth/return`은 SSO 직후 가장 먼저 도달하는 페이지라 이 문제의
영향이 특히 크다.

주의: Next.js의 route segment config(`dynamic` 등)는 **`"use client"` 모듈에서는 조용히
무시된다**. `/auth/return` 페이지는 원래 파일 전체가 클라이언트 컴포넌트였기 때문에 export만
추가해서는 빌드 route table에 `○`(static)로 남았다(`/chat`은 서버 페이지라 `8ef5bad`가 그대로
통했다). 그래서 `page.tsx`는 서버 컴포넌트로 남겨 segment config와 레이아웃 shell·`<Suspense>`
경계만 갖게 하고, 인터랙티브 로직 전부(`AuthReturnContent`, `PendingLine`, 에러 메시지 맵)는
`components/auth/AuthReturnContent.tsx`(클라이언트)로 분리했다 — `/chat`의
`page.tsx`(서버) + `components/chat/ChatPanel`(클라이언트) 구조와 동일한 관례다. 빌드 route
table에서 `ƒ /auth/return`(dynamic)을 확인했다.

## 검증

- `code` 파라미터가 있으면 `exchangeAuthCode`가 정확히 1회 호출되고(React StrictMode의 중복
  effect 실행에서도 1회), 성공 시 `refresh()` → `/`로 이동한다.
- 코드 교환이 실패해도 `refresh()`가 성공하면(이미 소비된 코드 재로드) 정상적으로 `/`로
  이동한다. 교환과 `refresh()`가 모두 실패했을 때만 실패 UI가 뜬다. 교환은 성공했지만
  `refresh()`가 `false`를 반환한 경우에도 실패 UI가 뜬다.
- `ok=1` / `lms_ok=1` 레거시 경로는 `exchangeAuthCode`를 호출하지 않고 기존처럼 `refresh()`만
  호출한다.
- 코드 값은 DOM 어디에도 렌더링되지 않는다.
- 아무 파라미터도 없으면 기존과 동일하게 일반 실패 메시지를 보여준다.
