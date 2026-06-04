import type { BridgeCore } from '../core/bridge';
/**
 * Storage Module — 미니앱별 격리된 Key-Value 저장소
 *
 * @example
 * ```ts
 * await Union.storage.set('user_settings', { theme: 'dark' });
 * const settings = await Union.storage.get('user_settings');
 * ```
 */
export declare class StorageModule {
    private bridge;
    constructor(bridge: BridgeCore);
    /** 값 조회 */
    get<T = unknown>(key: string): Promise<T | null>;
    /** 값 저장 */
    set(key: string, value: unknown): Promise<void>;
    /** 값 삭제 */
    remove(key: string): Promise<void>;
    /** 전체 삭제 */
    clear(): Promise<void>;
}
