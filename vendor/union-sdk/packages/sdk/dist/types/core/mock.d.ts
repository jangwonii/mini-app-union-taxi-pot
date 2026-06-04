import type { BridgeAdapter, BridgeRequest } from '../types';
/**
 * Mock 어댑터 — 브라우저 개발 환경용
 * 네이티브 앱 없이 SDK API를 시뮬레이션한다.
 */
export declare class MockAdapter implements BridgeAdapter {
    readonly platform: "mock";
    send(message: BridgeRequest): void;
    private handleMessage;
    private log;
}
