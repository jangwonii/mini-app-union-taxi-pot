import type { BridgeCore } from '../core/bridge';
import type { NavigationPushOptions, NavigationPushResult } from '../types';
/**
 * Navigation Module — 네이티브 페이지 스택 관리
 *
 * @example
 * ```ts
 * await Union.navigation.push('/detail/123');
 * Union.navigation.back();
 * ```
 */
export declare class NavigationModule {
    private bridge;
    constructor(bridge: BridgeCore);
    /** 새 네이티브 WebView 화면을 push */
    push(url: string, options?: Omit<NavigationPushOptions, 'url'>): Promise<NavigationPushResult>;
    /** 현재 화면을 pop (이전 페이지로) */
    back(): void;
    /** 현재 WebView의 URL을 교체 (push 없이) */
    replace(url: string): void;
    /** URL을 warm WebView에 미리 로드 */
    prefetch(url: string): void;
}
