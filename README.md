# 택시팟

Union SDK 기반 택시비 공유 미니앱입니다. 사용자는 같은 방향으로 이동할 택시팟을 만들고, 다른 사용자는 참여 신청을 보낼 수 있습니다. 방장이 신청자를 승인하면 승인자에게 오픈채팅 링크가 공개됩니다.

## 주요 기능

- 출발지, 도착지, 출발 시간 기반 택시팟 탐색
- 출발 시간 필터와 태그/검색 필터
- 택시팟 생성과 마감
- 참여 신청, 신청 취소, 방장 승인/거절
- 방장 포함 현재/만석 기준 예상 N분의1 택시비 표시
- 혼자 탑승 대비 절약액과 만석 시 추가 절약 가능액 표시
- 승인된 참가자에게만 오픈채팅 링크 공개
- 참여 신청, 승인/거절, 취소, 마감 인앱 알림함
- 출발 임박, 절약액, 자리 여유 기준 탐색 정렬
- Union SDK 프로필, 스토리지, 네이티브 UI, 애널리틱스, 네트워크 요청 사용

## 로컬 실행

```bash
npm install
npm run dev
```

로컬 브라우저에서는 Union SDK mock bridge가 동작합니다. API까지 테스트하려면 Supabase 환경변수를 `.env.local`에 넣고 Vercel dev 또는 배포 URL을 사용하세요.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Vercel 환경변수에 아래 값을 등록합니다.

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ALLOWED_ORIGIN=*
UNION_JWKS_URL=https://union-api-183092809276.asia-northeast3.run.app/.well-known/jwks.json
UNION_ISSUER=https://union-api-183092809276.asia-northeast3.run.app
UNION_AUDIENCE=com.union.taxi-pot
UNION_API_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 환경변수에만 둬야 합니다.

## 푸시 알림

참여 신청/승인/거절/취소/마감 시 인앱 알림함에 기록하면서, 동시에 Union 백엔드(`POST /api/v1/publishers/notifications`)로 **해당 사용자에게만** 타겟 푸시를 발송합니다(`targetUserIds`). 사용자 ID는 ID 토큰의 `sub` claim(Union user UUID)을 그대로 사용합니다.

- `UNION_API_KEY`: Union 대시보드에서 발급한 `notifications:send` scope API 키. 서버 환경변수에만 둡니다.
- 미설정이면 푸시는 건너뛰고 인앱 알림만 동작합니다.
- 수신자가 택시팟을 구독 중이고 푸시를 켠 경우에만 실제 발송됩니다(Union 백엔드에서 검증).
- 전체 구독자 공지에는 `sendUnionBroadcastNotification`을 사용합니다.

## Vercel 설정

프론트 빌드에서 API 주소를 사용하도록 아래 값을 등록합니다.

```text
VITE_API_BASE_URL=https://your-vercel-project.vercel.app
```

## Union 등록 정보

- 앱 이름: `택시팟`
- 앱 ID: `com.union.taxi-pot`
- 카테고리: `utility`
- 권한: `user.profile`
- 연락처: `weun2002@dankook.ac.kr`
- 키워드: `택시`, `카풀`, `정산`, `이동`, `캠퍼스`

## 인증

프론트엔드는 `Union.auth.getIdToken()`으로 받은 미니앱 전용 ID 토큰을 `Authorization: Bearer ...` 헤더에 담아 API를 호출합니다. 구 SDK 환경에서는 deprecated alias인 `getAccessToken()`을 fallback으로 사용합니다.

서버는 `UNION_JWKS_URL`, `UNION_ISSUER`, `UNION_AUDIENCE`가 모두 설정되면 RS256/JWKS 기반으로 ID 토큰을 검증하고, 사용자 ID는 토큰의 `sub` claim에서 가져옵니다. 닉네임은 `nickname` claim을 사용하며 없으면 `sub` 기반 fallback을 사용합니다. 클라이언트가 보내는 사용자 헤더는 production 인증에 사용하지 않습니다.

`UNION_JWKS_URL`은 publisher 백엔드에서 인증 없이 접근 가능해야 합니다. JWKS 응답이 401이면 ID 토큰 검증도 실패합니다.

## 빌드와 패키징

```bash
npm run build
npx union build
npx union validate
```

`npx union build`는 `.unionapp` 패키지를 생성합니다.
