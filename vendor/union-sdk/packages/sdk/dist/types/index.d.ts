import { AuthModule } from './modules/auth';
import { UIModule } from './modules/ui';
import { DeviceModule } from './modules/device';
import { StorageModule } from './modules/storage';
import { AnalyticsModule } from './modules/analytics';
import type { UnionEvent, RequestOptions, RequestResult } from './types';
export type * from './types';
export { UnionError } from './core/bridge';
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
 * // HTTP 요청 (mTLS 자동 적용)
 * const result = await Union.request({ url: '/api/data', method: 'GET' });
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
    /** HTTP 요청 (mTLS 인증 자동 적용) */
    readonly request: (options: RequestOptions) => Promise<RequestResult>;
    /** SDK 버전 */
    readonly version: "1.0.0";
    /** 현재 플랫폼 ('ios' | 'android' | 'mock') */
    readonly platform: "ios" | "android" | "mock";
    /** 네이티브 이벤트 구독 */
    readonly on: (event: UnionEvent, callback: (data?: unknown) => void) => void;
    /** 네이티브 이벤트 구독 해제 */
    readonly off: (event: UnionEvent, callback: (data?: unknown) => void) => void;
};
export default Union;
