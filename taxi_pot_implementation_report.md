# 택시팟 미니앱 개발 보고

## 1. 택시팟 미니앱 신규 프로젝트 구현

- `union-taxi-pot` 프로젝트 신규 생성
- 기존 `union-study-mate` 구조를 기반으로 Vite + React + TypeScript + Vercel Functions 구성
- Union 미니앱 등록 정보 설정
  - appId: `com.union.taxi-pot`
  - name: `택시팟`
  - category: `utility`
  - permissions: `user.profile`, `device.storage`

---

## 2. 택시팟 백엔드 API 구현

**택시팟 API**
- `GET /api/pots` — 열린 택시팟 목록 조회
- `POST /api/pots` — 택시팟 생성
- `GET /api/pots/{id}` — 택시팟 상세 조회
- `PATCH /api/pots/{id}` — 택시팟 마감 처리

**참여 신청 API**
- `POST /api/pots/{id}/join-requests` — 택시팟 참여 신청
- `PATCH /api/join-requests/{id}` — 신청 승인 / 거절 / 취소
- `GET /api/me/pots` — 내가 만든 택시팟과 내 참여 신청 조회

**검증 로직**
- 방장 본인 팟 신청 차단
- 중복 신청 차단
- 마감된 팟 신청 차단
- 출발 시간이 지난 팟 신청 차단
- 방장 포함 정원 초과 승인 차단
- 승인된 참가자와 방장에게만 오픈채팅 링크 공개

---

## 3. Supabase 데이터 모델 구현

**`taxi_pots` 테이블**
- 출발지, 도착지, 출발 예정 시각
- 예상 택시비, 총 탑승 인원
- 설명, 태그, 오픈채팅 링크
- 방장 userId / nickname
- 상태: `open`, `closed`

**`join_requests` 테이블**
- 택시팟 ID
- 신청자 userId / nickname
- 신청 메시지
- 상태: `pending`, `accepted`, `rejected`, `canceled`
- `(pot_id, requester_user_id)` unique 제약으로 중복 신청 방지

---

## 4. 프론트엔드 화면 구현

**탐색 화면**
- 첫 화면을 바로 택시팟 탐색 화면으로 구성
- 출발지 / 도착지 / 태그 검색
- 출발 시간 필터: 전체, 2시간 이내, 오늘, 내일
- 추천 태그 필터: 공항, 터미널, 기숙사, 야간, 등교, 하교, 역
- 빈 상태 / 오류 상태 표시

**택시팟 생성 화면**
- 출발지, 도착지, 출발 시각 입력
- 예상 택시비, 총 탑승 인원 입력
- 설명, 태그, 오픈채팅 링크 입력
- 만석 기준 1인 예상 금액 미리보기

**상세 화면**
- 경로, 출발 시간, 탑승 현황 표시
- 현재 인원 기준 / 만석 기준 예상 N분의1 금액 표시
- 참여 신청, 신청 취소
- 방장 신청 승인 / 거절
- 승인 후 오픈채팅 링크 공개

---

## 5. Union SDK 연동

- `Union.auth.getUserProfile()` — 사용자 프로필 조회
- `Union.storage.get/set()` — 검색 필터 저장
- `Union.ui.setNavigationBar()` — 네이티브 내비게이션 제목 설정
- `Union.ui.showToast()` — 성공 / 실패 메시지 표시
- `Union.ui.showModal()` — 승인 / 거절 / 마감 확인
- `Union.ui.showLoading()` / `hideLoading()` — 제출 중 로딩 표시
- `Union.analytics.trackPageView()` / `trackEvent()` — 화면 진입 및 주요 행동 기록
- `Union.request()` — Vercel API 호출

---

## 6. UI 개선

- 택시 이모티콘 `🚕`을 히어로, 로딩, 빈 상태, CTA, 카드 요소에 적용
- 노란 택시 포인트 컬러와 짙은 청록색 CTA 조합 적용
- 경로 표시 UI 개선: 출발 / 도착 라벨 분리
- 카드, 탭, 검색창, 필터, 요금 미리보기 영역 시각 개선
- 360px 모바일 폭 대응을 위한 폼 단일 컬럼 전환 유지

---

## 7. 빌드 및 검증

- TypeScript 타입체크 통과
- Vite 프로덕션 빌드 통과
- Union 패키징 완료
  - `com.union.taxi-pot-1.0.0.unionapp`
- Union validate 통과
  - 번들 사이즈: 약 173KB / 2MB
  - 업로드 가능 상태
  - 번들 내부 `innerHTML` 관련 경고 2건 존재, 앱 코드 직접 사용은 아님

---

## 다음 작업 예정

- Supabase 실제 프로젝트 연결
- `schema.sql` 적용 후 API 시나리오 테스트
- Vercel 배포 및 `VITE_API_BASE_URL` 배포 주소로 변경
- 실제 Union 앱 WebView에서 `.unionapp` 실행 테스트
