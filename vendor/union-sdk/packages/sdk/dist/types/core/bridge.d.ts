import type { BridgeAdapter, BridgeModule, UnionEvent } from '../types';
/** 커스텀 에러 클래스 */
export declare class UnionError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Bridge Core
 * SDK ↔ Native 간 메시지 패싱의 핵심 엔진.
 *
 * - 플랫폼 자동 감지 (iOS / Android / Mock)
 * - Promise 기반 요청-응답 매칭
 * - 타임아웃 처리
 * - 네이티브 이벤트 수신
 */
export declare class BridgeCore {
    private pending;
    private eventListeners;
    readonly adapter: BridgeAdapter;
    private defaultTimeout;
    constructor();
    /**
     * 네이티브 모듈 메서드 호출
     * @returns Promise<T> 네이티브 응답 데이터
     */
    invoke<T = unknown>(module: BridgeModule, action: string, params?: Record<string, unknown>, timeout?: number): Promise<T>;
    /**
     * fire-and-forget 방식 호출 (응답 불필요)
     */
    fire(module: BridgeModule, action: string, params?: Record<string, unknown>): void;
    /**
     * 네이티브 이벤트 구독
     */
    on(event: UnionEvent, callback: (data?: unknown) => void): void;
    /**
     * 네이티브 이벤트 구독 해제
     */
    off(event: UnionEvent, callback: (data?: unknown) => void): void;
    private detectAdapter;
    private listenForResponses;
    private listenForEvents;
}
