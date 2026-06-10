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
        // 권한 게이트 — 네이티브 BridgeHandler 의 동의 집행과 동일한 규칙을 mock 에서도 재현.
        const requiredScope = MOCK_SCOPE_MAP[request.module]?.[request.action];
        if (requiredScope && !mockGrantedScopes().has(requiredScope)) {
            this.log(request, false);
            return {
                id: request.id,
                success: false,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: `Mock: '${requiredScope}' 권한이 거부되었습니다`,
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
// ============================================
// 권한 시뮬레이션 (정본 스코프 계약 — 네이티브/백엔드와 동일)
// ============================================
/** (module, action) → 필요한 권한 스코프. 매핑이 없으면 게이트 없음. */
const MOCK_SCOPE_MAP = {
    auth: { getUserProfile: 'user.profile' },
    device: { getLocation: 'device.location', scanQRCode: 'device.camera' },
    storage: { get: 'device.storage', set: 'device.storage', remove: 'device.storage', clear: 'device.storage' },
    notification: {
        requestPermission: 'notification',
        scheduleLocal: 'notification',
        subscribe: 'notification',
        unsubscribe: 'notification',
        setPushEnabled: 'notification',
    },
};
const ALL_SCOPES = [
    'user.profile', 'user.email', 'user.university',
    'device.location', 'device.camera', 'device.storage', 'notification',
];
/**
 * Mock 환경에서 허용된 권한 스코프 집합.
 *
 * 기본값은 전체 허용이라 기존 dev 플로우에는 영향이 없다. 권한 거부 UX 를 테스트하려면
 * 콘솔/부트스트랩에서 허용할 스코프만 지정한다:
 *
 * ```js
 * window.__UNION_MOCK_GRANTED__ = ['user.profile'];
 * // 이후 device.getLocation() 등은 PERMISSION_DENIED 로 거부됨
 * ```
 */
function mockGrantedScopes() {
    const override = typeof window !== 'undefined'
        ? window.__UNION_MOCK_GRANTED__
        : undefined;
    if (Array.isArray(override))
        return new Set(override.map(String));
    return new Set(ALL_SCOPES);
}
/** Analytics 이벤트 타입별 레이블 (개발 콘솔 가독성) */
const ANALYTICS_ICONS = {
    lifecycle: '[lifecycle]',
    screen: '[screen   ]',
    performance: '[perf    ]',
    error: '[error    ]',
    custom: '[custom   ]',
    conversion: '[convert ]',
};
/** Mock 환경에서 setUserProperty 로 설정된 값을 메모리에 보관 */
const MOCK_USER_PROPERTIES = {};
/** base64url 인코딩 (유니코드 안전) */
function base64url(obj) {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/**
 * 구조적으로 유효한 mock ID 토큰(JWT 형태)을 생성한다.
 * 서명 세그먼트는 'mock' 고정 — publisher 백엔드는 비프로덕션에서 JWKS 검증 없이
 * payload 만 디코드해 신원을 신뢰한다(개발용). prod 에서는 실제 RS256 토큰을 검증한다.
 */
function mockIdToken() {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid: 'mock' };
    const payload = {
        iss: 'https://union-mock.local',
        aud: 'mock-miniapp',
        sub: 'mock-user-001',
        token_use: 'id',
        nickname: 'Mock유저',
        iat: now,
        exp: now + 3600,
    };
    return `${base64url(header)}.${base64url(payload)}.mock`;
}
const MOCK_HANDLERS = {
    auth: {
        login: () => ({
            code: 'mock_auth_code_' + Math.random().toString(36).substring(2, 10),
        }),
        getUserProfile: () => {
            // user.profile 게이트는 handleMessage 에서 처리. 여기서는 email/university 를 필드 단위로 게이팅.
            const granted = mockGrantedScopes();
            const profile = {
                userId: 'mock-user-001',
                nickname: 'Mock유저',
                profileImage: undefined,
            };
            if (granted.has('user.university'))
                profile.university = '단국대학교';
            if (granted.has('user.email'))
                profile.email = 'mock@dankook.ac.kr';
            return profile;
        },
        getIdToken: () => mockIdToken(),
        // 하위호환: 이제 세션 토큰이 아니라 ID 토큰을 반환한다 (네이티브 alias 와 동일).
        getAccessToken: () => mockIdToken(),
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
        /**
         * 통합 트래킹 핸들러 — 모든 이벤트 타입 처리.
         * 네이티브에서는 이 단일 액션으로 수신 후 eventType 으로 분기함.
         */
        track: (params) => {
            const { eventType, eventName, timestamp, params: eventParams } = params ?? {};
            const icon = ANALYTICS_ICONS[eventType] ?? '📊';
            const timeStr = timestamp ? new Date(timestamp).toISOString().slice(11, 23) : '';
            // 개발 환경에서 시각적으로 명확한 로그 출력
            console.groupCollapsed(`%c[Union Analytics]%c ${icon} ${eventType}:${eventName}  %c${timeStr}`, 'color:#6366f1;font-weight:bold', 'color:inherit', 'color:#9ca3af;font-size:0.85em');
            if (eventParams && Object.keys(eventParams).length > 0) {
                console.log('params:', eventParams);
            }
            // 수집된 사용자 속성 컨텍스트 표시
            if (Object.keys(MOCK_USER_PROPERTIES).length > 0) {
                console.log('userProps:', { ...MOCK_USER_PROPERTIES });
            }
            console.groupEnd();
            return undefined;
        },
        setUserProperty: (params) => {
            const { key, value } = params ?? {};
            MOCK_USER_PROPERTIES[key] = value;
            console.log(`%c[Union Analytics]%c [user-prop]  %c${key} = ${JSON.stringify(value)}`, 'color:#6366f1;font-weight:bold', 'color:inherit', 'color:#10b981');
            return undefined;
        },
        // 하위 호환성 — 이전 버전 SDK 와 함께 사용하는 경우를 위한 폴백
        trackEvent: (params) => {
            console.log('[Union Analytics] [custom] (legacy) Event:', params?.eventName, params?.params);
            return undefined;
        },
        trackPageView: (params) => {
            console.log('[Union Analytics] [screen] (legacy) PageView:', params?.pageName);
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
    navigation: {
        push: (params) => {
            console.log('[Union Mock] Navigation push:', params?.url);
            if (params?.url) {
                window.history.pushState({}, '', params.url);
                window.dispatchEvent(new PopStateEvent('popstate'));
            }
            return { success: true };
        },
        back: () => {
            window.history.back();
            return undefined;
        },
        replace: (params) => {
            if (params?.url)
                window.history.replaceState({}, '', params.url);
            return undefined;
        },
        prefetch: (params) => {
            console.log('[Union Mock] Prefetch:', params?.url);
            return undefined;
        },
    },
    notification: {
        requestPermission: () => {
            // 브라우저 Notification API 가 있으면 실제 권한 요청. 없으면 mock granted.
            if (typeof Notification !== 'undefined' && Notification.requestPermission) {
                return Notification.requestPermission().then((perm) => ({
                    granted: perm === 'granted',
                    status: perm === 'granted' ? 'authorized'
                        : perm === 'denied' ? 'denied' : 'undetermined',
                }));
            }
            return { granted: true, status: 'authorized' };
        },
        getPermissionStatus: () => {
            if (typeof Notification === 'undefined')
                return { status: 'undetermined' };
            const perm = Notification.permission;
            return {
                status: perm === 'granted' ? 'authorized'
                    : perm === 'denied' ? 'denied' : 'undetermined',
            };
        },
        getDeviceToken: () => ({ token: 'mock-device-token-' + Math.random().toString(36).slice(2, 10) }),
        scheduleLocal: (params) => {
            const id = params?.notificationId ?? 'mock_' + Date.now();
            const title = params?.title ?? '';
            const body = params?.body ?? '';
            const delay = params?.delaySeconds ?? 5;
            console.log(`[Union Mock] scheduleLocal "${title}" (in ${delay}s) → id=${id}`);
            // 브라우저 환경에서 진짜 알림 띄우기 시뮬레이션
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                setTimeout(() => {
                    try {
                        new Notification(title, { body });
                    }
                    catch { /* noop */ }
                }, Math.max(1, delay) * 1000);
            }
            return { notificationId: id };
        },
        cancelLocal: (params) => {
            console.log('[Union Mock] cancelLocal:', params?.notificationId);
            return undefined;
        },
        cancelAllLocal: () => {
            console.log('[Union Mock] cancelAllLocal');
            return undefined;
        },
        subscribe: () => {
            console.log('[Union Mock] subscribe (현재 미니앱)');
            return undefined;
        },
        unsubscribe: () => {
            console.log('[Union Mock] unsubscribe (현재 미니앱)');
            return undefined;
        },
        setPushEnabled: (params) => {
            console.log('[Union Mock] setPushEnabled:', params?.enabled);
            return undefined;
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

const SDK_VERSION = '1.2.0';

/** 커스텀 에러 클래스 */
class UnionError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'UnionError';
    }
}
/**
 * 표준 UnionError 코드.
 *
 * `UnionError.code` 는 임의의 문자열일 수 있지만, 미니앱이 자주 분기하는 코드를
 * 타입 안전하게 다루도록 상수로 노출한다.
 *
 * @example
 * ```ts
 * try {
 *   await Union.device.getLocation();
 * } catch (e) {
 *   if (e instanceof UnionError && e.code === UnionErrorCode.PERMISSION_DENIED) {
 *     // 사용자가 권한을 거부함 → fallback UX
 *   }
 * }
 * ```
 */
const UnionErrorCode = {
    /** 사용자가 권한을 거부했거나, 미니앱이 선언하지 않은 권한을 호출함. */
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    /** 요청이 타임아웃됨. */
    TIMEOUT: 'TIMEOUT',
    /** 사용자가 작업을 취소함(모달 등). */
    CANCELLED: 'CANCELLED',
    /** 네트워크 오류. */
    NETWORK_ERROR: 'NETWORK_ERROR',
    /** 분류되지 않은 오류. */
    UNKNOWN: 'UNKNOWN',
};
/**
 * Bridge Core
 * SDK ↔ Native 간 메시지 패싱의 핵심 엔진.
 *
 * - 플랫폼 자동 감지 (iOS / Android / Mock)
 * - Promise 기반 요청-응답 매칭 (UUID v4)
 * - 30초 기본 타임아웃
 * - 네이티브 이벤트 수신 (CustomEvent)
 * - Bridge 호출 레이턴시 측정 (analytics 연동)
 */
class BridgeCore {
    constructor() {
        this.pending = new Map();
        this.eventListeners = new Map();
        this.defaultTimeout = 30000; // 30초
        /**
         * analytics 모듈에서 등록하는 성능 측정 콜백.
         * analytics 모듈 자신의 요청(module === 'analytics')은 재귀 방지를 위해 측정에서 제외.
         */
        this.perfCallback = null;
        this.adapter = this.detectAdapter();
        this.listenForResponses();
        this.listenForEvents();
    }
    // ============================================
    // Public API
    // ============================================
    /**
     * 네이티브 모듈 메서드 호출 (응답 대기).
     * 성공 응답 시 bridge_latency 를 perfCallback 으로 전달.
     *
     * @returns Promise<T> 네이티브 응답 데이터
     */
    invoke(module, action, params, timeout) {
        const id = generateUUID();
        // performance.now() 가 없는 환경(SSR 등) 대비
        const startTime = typeof performance !== 'undefined' ? performance.now() : 0;
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
            // resolve 를 래핑하여 레이턴시 측정 삽입.
            // analytics 모듈 자체 요청은 재귀 측정 제외.
            const wrappedResolve = (value) => {
                if (module !== 'analytics' && startTime > 0 && this.perfCallback) {
                    const latencyMs = Math.round(performance.now() - startTime);
                    this.perfCallback('bridge_latency', latencyMs);
                }
                resolve(value);
            };
            this.pending.set(id, {
                resolve: wrappedResolve,
                reject,
                timer,
            });
            this.adapter.send(request);
        });
    }
    /**
     * fire-and-forget 방식 호출 (응답 불필요).
     * analytics.track, navigation.prefetch 등 응답을 기다릴 필요 없는 작업에 사용.
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
     * 네이티브 이벤트 구독.
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }
    /**
     * 네이티브 이벤트 구독 해제.
     */
    off(event, callback) {
        this.eventListeners.get(event)?.delete(callback);
    }
    /**
     * Bridge 레이턴시 측정 콜백 등록.
     * AnalyticsModule.install() 에서 자동 호출됨.
     *
     * @internal
     */
    registerPerfCallback(callback) {
        this.perfCallback = callback;
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
 *
 * // 자체 백엔드에 신원 증명 (publisher 백엔드가 JWKS 로 검증)
 * const idToken = await Union.auth.getIdToken();
 * fetch('/api/me', { headers: { Authorization: `Bearer ${idToken}` } });
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
    /**
     * 이 미니앱에 스코프된 사용자 ID 토큰을 조회한다 (publisher 자체 백엔드 인증용).
     *
     * RS256 으로 서명된 OIDC 스타일 토큰이며 `aud` 가 이 미니앱의 appId 로 한정된다.
     * publisher 백엔드는 Union JWKS(`{issuer}/.well-known/jwks.json`) 공개키로 시크릿 공유 없이
     * 검증한다. 사용자의 Union 세션 토큰은 미니앱에 노출되지 않는다.
     *
     * 토큰에 담기는 신원 claim(`nickname`, `email`, `university`)은 사용자가 동의한
     * 권한 스코프에 한해 포함된다. `sub`(사용자 식별자)는 항상 포함된다.
     */
    getIdToken() {
        return this.bridge.invoke('auth', 'getIdToken');
    }
    /**
     * @deprecated 세션 access token 이 아니라 {@link getIdToken} 과 동일한 앱 스코프 ID 토큰을 반환한다.
     * 신규 코드는 `getIdToken()` 을 사용할 것. (하위호환을 위해 유지)
     */
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

// ============================================
// Constants
// ============================================
const TAG$1 = '[Union Analytics]';
/** 스택 트레이스 최대 길이 (chars). 네이티브 페이로드 과부하 방지 */
const MAX_STACK_LENGTH = 1000;
/** 이벤트명 최대 길이 */
const MAX_EVENT_NAME_LENGTH = 100;
/** 파라미터 문자열 값 최대 길이 */
const MAX_PARAM_VALUE_LENGTH = 500;
/** 이벤트명 허용 패턴: 소문자로 시작, 소문자/숫자/언더스코어만 허용 */
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
/** 사용자 속성 키 허용 패턴 */
const PROPERTY_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/;
/**
 * PII 감지 패턴 목록.
 * SDK 레이어에서 1차 마스킹 후, 네이티브에서 2차 마스킹 수행 (defense-in-depth).
 */
const PII_PATTERNS = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // 이메일
    /\d{3}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, // 전화번호
    /\d{6}-[1-4]\d{6}/g, // 주민등록번호
    /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, // 카드번호
];
const PII_PLACEHOLDER = '[REDACTED]';
// ============================================
// Analytics Module
// ============================================
/**
 * Analytics Module — 사용자 행동, 성능, 에러 트래킹
 *
 * ## 자동 수집 (install() 호출 시 활성화)
 * - JS 전역 에러 (`window.onerror`)
 * - 미처리 Promise rejection (`unhandledrejection`)
 * - Core Web Vitals: FCP, LCP (`PerformanceObserver`)
 * - Navigation Timing: dom_content_loaded, page_load
 * - Bridge 호출 레이턴시 (20% 샘플링)
 *
 * ## 수동 수집
 * - `trackEvent()` — 커스텀 이벤트
 * - `trackPageView()` — 화면 전환
 * - `trackError()` — 명시적 에러 리포팅
 * - `trackConversion()` — 전환 이벤트
 * - `setUserProperty()` — 사용자 속성
 *
 * ## 보안
 * - 이벤트 파라미터에서 이메일/전화/주민번호/카드번호 패턴 자동 마스킹
 * - 이벤트명은 `/^[a-z][a-z0-9_]+$/` 형식만 허용 (SQL injection 방지)
 * - 실제 전송 및 PII 필터링의 최종 책임은 네이티브 레이어에 있음
 *
 * @example
 * ```ts
 * Union.analytics.trackPageView('home');
 * Union.analytics.trackEvent('button_click', { buttonId: 'signup' });
 * Union.analytics.trackConversion('ticket_purchase', { value: 5000, currency: 'KRW' });
 * ```
 */
class AnalyticsModule {
    constructor(bridge) {
        this.bridge = bridge;
        this.installed = false;
        this.perfObserver = null;
        this.boundGlobalErrorHandler = this.handleGlobalError.bind(this);
        this.boundRejectionHandler = this.handleUnhandledRejection.bind(this);
    }
    // ============================================
    // Public API
    // ============================================
    /**
     * 커스텀 이벤트 트래킹.
     *
     * @param eventName - 이벤트명 (`[a-z][a-z0-9_]+`, 최대 100자)
     * @param params    - 추가 파라미터. 문자열 값은 500자로 자동 truncate.
     *                    이메일/전화번호 등 PII 패턴은 자동 마스킹.
     *
     * @example
     * ```ts
     * Union.analytics.trackEvent('join_club', { clubId: 'soccer_001', source: 'home' });
     * ```
     */
    trackEvent(eventName, params) {
        if (!validateEventName(eventName))
            return;
        this.dispatch('custom', eventName, params ? sanitizeParams(params) : undefined);
    }
    /**
     * 화면 전환 트래킹.
     * Navigation Interceptor 에서 자동 호출되지만 직접 호출도 가능.
     *
     * @param pageName - 화면 식별자 (URL 경로 또는 임의 이름)
     * @param referrer - 이전 화면 식별자 (없으면 생략)
     *
     * @example
     * ```ts
     * Union.analytics.trackPageView('/club/soccer_001', '/home');
     * ```
     */
    trackPageView(pageName, referrer) {
        this.dispatch('screen', 'screen_view', {
            pageName: pageName.slice(0, 200),
            referrer: (referrer ?? '').slice(0, 500),
        });
    }
    /**
     * 에러 트래킹.
     * `window.onerror`로 잡히지 않는 catch 블록 내 에러를 수동으로 전송할 때 사용.
     *
     * @param error   - Error 객체 또는 에러 메시지 문자열
     * @param context - 추가 컨텍스트 정보 (PII 포함 금지)
     *
     * @example
     * ```ts
     * try {
     *   await riskyOperation();
     * } catch (err) {
     *   Union.analytics.trackError(err, {
     *     fatal: false,
     *     context: { screen: 'payment', step: 'confirm' },
     *   });
     * }
     * ```
     */
    trackError(error, context) {
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        const stack = error instanceof Error ? truncateStack(error.stack) : undefined;
        const params = {
            message,
            fatal: context?.fatal === true ? 1 : 0,
        };
        if (stack !== undefined) {
            params['stack'] = stack;
        }
        if (context?.context) {
            const sanitized = sanitizeStringRecord(context.context);
            Object.assign(params, sanitized);
        }
        this.dispatch('error', 'tracked_error', params);
    }
    /**
     * 전환 이벤트 트래킹 (구매, 신청, 가입 등 핵심 액션).
     *
     * @param conversionType - 전환 타입 식별자 (`[a-z][a-z0-9_]+`)
     * @param params         - 전환 상세 정보
     *
     * @example
     * ```ts
     * Union.analytics.trackConversion('ticket_purchase', {
     *   value: 5000,
     *   currency: 'KRW',
     *   label: '2024_sports_festival',
     * });
     * ```
     */
    trackConversion(conversionType, params) {
        if (!validateEventName(conversionType))
            return;
        const { value, currency, label, ...rest } = params ?? {};
        const eventParams = { conversionType };
        if (value !== undefined)
            eventParams['value'] = Number(value);
        if (currency !== undefined)
            eventParams['currency'] = String(currency).slice(0, 10);
        if (label !== undefined)
            eventParams['label'] = String(label).slice(0, 200);
        // 나머지 커스텀 파라미터: undefined 제거 후 PII 마스킹
        const cleanRest = {};
        for (const [k, v] of Object.entries(rest)) {
            if (v !== undefined)
                cleanRest[k] = v;
        }
        Object.assign(eventParams, sanitizeParams(cleanRest));
        this.dispatch('conversion', 'conversion', eventParams);
    }
    /**
     * 사용자 속성 설정.
     * 속성은 세션 내 모든 후속 이벤트에 자동 첨부됨 (네이티브에서 관리).
     * JWT claim 과 결합되어 풍부한 사용자 컨텍스트를 형성함.
     *
     * @param key   - 속성 키 (`[a-zA-Z][a-zA-Z0-9_]+`, 최대 50자)
     * @param value - 속성 값
     *
     * @example
     * ```ts
     * Union.analytics.setUserProperty('major', '소프트웨어학과');
     * Union.analytics.setUserProperty('grade', 3);
     * Union.analytics.setUserProperty('is_club_member', true);
     * ```
     */
    setUserProperty(key, value) {
        if (!PROPERTY_KEY_PATTERN.test(key)) {
            console.warn(`${TAG$1} Invalid user property key: "${key}". Must match /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/`);
            return;
        }
        const sanitizedValue = typeof value === 'string' ? sanitizePIIString(value).slice(0, 200) : value;
        this.bridge.fire('analytics', 'setUserProperty', { key, value: sanitizedValue });
    }
    // ============================================
    // Auto-Capture Lifecycle (SDK 내부 전용)
    // ============================================
    /**
     * 자동 수집 초기화. `index.ts` 에서 자동 호출됨.
     * @internal
     */
    install() {
        if (this.installed || typeof window === 'undefined')
            return;
        this.installed = true;
        this.installErrorCapture();
        this.installPerformanceCapture();
        this.installNavigationTimingCapture();
        // BridgeCore 에 레이턴시 측정 콜백 등록
        this.bridge.registerPerfCallback((metricName, valueMs) => {
            this.dispatchPerformanceMetric(metricName, valueMs, 'ms');
        });
    }
    /**
     * 자동 수집 해제. 미니앱 언마운트 시 호출하면 메모리 누수를 방지.
     * @internal
     */
    uninstall() {
        if (!this.installed || typeof window === 'undefined')
            return;
        this.installed = false;
        window.removeEventListener('error', this.boundGlobalErrorHandler);
        window.removeEventListener('unhandledrejection', this.boundRejectionHandler);
        this.perfObserver?.disconnect();
        this.perfObserver = null;
    }
    /**
     * Navigation Interceptor 에서 화면 전환 발생 시 호출.
     * @internal
     */
    onNavigate(to, from) {
        this.trackPageView(to, from);
    }
    // ============================================
    // Private — Dispatch
    // ============================================
    dispatch(eventType, eventName, params) {
        const payload = {
            eventType,
            eventName,
            timestamp: Date.now(),
            ...(params !== undefined && { params }),
        };
        // TrackingPayload 를 BridgeRequest.params (Record<string, unknown>) 로 전달
        this.bridge.fire('analytics', 'track', payload);
    }
    dispatchPerformanceMetric(name, value, unit) {
        this.dispatch('performance', 'performance_metric', {
            metricName: name,
            value,
            unit,
        });
    }
    // ============================================
    // Private — Auto-Capture Installers
    // ============================================
    installErrorCapture() {
        window.addEventListener('error', this.boundGlobalErrorHandler);
        window.addEventListener('unhandledrejection', this.boundRejectionHandler);
    }
    handleGlobalError(event) {
        this.dispatch('error', 'js_error', {
            message: (event.message ?? 'Unknown error').slice(0, 500),
            filename: (event.filename ?? '').slice(0, 200),
            lineno: event.lineno ?? 0,
            colno: event.colno ?? 0,
            fatal: 0,
        });
    }
    handleUnhandledRejection(event) {
        const { reason } = event;
        const message = (reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
                ? reason
                : safeStringify(reason)).slice(0, 500);
        const stack = reason instanceof Error ? truncateStack(reason.stack) : undefined;
        const params = { message, fatal: 0 };
        if (stack !== undefined)
            params['stack'] = stack;
        this.dispatch('error', 'unhandled_rejection', params);
    }
    installPerformanceCapture() {
        if (typeof PerformanceObserver === 'undefined')
            return;
        try {
            const supported = PerformanceObserver.supportedEntryTypes ?? [];
            const targets = ['paint', 'largest-contentful-paint'].filter((t) => supported.includes(t));
            if (targets.length === 0)
                return;
            this.perfObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        this.dispatchPerformanceMetric('first_contentful_paint', Math.round(entry.startTime), 'ms');
                    }
                    else if (entry.entryType === 'largest-contentful-paint') {
                        this.dispatchPerformanceMetric('largest_contentful_paint', Math.round(entry.startTime), 'ms');
                    }
                }
            });
            this.perfObserver.observe({ entryTypes: targets });
        }
        catch {
            // PerformanceObserver 미지원 환경 무시
        }
    }
    installNavigationTimingCapture() {
        const capture = () => {
            try {
                const [nav] = performance.getEntriesByType('navigation');
                if (!nav)
                    return;
                if (nav.domContentLoadedEventEnd > 0) {
                    this.dispatchPerformanceMetric('dom_content_loaded', Math.round(nav.domContentLoadedEventEnd), 'ms');
                }
                if (nav.loadEventEnd > 0) {
                    this.dispatchPerformanceMetric('page_load', Math.round(nav.loadEventEnd), 'ms');
                }
                if (nav.transferSize !== undefined && nav.transferSize > 0) {
                    this.dispatchPerformanceMetric('transfer_size', nav.transferSize, 'bytes');
                }
            }
            catch {
                // navigation timing 미지원 환경 무시
            }
        };
        if (document.readyState === 'complete') {
            capture();
        }
        else {
            window.addEventListener('load', capture, { once: true });
        }
    }
}
// ============================================
// Module-Private Helpers
// ============================================
/** 이벤트명 유효성 검사. false 반환 시 console.warn 출력. */
function validateEventName(name) {
    if (name.length > MAX_EVENT_NAME_LENGTH) {
        console.warn(`${TAG$1} Event name too long (max ${MAX_EVENT_NAME_LENGTH}): "${name}"`);
        return false;
    }
    if (!EVENT_NAME_PATTERN.test(name)) {
        console.warn(`${TAG$1} Invalid event name: "${name}". Must match /^[a-z][a-z0-9_]{0,99}$/`);
        return false;
    }
    return true;
}
/**
 * 이벤트 파라미터 정제.
 * - 문자열 값: MAX_PARAM_VALUE_LENGTH truncate + PII 마스킹
 * - 숫자/불리언: 그대로 통과
 */
