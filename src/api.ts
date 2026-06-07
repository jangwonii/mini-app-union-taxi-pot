import Union from '@union-miniapp/sdk';
import type {
  JoinRequest,
  JoinRequestStatus,
  SortMode,
  TaxiNotification,
  TaxiPot,
  TaxiPotFormValues,
  TimeFilter,
  UserProfile,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface ApiResult<T> {
  statusCode: number;
  data: T | { error?: string };
}

export async function listPots(
  user: UserProfile,
  filters: { q?: string; tag?: string; time?: TimeFilter; sort?: SortMode },
): Promise<TaxiPot[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.time && filters.time !== 'all') params.set('time', filters.time);
  if (filters.sort && filters.sort !== 'departure') params.set('sort', filters.sort);
  const result = await request<{ pots: TaxiPot[] }>(`/api/pots?${params.toString()}`, 'GET', user);
  return result.pots;
}

export async function getPot(user: UserProfile, id: string): Promise<TaxiPot> {
  const params = new URLSearchParams({ id });
  const result = await request<{ pot: TaxiPot }>(`/api/pots/detail?${params.toString()}`, 'GET', user);
  return result.pot;
}

export async function createPot(user: UserProfile, values: TaxiPotFormValues): Promise<TaxiPot> {
  const result = await request<{ pot: TaxiPot }>('/api/pots', 'POST', user, normalizePot(values));
  return result.pot;
}

export async function closePot(user: UserProfile, id: string): Promise<TaxiPot> {
  const result = await request<{ pot: TaxiPot }>(`/api/pots/detail?id=${encodeURIComponent(id)}`, 'PUT', user, { status: 'closed' });
  return result.pot;
}

export async function requestToJoinPot(user: UserProfile, potId: string, message: string): Promise<JoinRequest> {
  const result = await request<{ joinRequest: JoinRequest }>(
    `/api/pots/join-requests?potId=${encodeURIComponent(potId)}`,
    'POST',
    user,
    { message },
  );
  return result.joinRequest;
}

export async function updateJoinRequest(
  user: UserProfile,
  joinRequestId: string,
  status: JoinRequestStatus,
): Promise<JoinRequest> {
  const result = await request<{ joinRequest: JoinRequest }>(
    `/api/join-requests/update?id=${encodeURIComponent(joinRequestId)}`,
    'PUT',
    user,
    { status },
  );
  return result.joinRequest;
}

export async function getMyPots(user: UserProfile): Promise<{
  ownedPots: TaxiPot[];
  joinRequests: { joinRequest: JoinRequest; pot: TaxiPot | null }[];
}> {
  return request('/api/me/pots', 'GET', user);
}

export async function listNotifications(user: UserProfile): Promise<{
  notifications: TaxiNotification[];
  unreadCount: number;
}> {
  return request('/api/notifications', 'GET', user);
}

export async function markNotificationRead(user: UserProfile, id: string): Promise<TaxiNotification> {
  const result = await request<{ notification: TaxiNotification }>(
    `/api/notifications/update?id=${encodeURIComponent(id)}`,
    'PUT',
    user,
  );
  return result.notification;
}

export async function markAllNotificationsRead(user: UserProfile): Promise<void> {
  await request<{ ok: boolean }>('/api/notifications/update', 'PUT', user, { readAll: true });
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  user: UserProfile,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const idToken = await getUnionIdToken();
  const result = (await Union.request({
    url,
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body,
    timeout: 10000,
  })) as ApiResult<T>;

  if (result.statusCode < 200 || result.statusCode >= 300) {
    const error =
      result.data && typeof result.data === 'object' && 'error' in result.data
        ? result.data.error
        : undefined;
    throw new Error(error || '요청 처리에 실패했습니다.');
  }

  return result.data as T;
}

async function getUnionIdToken(): Promise<string> {
  const auth = Union.auth as unknown as {
    bridge?: {
      invoke: <T>(module: string, action: string, params?: unknown) => Promise<T>;
    };
    getIdToken?: () => Promise<string>;
    getAccessToken: () => Promise<string>;
  };
  if (auth.getIdToken) return auth.getIdToken();

  try {
    if (auth.bridge) return await auth.bridge.invoke<string>('auth', 'getIdToken');
  } catch {
    // Older Union runtimes only expose getAccessToken, which is a deprecated alias.
  }

  return auth.getAccessToken();
}

function normalizePot(values: TaxiPotFormValues) {
  return {
    ...values,
    departureTime: new Date(values.departureTime).toISOString(),
    tags: values.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8),
    estimatedFare: Number(values.estimatedFare),
    maxRiders: Number(values.maxRiders),
  };
}
