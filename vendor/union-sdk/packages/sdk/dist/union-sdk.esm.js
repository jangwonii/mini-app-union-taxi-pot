/**
 * iOS WKWebView 어댑터
 * window.webkit.messageHandlers.union.postMessage() 사용
 */
class IOSAdapter {
    constructor() {
        this.platform = 'ios';
    }
    send(message) {
        window.webkit.messageHandlers.union.postMessage(message);
    }
}
/**
 * Android WebView 어댑터
 * window.UnionBridge.postMessage() 사용
 */
class AndroidAdapter {
    constructor() {
        this.platform = 'android';
    }
    send(message) {
        window.UnionBridge.postMessage(JSON.stringify(message));
    }
}

/**
 * Mock 어댑터 — 브라우저 개발 환경용
 * 네이티브 앱 없이 SDK API를 시뮬레이션한다.
 */
class MockAdapter {
    constructor() {
        this.platform = 'mock';
    }
    send(message) {
        // 비동기로 시뮬레이션 (네이티브 지연 모방)
        setTimeout(() => {
            const response = this.handleMessage(message);
            window.dispatchEvent(new CustomEvent('union-bridge-response', { detail: response }));
        }, 50);
    }
    handleMessage(request) {
        const handler = MOCK_HANDLERS[request.module]?.[request.action];
        if (!handler) {
            return {
                id: request.id,
                success: false,
                error: {
                    code: 'NOT_SUPPORTED',
                    message: `Mock: ${request.module}.${request.action} is not implemented`,
                },
            };
        }
        try {
            const data = handler(request.params);
            this.log(request, true);
            return { id: request.id, success: true, data };
        }
        catch (err) {
            this.log(request, false);
            return {
                id: request.id,
                success: false,
                error: {
                    code: 'MOCK_ERROR',
                    message: err instanceof Error ? err.message : 'Unknown mock error',
                },
            };
        }
    }
    log(request, success) {
        const status = success ? '\u2705' : '\u274c';
        console.log(`[Union Mock] ${status} ${request.module}.${request.action}`, request.params ?? '');
    }
}
// ============================================
// Mock 핸들러 정의
// ============================================
const STORAGE_PREFIX = 'union_mock_';
const MOCK_HANDLERS = {
    auth: {
        login: () => ({
            code: 'mock_auth_code_' + Math.random().toString(36).substring(2, 10),
        }),
        getUserProfile: () => ({
            userId: 'mock-user-001',
            nickname: 'Mock유저',
            profileImage: undefined,
            university: '단국대학교',
            email: 'mock@dankook.ac.kr',
        }),
        getAccessToken: () => 'mock_access_token_' + Date.now(),
        logout: () => undefined,
    },
    ui: {
        showToast: (params) => {
            showMockToast(params?.message ?? '', params?.duration ?? 'short');
            return undefined;
        },
        showModal: (params) => {
            const confirmed = window.confirm(`${params?.title ?? ''}\n\n${params?.content ?? ''}`);
            return { confirmed };
        },
        showLoading: () => undefined,
        hideLoading: () => undefined,
        setNavigationBar: (params) => {
            if (params?.title) {
                document.title = params.title;
            }
            return undefined;
        },
        close: () => {
            window.close();
            return undefined;
        },
    },
    device: {
        getLocation: () => {
            // 단국대학교 죽전캠퍼스 기본 좌표
            return {
                latitude: 37.3219,
                longitude: 127.1268,
                accuracy: 10,
            };
        },
        scanQRCode: () => {
            const result = window.prompt('Mock QR Code 값 입력:') ?? '';
            return { result };
        },
        getClipboard: () => '',
        setClipboard: () => undefined,
        vibrate: () => {
            navigator.vibrate?.(100);
            return undefined;
        },
    },
    storage: {
        get: (params) => {
            const raw = localStorage.getItem(STORAGE_PREFIX + params?.key);
            return raw ? JSON.parse(raw) : null;
        },
        set: (params) => {
            localStorage.setItem(STORAGE_PREFIX + params?.key, JSON.stringify(params?.value));
            return undefined;
        },
        remove: (params) => {
            localStorage.removeItem(STORAGE_PREFIX + params?.key);
            return undefined;
        },
        clear: () => {
            const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
            keys.forEach((k) => localStorage.removeItem(k));
            return undefined;
        },
    },
    analytics: {
        trackEvent: (params) => {
            console.log('[Union Analytics] Event:', params?.eventName, params?.params);
            return undefined;
        },
        trackPageView: (params) => {
            console.log('[Union Analytics] PageView:', params?.pageName);
            return undefined;
        },
    },
    network: {
        request: async (params) => {
            const resp = await fetch(params.url, {
                method: params.method,
                headers: params.headers,
                body: params.body ? JSON.stringify(params.body) : undefined,
            });
            const data = await resp.json().catch(() => resp.text());
            const headers = {};
            resp.headers.forEach((v, k) => { headers[k] = v; });
            return { statusCode: resp.status, headers, data };
        },
    },
};
// ============================================
// Mock UI Helpers
// ============================================
function showMockToast(message, duration) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: '99999',
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
    });
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, duration === 'long' ? 3000 : 1500);
}

