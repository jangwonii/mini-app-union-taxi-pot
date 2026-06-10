import type { BridgeCore } from '../core/bridge';
import type { EventParams, ErrorContext, ConversionParams, UserPropertyValue } from '../types';
/** bridge_latency 샘플링 비율 (0.0 ~ 1.0). 모든 호출을 추적하면 과부하 */
declare const BRIDGE_LATENCY_SAMPLE_RATE = 0.2;
/**
 * Analytics Module — 사용자 행동, 성능, 에러 트래킹
 *
 * ## 자동 수집 (install() 호출 시 활성화)
 * - JS 전역 에러 (`window.onerror`)
 * - 미처리 Promise rejection (`unhandledrejection`)
 * - Core Web Vitals: FCP, LCP (`PerformanceObserver`)
 * - Navigation Timing: dom_content_loaded, page_load
 * - Bridge 호출 레이턴시 (20% 샘플링)
 *
 * ## 수동 수집
 * - `trackEvent()` — 커스텀 이벤트
 * - `trackPageView()` — 화면 전환
 * - `trackError()` — 명시적 에러 리포팅
 * - `trackConversion()` — 전환 이벤트
 * - `setUserProperty()` — 사용자 속성
 *
 * ## 보안
 * - 이벤트 파라미터에서 이메일/전화/주민번호/카드번호 패턴 자동 마스킹
 * - 이벤트명은 `/^[a-z][a-z0-9_]+$/` 형식만 허용 (SQL injection 방지)
 * - 실제 전송 및 PII 필터링의 최종 책임은 네이티브 레이어에 있음
 *
 * @example
 * ```ts
 * Union.analytics.trackPageView('home');
 * Union.analytics.trackEvent('button_click', { buttonId: 'signup' });
 * Union.analytics.trackConversion('ticket_purchase', { value: 5000, currency: 'KRW' });
 * ```
 */
export declare class AnalyticsModule {
    private readonly bridge;
    private installed;
    private perfObserver;
    private readonly boundGlobalErrorHandler;
    private readonly boundRejectionHandler;
    constructor(bridge: BridgeCore);
    /**
     * 커스텀 이벤트 트래킹.
     *
     * @param eventName - 이벤트명 (`[a-z][a-z0-9_]+`, 최대 100자)
     * @param params    - 추가 파라미터. 문자열 값은 500자로 자동 truncate.
     *                    이메일/전화번호 등 PII 패턴은 자동 마스킹.
     *
     * @example
     * ```ts
     * Union.analytics.trackEvent('join_club', { clubId: 'soccer_001', source: 'home' });
     * ```
     */
    trackEvent(eventName: string, params?: EventParams): void;
    /**
     * 화면 전환 트래킹.
     * Navigation Interceptor 에서 자동 호출되지만 직접 호출도 가능.
     *
     * @param pageName - 화면 식별자 (URL 경로 또는 임의 이름)
     * @param referrer - 이전 화면 식별자 (없으면 생략)
     *
     * @example
     * ```ts
     * Union.analytics.trackPageView('/club/soccer_001', '/home');
     * ```
     */
    trackPageView(pageName: string, referrer?: string): void;
    /**
     * 에러 트래킹.
     * `window.onerror`로 잡히지 않는 catch 블록 내 에러를 수동으로 전송할 때 사용.
     *
     * @param error   - Error 객체 또는 에러 메시지 문자열
     * @param context - 추가 컨텍스트 정보 (PII 포함 금지)
     *
     * @example
     * ```ts
     * try {
     *   await riskyOperation();
     * } catch (err) {
     *   Union.analytics.trackError(err, {
     *     fatal: false,
     *     context: { screen: 'payment', step: 'confirm' },
     *   });
     * }
     * ```
     */
    trackError(error: Error | string, context?: ErrorContext): void;
    /**
     * 전환 이벤트 트래킹 (구매, 신청, 가입 등 핵심 액션).
     *
     * @param conversionType - 전환 타입 식별자 (`[a-z][a-z0-9_]+`)
     * @param params         - 전환 상세 정보
     *
     * @example
     * ```ts
     * Union.analytics.trackConversion('ticket_purchase', {
     *   value: 5000,
     *   currency: 'KRW',
     *   label: '2024_sports_festival',
     * });
     * ```
     */
    trackConversion(conversionType: string, params?: ConversionParams): void;
    /**
     * 사용자 속성 설정.
     * 속성은 세션 내 모든 후속 이벤트에 자동 첨부됨 (네이티브에서 관리).
     * JWT claim 과 결합되어 풍부한 사용자 컨텍스트를 형성함.
     *
     * @param key   - 속성 키 (`[a-zA-Z][a-zA-Z0-9_]+`, 최대 50자)
     * @param value - 속성 값
     *
     * @example
     * ```ts
     * Union.analytics.setUserProperty('major', '소프트웨어학과');
     * Union.analytics.setUserProperty('grade', 3);
     * Union.analytics.setUserProperty('is_club_member', true);
     * ```
     */
    setUserProperty(key: string, value: UserPropertyValue): void;
    /**
     * 자동 수집 초기화. `index.ts` 에서 자동 호출됨.
     * @internal
     */
    install(): void;
    /**
     * 자동 수집 해제. 미니앱 언마운트 시 호출하면 메모리 누수를 방지.
     * @internal
     */
    uninstall(): void;
    /**
     * Navigation Interceptor 에서 화면 전환 발생 시 호출.
     * @internal
     */
    onNavigate(to: string, from: string): void;
    private dispatch;
    private dispatchPerformanceMetric;
    private installErrorCapture;
    private handleGlobalError;
    private handleUnhandledRejection;
    private installPerformanceCapture;
    private installNavigationTimingCapture;
}
export { BRIDGE_LATENCY_SAMPLE_RATE };
