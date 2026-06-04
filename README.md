# 택시팟

Union SDK 기반 택시비 공유 미니앱입니다. 사용자는 같은 방향으로 이동할 택시팟을 만들고, 다른 사용자는 참여 신청을 보낼 수 있습니다. 방장이 신청자를 승인하면 승인자에게 오픈채팅 링크가 공개됩니다.

## 주요 기능

- 출발지, 도착지, 출발 시간 기반 택시팟 탐색
- 출발 시간 필터와 태그/검색 필터
- 택시팟 생성과 마감
- 참여 신청, 신청 취소, 방장 승인/거절
- 방장 포함 현재/만석 기준 예상 N분의1 택시비 표시
- 승인된 참가자에게만 오픈채팅 링크 공개
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
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 환경변수에만 둬야 합니다.

## Vercel 설정

프론트 빌드에서 API 주소를 사용하도록 아래 값을 등록합니다.

```text
VITE_API_BASE_URL=https://your-vercel-project.vercel.app
```

## Union 등록 정보

- 앱 이름: `택시팟`
- 앱 ID: `com.union.taxi-pot`
- 카테고리: `utility`
- 권한: `user.profile`, `device.storage`
- 키워드: `택시`, `카풀`, `정산`, `이동`, `캠퍼스`

## 빌드와 패키징

```bash
npm run build
npx union build
npx union validate
```

`npx union build`는 `.unionapp` 패키지를 생성합니다.