const SDK_VERSION = '1.0.0';

/** 커스텀 에러 클래스 */
class UnionError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'UnionError';
    }
}
/**
 * Bridge Core
 * SDK ↔ Native 간 메시지 패싱의 핵심 엔진.
 *
 * - 플랫폼 자동 감지 (iOS / Android / Mock)
 * - Promise 기반 요청-응답 매칭
 * - 타임아웃 처리
 * - 네이티브 이벤트 수신
 */
class BridgeCore {
    constructor() {
        this.pending = new Map();
        this.eventListeners = new Map();
        this.defaultTimeout = 30000; // 30초
        this.adapter = this.detectAdapter();
        this.listenForResponses();
        this.listenForEvents();
    }
    /**
     * 네이티브 모듈 메서드 호출
     * @returns Promise<T> 네이티브 응답 데이터
     */
    invoke(module, action, params, timeout) {
        const id = generateUUID();
        const request = {
            id,
            module,
            action,
            params,
            sdkVersion: SDK_VERSION,
            timestamp: Date.now(),
        };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new UnionError('TIMEOUT', `${module}.${action} timed out after ${timeout ?? this.defaultTimeout}ms`));
            }, timeout ?? this.defaultTimeout);
            this.pending.set(id, {
                resolve: resolve,
                reject,
                timer,
            });
            this.adapter.send(request);
        });
    }
    /**
     * fire-and-forget 방식 호출 (응답 불필요)
     */
    fire(module, action, params) {
        const request = {
            id: generateUUID(),
            module,
            action,
            params,
            sdkVersion: SDK_VERSION,
            timestamp: Date.now(),
        };
        this.adapter.send(request);
    }
    /**
     * 네이티브 이벤트 구독
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }
    /**
     * 네이티브 이벤트 구독 해제
     */
    off(event, callback) {
        this.eventListeners.get(event)?.delete(callback);
    }
    // ============================================
    // Private
    // ============================================
    detectAdapter() {
        if (typeof window === 'undefined') {
            return new MockAdapter();
        }
        // iOS WKWebView
        if (window.webkit?.messageHandlers?.union) {
            return new IOSAdapter();
        }
        // Android WebView
        if (window.UnionBridge) {
            return new AndroidAdapter();
        }
        // 브라우저 개발 환경
        return new MockAdapter();
    }
    listenForResponses() {
        if (typeof window === 'undefined')
            return;
        window.addEventListener('union-bridge-response', ((event) => {
            const response = event.detail;
            const pending = this.pending.get(response.id);
            if (!pending)
                return;
            clearTimeout(pending.timer);
            this.pending.delete(response.id);
            if (response.success) {
                pending.resolve(response.data);
            }
            else {
                pending.reject(new UnionError(response.error?.code ?? 'UNKNOWN', response.error?.message ?? 'Unknown error'));
            }
        }));
    }
    listenForEvents() {
        if (typeof window === 'undefined')
            return;
        window.addEventListener('union-bridge-event', ((event) => {
            const bridgeEvent = event.detail;
            const listeners = this.eventListeners.get(bridgeEvent.event);
            if (listeners) {
                listeners.forEach((cb) => cb(bridgeEvent.data));
            }
        }));
    }
}
// ============================================
// Utils
// ============================================
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Auth Module — 사용자 인증
 *
 * @example
 * ```ts
 * const { code } = await Union.auth.login();
 * const profile = await Union.auth.getUserProfile();
 * ```
 */
class AuthModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** 사용자 로그인 (OAuth 동의 화면 표시) */
    login() {
        return this.bridge.invoke('auth', 'login');
    }
    /** 현재 로그인된 사용자 프로필 조회 */
    getUserProfile() {
        return this.bridge.invoke('auth', 'getUserProfile');
    }
    /** Access Token 조회 (서버 간 통신용) */
    getAccessToken() {
        return this.bridge.invoke('auth', 'getAccessToken');
    }
    /** 로그아웃 */
    logout() {
        return this.bridge.invoke('auth', 'logout');
    }
}

/**
 * UI Module — 네이티브 UI 컴포넌트
 *
 * @example
 * ```ts
 * Union.ui.showToast({ message: '저장되었습니다!' });
 * const { confirmed } = await Union.ui.showModal({ title: '확인', content: '삭제하시겠습니까?' });
 * ```
 */
class UIModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** 토스트 메시지 표시 */
    showToast(options) {
        this.bridge.fire('ui', 'showToast', { ...options });
    }
    /** 모달 다이얼로그 표시 */
    showModal(options) {
        return this.bridge.invoke('ui', 'showModal', { ...options });
    }
    /** 로딩 인디케이터 표시 */
    showLoading(message) {
        this.bridge.fire('ui', 'showLoading', { message });
    }
    /** 로딩 인디케이터 숨기기 */
    hideLoading() {
        this.bridge.fire('ui', 'hideLoading');
    }
    /** 네비게이션 바 설정 */
    setNavigationBar(options) {
        this.bridge.fire('ui', 'setNavigationBar', { ...options });
    }
    /** 미니앱 종료 */
    close() {
        this.bridge.fire('ui', 'close');
    }
}

/**
 * Device Module — 디바이스 기능 접근
 *
 * @example
 * ```ts
 * const location = await Union.device.getLocation();
 * const { result } = await Union.device.scanQRCode();
 * ```
 */
class DeviceModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** 위치 정보 조회 (device.location 권한 필요) */
    getLocation() {
        return this.bridge.invoke('device', 'getLocation');
    }
    /** QR 코드 스캔 (device.camera 권한 필요) */
    scanQRCode() {
        return this.bridge.invoke('device', 'scanQRCode');
    }
    /** 클립보드 텍스트 읽기 */
    getClipboard() {
        return this.bridge.invoke('device', 'getClipboard');
    }
    /** 클립보드에 텍스트 복사 */
    setClipboard(text) {
        return this.bridge.invoke('device', 'setClipboard', { text });
    }
    /** 진동 피드백 */
    vibrate(type = 'medium') {
        this.bridge.fire('device', 'vibrate', { type });
    }
}

/**
 * Storage Module — 미니앱별 격리된 Key-Value 저장소
 *
 * @example
 * ```ts
 * await Union.storage.set('user_settings', { theme: 'dark' });
 * const settings = await Union.storage.get('user_settings');
 * ```
 */
class StorageModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** 값 조회 */
    get(key) {
        return this.bridge.invoke('storage', 'get', { key });
    }
    /** 값 저장 */
    set(key, value) {
        return this.bridge.invoke('storage', 'set', { key, value });
    }
    /** 값 삭제 */
    remove(key) {
        return this.bridge.invoke('storage', 'remove', { key });
    }
    /** 전체 삭제 */
    clear() {
        return this.bridge.invoke('storage', 'clear');
    }
}

/**
 * Analytics Module — 사용자 행동 트래킹
 *
 * @example
 * ```ts
 * Union.analytics.trackPageView('home');
 * Union.analytics.trackEvent('button_click', { buttonId: 'signup' });
 * ```
 */
class AnalyticsModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** 커스텀 이벤트 트래킹 */
    trackEvent(eventName, params) {
        this.bridge.fire('analytics', 'trackEvent', { eventName, params });
    }
    /** 페이지 뷰 트래킹 */
    trackPageView(pageName) {
        this.bridge.fire('analytics', 'trackPageView', { pageName });
    }
}

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
class NetworkModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** HTTP 요청 (mTLS 자동 적용) */
    request(options) {
        return this.bridge.invoke('network', 'request', { ...options }, options.timeout);
    }
}

// ============================================
// Union SDK 초기화
// ============================================
const bridge = new BridgeCore();
const auth = new AuthModule(bridge);
const ui = new UIModule(bridge);
const device = new DeviceModule(bridge);
const storage = new StorageModule(bridge);
const analytics = new AnalyticsModule(bridge);
const network = new NetworkModule(bridge);
/**
 * Union SDK
 *
 * 미니앱이 슈퍼앱의 네이티브 기능에 접근하기 위한 Bridge SDK.
 *
 * @example
 * ```ts
 * import Union from '@union-miniapp/sdk';
 *
 * // 로그인
 * await Union.auth.login();
 *
 * // 토스트 표시
 * Union.ui.showToast({ message: '안녕하세요!' });
 *
 * // HTTP 요청 (mTLS 자동 적용)
 * const result = await Union.request({ url: '/api/data', method: 'GET' });
 * ```
 */
const Union = {
    /** 인증 모듈 */
    auth,
    /** UI 모듈 */
    ui,
    /** 디바이스 모듈 */
    device,
    /** 저장소 모듈 */
    storage,
    /** 애널리틱스 모듈 */
    analytics,
    /** HTTP 요청 (mTLS 인증 자동 적용) */
    request(options) {
        return network.request(options);
    },
    /** SDK 버전 */
    version: SDK_VERSION,
    /** 현재 플랫폼 ('ios' | 'android' | 'mock') */
    platform: bridge.adapter.platform,
    /** 네이티브 이벤트 구독 */
    on(event, callback) {
        bridge.on(event, callback);
    },
    /** 네이티브 이벤트 구독 해제 */
    off(event, callback) {
        bridge.off(event, callback);
    },
};
// 전역 등록 (WebView 환경에서 window.Union으로 접근 가능)
if (typeof window !== 'undefined') {
    window.Union = Union;
}

export { UnionError, Union as default };
//# sourceMappingURL=union-sdk.esm.js.map