function sanitizeParams(params) {
    const result = {};
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') {
            result[key] = sanitizePIIString(value).slice(0, MAX_PARAM_VALUE_LENGTH);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
/** Record<string, string> PII 마스킹 + truncate */
function sanitizeStringRecord(record) {
    const result = {};
    for (const [k, v] of Object.entries(record)) {
        result[k] = sanitizePIIString(v).slice(0, MAX_PARAM_VALUE_LENGTH);
    }
    return result;
}
/**
 * 문자열에서 PII 패턴 마스킹.
 * RegExp 는 stateful(lastIndex)이므로 매 호출 전 reset.
 */
function sanitizePIIString(value) {
    let sanitized = value;
    for (const pattern of PII_PATTERNS) {
        pattern.lastIndex = 0;
        sanitized = sanitized.replace(pattern, PII_PLACEHOLDER);
    }
    return sanitized;
}
/** Error.stack 을 MAX_STACK_LENGTH 로 truncate */
function truncateStack(stack) {
    if (!stack)
        return undefined;
    return stack.length > MAX_STACK_LENGTH
        ? `${stack.slice(0, MAX_STACK_LENGTH)}…[truncated]`
        : stack;
}
/** JSON.stringify 실패에 안전한 직렬화 */
function safeStringify(value) {
    try {
        return JSON.stringify(value) ?? 'null';
    }
    catch {
        return String(value);
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

/**
 * Navigation Module — 네이티브 페이지 스택 관리
 *
 * @example
 * ```ts
 * await Union.navigation.push('/detail/123');
 * Union.navigation.back();
 * ```
 */
class NavigationModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /** 새 네이티브 WebView 화면을 push */
    push(url, options) {
        return this.bridge.invoke('navigation', 'push', {
            url,
            ...options,
        });
    }
    /** 현재 화면을 pop (이전 페이지로) */
    back() {
        this.bridge.fire('navigation', 'back');
    }
    /** 현재 WebView의 URL을 교체 (push 없이) */
    replace(url) {
        this.bridge.fire('navigation', 'replace', { url });
    }
    /** URL을 warm WebView에 미리 로드 */
    prefetch(url) {
        this.bridge.fire('navigation', 'prefetch', { url });
    }
}

/**
 * Notification Module — 푸시 / 로컬 알림 / 미니앱 구독 관리.
 *
 * 보안 모델:
 * - **원격 푸시 발송은 SDK 에서 직접 할 수 없다.** publisher 백엔드가
 *   `X-Union-Api-Key` 헤더로 Spring `POST /api/v1/publishers/notifications` 를
 *   호출하는 경로만 허용된다. WebView 내부 JS 에 API Key 가 노출되면 안 되기 때문.
 * - SDK 에서 가능한 것: 권한 요청, 로컬(타이머) 알림, 미니앱별 구독 토글, 원격 푸시 수신 이벤트.
 *
 * @example
 * ```ts
 * // 1) 사용자에게 알림 권한 받기
 * const { granted } = await Union.notification.requestPermission();
 *
 * // 2) 본 미니앱의 알림 구독 (사용자가 명시적으로 ON)
 * await Union.notification.subscribe();
 *
 * // 3) 원격 푸시 수신 이벤트 구독
 * Union.on('notification:received', (payload) => {
 *   console.log('알림 도착', payload);
 * });
 *
 * // 4) 5초 후 로컬 알림 (앱 백그라운드일 때만 노출)
 * await Union.notification.scheduleLocal({
 *   title: '확인하세요',
 *   body: '5초 뒤 이 메시지가 표시됩니다',
 *   delaySeconds: 5,
 * });
 * ```
 */
class NotificationModule {
    constructor(bridge) {
        this.bridge = bridge;
    }
    /**
     * 사용자에게 알림 권한을 요청한다.
     * iOS 는 거부 후에는 다시 요청 다이얼로그가 뜨지 않으니 (시스템 정책) UI 흐름을 잘 설계해야 한다.
     */
    requestPermission() {
        return this.bridge.invoke('notification', 'requestPermission');
    }
    /** 현재 알림 권한 상태 조회 — 다이얼로그를 띄우지 않음 */
    async getPermissionStatus() {
        const result = await this.bridge.invoke('notification', 'getPermissionStatus');
        return result.status;
    }
    /**
     * APNs / FCM 디바이스 토큰 조회.
     * 토큰은 네이티브가 자동으로 Spring 에 등록한다 — 미니앱이 직접 서버에 보낼 필요 없음.
     * 디버깅 / 사용자 표시용 정도로만 활용.
     */
    getDeviceToken() {
        return this.bridge.invoke('notification', 'getDeviceToken');
    }
    /**
     * N초 뒤 발사되는 로컬 알림 예약.
     * 앱이 포그라운드면 배너로 표시, 백그라운드면 알림 센터에 추가된다.
     */
    scheduleLocal(options) {
        return this.bridge.invoke('notification', 'scheduleLocal', options);
    }
    /** 예약된 로컬 알림 취소 */
    cancelLocal(notificationId) {
        this.bridge.fire('notification', 'cancelLocal', { notificationId });
    }
    /** 예약된 모든 로컬 알림 취소 */
    cancelAllLocal() {
        this.bridge.fire('notification', 'cancelAllLocal');
    }
    /**
     * 본 미니앱에 대한 알림 구독.
     * 사용자가 미니앱을 실행하면 네이티브가 자동으로 구독 처리하지만,
     * 명시적으로 구독 토글 UI 를 제공하려면 이 메서드를 호출.
     */
    subscribe() {
        return this.bridge.invoke('notification', 'subscribe');
    }
    /** 본 미니앱의 알림 구독 해지 */
    unsubscribe() {
        return this.bridge.invoke('notification', 'unsubscribe');
    }
    /** 본 미니앱 알림 ON/OFF 토글 (구독은 유지하면서 푸시만 끔) */
    setPushEnabled(enabled) {
        return this.bridge.invoke('notification', 'setPushEnabled', { enabled });
    }
    /**
     * 원격 푸시 수신 이벤트 구독 헬퍼.
     * `Union.on('notification:received', handler)` 의 sugar — 반환된 함수를 호출하면 구독 해제.
     */
    onReceived(handler) {
        const wrapped = (data) => handler((data ?? {}));
        this.bridge.on('notification:received', wrapped);
        return () => this.bridge.off('notification:received', wrapped);
    }
}

const TAG = '[Union Nav]';
/**
 * `<a>` 태그 자동 가로채기 + viewport prefetch
 *
 * SDK 초기화 시 자동으로 설치됨.
 * 네비게이션 발생 시 `options.onNavigate` 콜백을 통해 Analytics 로 screen_view 이벤트 전달.
 *
 * @returns cleanup 함수 — 인터셉터 제거 시 호출
 */
function installNavigationInterceptor(navigation, options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => { };
    }
    console.log(`${TAG} Interceptor installing...`);
    const cleanups = [];
    // ============================================
    // 1. <a> 클릭 가로채기
    //    capture phase — 프레임워크 핸들러보다 먼저 실행
    // ============================================
    const clickHandler = (e) => {
        const anchor = e.target?.closest?.('a');
        if (!anchor)
            return;
        const href = anchor.getAttribute('href');
        // data-union-nav="false" → opt-out
        if (anchor.getAttribute('data-union-nav') === 'false') {
            return;
        }
        if (!href || isExternalLink(href)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        // Analytics: screen_view (네비게이션 직전 현재 경로를 referrer 로 전달)
        const from = window.location.pathname + window.location.search;
        options.onNavigate?.(href, from);
        navigation.push(href);
    };
    document.addEventListener('click', clickHandler, true);
    cleanups.push(() => document.removeEventListener('click', clickHandler, true));
    // ============================================
    // 2. IntersectionObserver — viewport 진입 시 prefetch
    // ============================================
    if ('IntersectionObserver' in window) {
        const prefetched = new Set();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting)
                    continue;
                const href = entry.target.getAttribute('href');
                if (href && !isExternalLink(href) && !prefetched.has(href)) {
                    prefetched.add(href);
                    navigation.prefetch(href);
                    observer.unobserve(entry.target);
                }
            }
        }, { rootMargin: '200px' });
        const observeAnchors = () => {
            let count = 0;
            document.querySelectorAll('a[href]:not([data-union-observed])').forEach((a) => {
                const href = a.getAttribute('href');
                if (href && !isExternalLink(href) && a.getAttribute('data-union-nav') !== 'false') {
                    a.setAttribute('data-union-observed', '');
                    observer.observe(a);
                    count++;
                }
            });
            if (count > 0) {
                console.log(`${TAG} Observing ${count} new <a> tags for prefetch`);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observeAnchors, { once: true });
        }
        else {
            observeAnchors();
        }
        // ============================================
        // 3. MutationObserver — 동적으로 추가되는 <a> 태그 감지
        // ============================================
        const mutationObserver = new MutationObserver(() => observeAnchors());
        mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
        cleanups.push(() => {
            observer.disconnect();
            mutationObserver.disconnect();
        });
    }
    console.log(`${TAG} Interceptor installed`);
    return () => cleanups.forEach((fn) => fn());
}
function isExternalLink(href) {
    return (href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:'));
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
const navigation = new NavigationModule(bridge);
const notification = new NotificationModule(bridge);
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
 * // 커스텀 이벤트 트래킹
 * Union.analytics.trackEvent('join_club', { clubId: 'soccer_001' });
 *
 * // 전환 이벤트
 * Union.analytics.trackConversion('ticket_purchase', { value: 5000, currency: 'KRW' });
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
    /** 네비게이션 모듈 (네이티브 페이지 스택) */
    navigation,
    /** 알림 모듈 (권한/로컬알림/구독/원격 푸시 수신) */
    notification,
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
// ============================================
// 전역 등록 + 자동 수집 초기화
// ============================================
/**
 * 푸시 딥링크 초기 경로(`?__route=`) 적용.
 *
 * 네이티브(iOS `MiniAppSchemeHandler`/원격 launch URL)는 미니앱을 특정 화면으로 열 때
 * 진입 URL 에 `?__route=<path>` 를 붙인다. 미니앱 라우터(History API 기반)가 인식하도록,
 * React 앱 마운트 전에 실제 경로로 `replaceState` 한다.
 *
 * `__route` 가 없으면 아무 일도 하지 않으므로 일반 진입에는 영향이 없다.
 */
function applyInitialRoute() {
    try {
        const params = new URLSearchParams(window.location.search);
        const route = params.get('__route');
        if (!route)
            return;
        // __route 쿼리를 제거하고 실제 경로로 치환 → BrowserRouter 가 초기 경로로 인식.
        window.history.replaceState(window.history.state, '', route);
    }
    catch {
        // location 접근 불가/cross-origin 경로 등은 무시 (미니앱은 루트에서 시작).
    }
}
if (typeof window !== 'undefined') {
    // window.Union 으로 WebView 환경에서도 접근 가능
    window.Union = Union;
    // 푸시 딥링크 초기 경로 적용 — 라우터 마운트/네비게이션 인터셉터보다 먼저.
    applyInitialRoute();
    // Analytics 자동 수집 활성화 (JS 에러, Web Vitals, Bridge 레이턴시)
    analytics.install();
    // <a> 태그 자동 가로채기 + viewport prefetch + screen_view 트래킹 연결
    installNavigationInterceptor(navigation, {
        onNavigate: (to, from) => analytics.onNavigate(to, from),
    });
}

export { UnionError, UnionErrorCode, Union as default };
//# sourceMappingURL=union-sdk.esm.js.map
