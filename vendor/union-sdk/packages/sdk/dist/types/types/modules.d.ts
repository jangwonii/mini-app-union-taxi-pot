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
export type PermissionScope = 'user.profile' | 'user.email' | 'user.university' | 'device.location' | 'device.camera' | 'device.storage';
