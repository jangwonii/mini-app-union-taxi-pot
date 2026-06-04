import type { BridgeCore } from '../core/bridge';
import type { LocationResult, QRCodeResult, VibrationType } from '../types';
/**
 * Device Module — 디바이스 기능 접근
 *
 * @example
 * ```ts
 * const location = await Union.device.getLocation();
 * const { result } = await Union.device.scanQRCode();
 * ```
 */
export declare class DeviceModule {
    private bridge;
    constructor(bridge: BridgeCore);
    /** 위치 정보 조회 (device.location 권한 필요) */
    getLocation(): Promise<LocationResult>;
    /** QR 코드 스캔 (device.camera 권한 필요) */
    scanQRCode(): Promise<QRCodeResult>;
    /** 클립보드 텍스트 읽기 */
    getClipboard(): Promise<string>;
    /** 클립보드에 텍스트 복사 */
    setClipboard(text: string): Promise<void>;
    /** 진동 피드백 */
    vibrate(type?: VibrationType): void;
}
