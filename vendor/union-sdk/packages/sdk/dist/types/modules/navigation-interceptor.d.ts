import type { NavigationModule } from './navigation';
/**
 * Navigation Interceptor 설정 옵션
 */
export interface NavigationInterceptorOptions {
    /**
     * 네비게이션 발생 시 호출되는 콜백.
     * Analytics 연동에 사용 — `analytics.onNavigate(to, from)` 을 여기서 호출.
     *
     * @param to   - 이동할 URL (href)
     * @param from - 현재 URL (window.location.pathname + search)
     */
    onNavigate?: (to: string, from: string) => void;
}
/**
 * `<a>` 태그 자동 가로채기 + viewport prefetch
 *
 * SDK 초기화 시 자동으로 설치됨.
 * 네비게이션 발생 시 `options.onNavigate` 콜백을 통해 Analytics 로 screen_view 이벤트 전달.
 *
 * @returns cleanup 함수 — 인터셉터 제거 시 호출
 */
export declare function installNavigationInterceptor(navigation: NavigationModule, options?: NavigationInterceptorOptions): () => void;
