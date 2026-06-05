import Union from '@union-miniapp/sdk';
import type { JoinRequest, JoinRequestStatus, TaxiPot, TaxiPotFormValues, TimeFilter, UserProfile } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface ApiResult<T> {
  statusCode: number;
  data: T | { error?: string };
}

export async function listPots(
  user: UserProfile,
  filters: { q?: string; tag?: string; time?: TimeFilter },
): Promise<TaxiPot[]> {
  const params = new URLSearchParams({ userId: user.userId });
  if (filters.q) params.set('q', filters.q);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.time && filters.time !== 'all') params.set('time', filters.time);
  const result = await request<{ pots: TaxiPot[] }>(`/api/pots?${params.toString()}`, 'GET', user);
  return result.pots;
}

export async function getPot(user: UserProfile, id: string): Promise<TaxiPot> {
  const params = new URLSearchParams({ id, userId: user.userId });
  const result = await request<{ pot: TaxiPot }>(`/api/pots/detail?${params.toString()}`, 'GET', user);
  return result.pot;
}

export async function createPot(user: UserProfile, values: TaxiPotFormValues): Promise<TaxiPot> {
  const result = await request<{ pot: TaxiPot }>('/api/pots', 'POST', user, normalizePot(values));
  return result.pot;
}

export async function closePot(user: UserProfile, id: string): Promise<TaxiPot> {
  const result = await request<{ pot: TaxiPot }>(`/api/pots/detail?id=${encodeURIComponent(id)}`, 'PATCH', user, { status: 'closed' });
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
    'PATCH',
    user,
    { status },
  );
  return result.joinRequest;
}

export async function getMyPots(user: UserProfile): Promise<{
  ownedPots: TaxiPot[];
  joinRequests: { joinRequest: JoinRequest; pot: TaxiPot | null }[];
}> {
  return request(`/api/me/pots?userId=${encodeURIComponent(user.userId)}`, 'GET', user);
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  user: UserProfile,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const result = (await Union.request({
    url,
    method: method as any,
    headers: {
      'Content-Type': 'application/json',
      'X-Union-User-Id': user.userId,
      'X-Union-Nickname': encodeURIComponent(user.nickname),
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
