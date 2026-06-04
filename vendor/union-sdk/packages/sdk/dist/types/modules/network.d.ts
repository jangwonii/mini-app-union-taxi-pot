import type { BridgeCore } from '../core/bridge';
import type { RequestOptions, RequestResult } from '../types';
/**
 * Network Module — mTLS 인증이 자동 적용되는 HTTP 요청
 *
 * @example
 * ```ts
 * const result = await Union.request({
 *   url: 'https://api.example.com/data',
 *   method: 'GET',
 * });
 * console.log(result.data);
 * ```
 */
export declare class NetworkModule {
    private bridge;
    constructor(bridge: BridgeCore);
    /** HTTP 요청 (mTLS 자동 적용) */
    request(options: RequestOptions): Promise<RequestResult>;
}
