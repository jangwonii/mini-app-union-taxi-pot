# Union 미니앱 인증 연동 가이드 (publisher 백엔드)

택시팟처럼 **자체 백엔드를 가진 미니앱**이 Union 사용자 신원을 검증하는 방법.

## 핵심 변경 (왜 바뀌었나)

이전에는 `Union.auth.getAccessToken()`이 **사용자의 Union 세션 토큰**을 그대로 넘겨줬다. 그 토큰은
Union 1st-party API 전체를 인증할 수 있는 자격증명이라, publisher 손에 들어가면 사용자 행세로
재사용(replay)될 수 있었다(token confusion).

이제는 **미니앱 전용 ID 토큰**(RS256)을 발급한다:

- `Union.auth.getIdToken()` (구 `getAccessToken` 은 동일 토큰을 반환하는 deprecated alias)
- `aud` 가 **이 미니앱의 appId** 로 한정 → Union API 에는 통하지 않고, 다른 미니앱 백엔드에서도 거부됨
- publisher 는 **JWKS 공개키로만 검증** (시크릿 공유 없음). 사용자 세션 토큰은 native 밖으로 안 나감

## 검증에 필요한 6개 값

| 항목 | 값 |
|------|----|
| **1. JWKS URL** | `https://union-api-183092809276.asia-northeast3.run.app/.well-known/jwks.json` |
| **2. issuer (iss)** | `https://union-api-183092809276.asia-northeast3.run.app` |
| **3. audience (aud)** | 미니앱 appId — 택시팟은 `com.union.taxi-pot` (`union.config.json` 의 appId) |
| **4. 사용자 ID claim** | `sub` (UUID) |
| **5. 닉네임 claim** | `nickname` — 사용자가 `user.profile` 권한에 동의한 경우에만 포함 |
| **6. 서명 알고리즘** | `RS256` |

> issuer/JWKS URL 은 Union 백엔드의 `IDTOKEN_ISSUER` 설정과 일치한다. 환경(스테이징/프로덕션)에
> 따라 호스트가 다르면 그에 맞춰 `UNION_ISSUER` / `UNION_JWKS_URL` 을 조정한다.

추가로 들어올 수 있는 claim: `email`(user.email 동의 시), `university`(user.university 동의 시),
`token_use: "id"`, `iat`, `exp`.

## 환경 변수

```bash
UNION_JWKS_URL=https://union-api-183092809276.asia-northeast3.run.app/.well-known/jwks.json
UNION_ISSUER=https://union-api-183092809276.asia-northeast3.run.app
UNION_AUDIENCE=com.union.taxi-pot
```

세 값이 모두 설정되면 프로덕션 서명 검증이 활성화된다. 미설정 시(로컬 `npm run dev`, Union dev mock)
서명 검증 없이 토큰 payload 만 신뢰한다.

## 검증 코드 (jose) — `api/_lib/http.ts`

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(process.env.UNION_JWKS_URL!));

const { payload } = await jwtVerify(token, JWKS, {
  issuer: process.env.UNION_ISSUER,
  audience: process.env.UNION_AUDIENCE,   // ← aud 불일치 토큰은 여기서 거부됨
});

const userId = payload.sub;               // 신뢰 가능한 사용자 식별자
const nickname = payload.nickname;        // user.profile 동의 시 존재
```

**신원은 토큰 claim 에서만 도출한다.** 클라이언트가 보내는 헤더(예전의 `X-Union-User-Id`)는 절대
신뢰하지 않는다 — 위조 가능하기 때문.

## 주의사항

- **nickname 은 동의 의존적**이다. 사용자가 `user.profile` 을 거부하면 `nickname` claim 이 없다.
  닉네임을 화면/DB 에 쓰는 경우 빈 값 fallback 을 준비할 것. (`sub` 은 항상 존재)
- ID 토큰은 단명(기본 1h)이다. native(앱)가 만료 임박 시 자동 재발급하므로 미니앱 코드는
  매 요청마다 `getIdToken()` 을 호출하면 된다(내부 캐시됨).
- 미니앱 프론트는 `Authorization: Bearer <idToken>` 만 보내면 된다.

## 프론트 사용 예 — `src/api.ts`

```ts
import Union from '@union-miniapp/sdk';

const idToken = await Union.auth.getIdToken();
await Union.request({
  url: '/api/pots',
  method: 'GET',
  headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
});
```
