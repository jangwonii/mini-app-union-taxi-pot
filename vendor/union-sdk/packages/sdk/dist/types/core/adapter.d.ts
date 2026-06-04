import type { BridgeAdapter, BridgeRequest } from '../types';
/**
 * iOS WKWebView 어댑터
 * window.webkit.messageHandlers.union.postMessage() 사용
 */
export declare class IOSAdapter implements BridgeAdapter {
    readonly platform: "ios";
    send(message: BridgeRequest): void;
}
/**
 * Android WebView 어댑터
 * window.UnionBridge.postMessage() 사용
 */
export declare class AndroidAdapter implements BridgeAdapter {
    readonly platform: "android";
    send(message: BridgeRequest): void;
}
declare global {
    interface Window {
        webkit?: {
            messageHandlers: {
                union: {
                    postMessage(message: unknown): void;
                };
            };
        };
        UnionBridge?: {
            postMessage(message: string): void;
        };
    }
}
