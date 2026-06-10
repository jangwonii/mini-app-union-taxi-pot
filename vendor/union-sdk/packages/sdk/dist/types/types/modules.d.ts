export interface UserProfile {
    userId: string;
    nickname: string;
    profileImage?: string;
    /** user.university 권한 필요 */
    university?: string;
    /** user.email 권한 필요 */
    email?: string;
}
export interface LoginResult {
    code: string;
}
export interface ToastOptions {
    message: string;
    duration?: 'short' | 'long';
}
export interface ModalOptions {
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
}
export interface ModalResult {
    confirmed: boolean;
}
export interface NavigationBarOptions {
    title?: string;
    backgroundColor?: string;
    textColor?: string;
}
export interface LocationResult {
    latitude: number;
    longitude: number;
    accuracy: number;
}
export interface QRCodeResult {
    result: string;
}
export type VibrationType = 'light' | 'medium' | 'heavy';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export interface RequestOptions {
    url: string;
    method: HttpMethod;
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
}
export interface RequestResult {
    statusCode: number;
    headers: Record<string, string>;
    data: unknown;
}
export type EventParams = Record<string, string | number | boolean>;
/** 트래킹 이벤트 분류 */
export type TrackingEventType = 'lifecycle' | 'screen' | 'performance' | 'error' | 'custom' | 'conversion';
/**
 * JS → Native 로 전달되는 트래킹 페이로드.
 * 네이티브에서 sessionId, userId(hashed), deviceInfo 등을 보강하여 최종 이벤트를 구성함.
 */
export interface TrackingPayload {
    eventType: TrackingEventType;
    eventName: string;
    /** 이벤트 발생 시각 (epoch ms, client-side) */
    timestamp: number;
    /** 이벤트별 추가 파라미터 */
    params?: EventParams;
}
/** trackError() 컨텍스트 */
export interface ErrorContext {
    /** true이면 앱이 복구 불가능한 치명적 에러 */
    fatal?: boolean;
    /** 에러 발생 위치/상황에 대한 추가 정보 (PII 포함 금지) */
    context?: Record<string, string>;
}
/** trackConversion() 파라미터 */
export interface ConversionParams {
    /** 전환 금액 (원 단위) */
    value?: number;
    /** 통화 코드 (ISO 4217, e.g. 'KRW') */
    currency?: string;
    /** 전환 레이블 (자유 형식) */
    label?: string;
    /** 추가 커스텀 파라미터 */
    [key: string]: string | number | boolean | undefined;
}
/** setUserProperty() 허용 값 타입 */
export type UserPropertyValue = string | number | boolean;
export type PermissionScope = 'user.profile' | 'user.email' | 'user.university' | 'device.location' | 'device.camera' | 'device.storage' | 'notification';
/** iOS/Android 알림 권한 상태 */
export type NotificationPermissionStatus = 'undetermined' | 'denied' | 'authorized' | 'provisional' | 'ephemeral';
export interface NotificationPermissionResult {
    /** 사용자가 알림을 받기로 동의했는지 */
    granted: boolean;
    /** 권한 상세 상태 */
    status: NotificationPermissionStatus;
}
/** Native 가 발급한 디바이스 푸시 토큰 (hex 문자열 / FCM 토큰) */
export interface DeviceTokenResult {
    /** APNs hex token (iOS) 또는 FCM token (Android). 등록 전이면 null. */
    token: string | null;
}
export interface LocalNotificationOptions {
    /** 표시 제목 */
    title: string;
    /** 본문 */
    body: string;
    /** 발송 지연 (초). 기본 5, 최소 1. */
    delaySeconds?: number;
    /** 알림 클릭 시 SDK 가 받을 임의 데이터 (string-only) */
    data?: Record<string, string>;
    /** 고유 식별자 — 동일 id 로 다시 schedule 하면 덮어쓴다. */
    notificationId?: string;
}
export interface LocalNotificationResult {
    notificationId: string;
}
/** 원격 푸시 수신 페이로드 — Spring `FcmService.buildFcmData` 와 매칭. */
export interface NotificationPayload {
    /** Spring `NotificationCampaign` row id */
    campaignId?: string;
    /** UPDATE / RECOMMENDATION / ANNOUNCEMENT / MINIAPP_GENERIC / PUBLISHER_BUILD / REVIEW_RESULT */
    category?: string;
    /** MINIAPP / WEB / INTERNAL / NONE */
    deeplinkType?: string;
    /** 발송 대상 미니앱 appId (reverse-domain) */
    appId?: string;
    /** 미니앱 내부 경로 (deeplinkType=MINIAPP 일 때) */
    path?: string;
    /** 외부 웹 URL (deeplinkType=WEB) */
    webUrl?: string;
    /** Union 내부 라우트 (deeplinkType=INTERNAL) */
    internalRoute?: string;
    /** APNs 표준 페이로드의 'aps' 필드도 포함될 수 있음 */
    [key: string]: unknown;
}
export interface NavigationPushOptions {
    url: string;
    title?: string;
    animated?: boolean;
}
export interface NavigationPushResult {
    success: boolean;
}
