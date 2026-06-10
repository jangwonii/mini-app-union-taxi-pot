import type { BridgeAdapter, BridgeModule, UnionEvent } from '../types';
/**
 * Bridge 레이턴시 측정 콜백 타입.
 * AnalyticsModule 이 install() 시 등록하며, analytics 모듈 자체 호출은 측정에서 제외됨.
 */
type PerfCallback = (metricName: string, valueMs: number) => void;
/** 커스텀 에러 클래스 */
export declare class UnionError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * 표준 UnionError 코드.
 *
 * `UnionError.code` 는 임의의 문자열일 수 있지만, 미니앱이 자주 분기하는 코드를
 * 타입 안전하게 다루도록 상수로 노출한다.
 *
 * @example
 * ```ts
 * try {
 *   await Union.device.getLocation();
 * } catch (e) {
 *   if (e instanceof UnionError && e.code === UnionErrorCode.PERMISSION_DENIED) {
 *     // 사용자가 권한을 거부함 → fallback UX
 *   }
 * }
 * ```
 */
export declare const UnionErrorCode: {
    /** 사용자가 권한을 거부했거나, 미니앱이 선언하지 않은 권한을 호출함. */
    readonly PERMISSION_DENIED: "PERMISSION_DENIED";
    /** 요청이 타임아웃됨. */
    readonly TIMEOUT: "TIMEOUT";
    /** 사용자가 작업을 취소함(모달 등). */
    readonly CANCELLED: "CANCELLED";
    /** 네트워크 오류. */
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    /** 분류되지 않은 오류. */
    readonly UNKNOWN: "UNKNOWN";
};
export type UnionErrorCode = (typeof UnionErrorCode)[keyof typeof UnionErrorCode];
/**
 * Bridge Core
 * SDK ↔ Native 간 메시지 패싱의 핵심 엔진.
 *
 * - 플랫폼 자동 감지 (iOS / Android / Mock)
 * - Promise 기반 요청-응답 매칭 (UUID v4)
 * - 30초 기본 타임아웃
 * - 네이티브 이벤트 수신 (CustomEvent)
 * - Bridge 호출 레이턴시 측정 (analytics 연동)
 */
export declare class BridgeCore {
    private pending;
    private eventListeners;
    readonly adapter: BridgeAdapter;
    private defaultTimeout;
    /**
     * analytics 모듈에서 등록하는 성능 측정 콜백.
     * analytics 모듈 자신의 요청(module === 'analytics')은 재귀 방지를 위해 측정에서 제외.
     */
    private perfCallback;
    constructor();
    /**
     * 네이티브 모듈 메서드 호출 (응답 대기).
     * 성공 응답 시 bridge_latency 를 perfCallback 으로 전달.
     *
     * @returns Promise<T> 네이티브 응답 데이터
     */
    invoke<T = unknown>(module: BridgeModule, action: string, params?: Record<string, unknown>, timeout?: number): Promise<T>;
    /**
     * fire-and-forget 방식 호출 (응답 불필요).
     * analytics.track, navigation.prefetch 등 응답을 기다릴 필요 없는 작업에 사용.
     */
    fire(module: BridgeModule, action: string, params?: Record<string, unknown>): void;
    /**
     * 네이티브 이벤트 구독.
     */
    on(event: UnionEvent, callback: (data?: unknown) => void): void;
    /**
     * 네이티브 이벤트 구독 해제.
     */
    off(event: UnionEvent, callback: (data?: unknown) => void): void;
    /**
     * Bridge 레이턴시 측정 콜백 등록.
     * AnalyticsModule.install() 에서 자동 호출됨.
     *
     * @internal
     */
    registerPerfCallback(callback: PerfCallback): void;
    private detectAdapter;
    private listenForResponses;
    private listenForEvents;
}
export {};
