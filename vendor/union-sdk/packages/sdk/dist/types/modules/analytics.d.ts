import type { BridgeCore } from '../core/bridge';
import type { EventParams } from '../types';
/**
 * Analytics Module — 사용자 행동 트래킹
 *
 * @example
 * ```ts
 * Union.analytics.trackPageView('home');
 * Union.analytics.trackEvent('button_click', { buttonId: 'signup' });
 * ```
 */
export declare class AnalyticsModule {
    private bridge;
    constructor(bridge: BridgeCore);
    /** 커스텀 이벤트 트래킹 */
    trackEvent(eventName: string, params?: EventParams): void;
    /** 페이지 뷰 트래킹 */
    trackPageView(pageName: string): void;
}
