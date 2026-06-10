import { AuthModule } from './modules/auth';
import { UIModule } from './modules/ui';
import { DeviceModule } from './modules/device';
import { StorageModule } from './modules/storage';
import { AnalyticsModule } from './modules/analytics';
import { NavigationModule } from './modules/navigation';
import { NotificationModule } from './modules/notification';
import type { UnionEvent, RequestOptions, RequestResult } from './types';
export type * from './types';
export { UnionError, UnionErrorCode } from './core/bridge';
/**
 * Union SDK
 *
 * 미니앱이 슈퍼앱의 네이티브 기능에 접근하기 위한 Bridge SDK.
 *
 * @example
 * ```ts
 * import Union from '@union-miniapp/sdk';
 *
 * // 로그인
 * await Union.auth.login();
 *
 * // 토스트 표시
 * Union.ui.showToast({ message: '안녕하세요!' });
 *
 * // 커스텀 이벤트 트래킹
 * Union.analytics.trackEvent('join_club', { clubId: 'soccer_001' });
 *
 * // 전환 이벤트
 * Union.analytics.trackConversion('ticket_purchase', { value: 5000, currency: 'KRW' });
 * ```
 */
declare const Union: {
    /** 인증 모듈 */
    readonly auth: AuthModule;
    /** UI 모듈 */
    readonly ui: UIModule;
    /** 디바이스 모듈 */
    readonly device: DeviceModule;
    /** 저장소 모듈 */
    readonly storage: StorageModule;
    /** 애널리틱스 모듈 */
    readonly analytics: AnalyticsModule;
    /** 네비게이션 모듈 (네이티브 페이지 스택) */
    readonly navigation: NavigationModule;
    /** 알림 모듈 (권한/로컬알림/구독/원격 푸시 수신) */
    readonly notification: NotificationModule;
    /** HTTP 요청 (mTLS 인증 자동 적용) */
    readonly request: (options: RequestOptions) => Promise<RequestResult>;
    /** SDK 버전 */
    readonly version: "1.2.0";
    /** 현재 플랫폼 ('ios' | 'android' | 'mock') */
    readonly platform: "ios" | "android" | "mock";
    /** 네이티브 이벤트 구독 */
    readonly on: (event: UnionEvent, callback: (data?: unknown) => void) => void;
    /** 네이티브 이벤트 구독 해제 */
    readonly off: (event: UnionEvent, callback: (data?: unknown) => void) => void;
};
export default Union;
