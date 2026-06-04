import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface UserContext {
  userId: string;
  nickname: string;
}

export function setCors(req: VercelRequest, res: VercelResponse): boolean {
  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Union-User-Id, X-Union-Nickname');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

export function sendError(res: VercelResponse, statusCode: number, message: string): void {
  res.status(statusCode).json({ error: message });
}

export function requireUser(req: VercelRequest, res: VercelResponse): UserContext | null {
  const userId = getHeader(req, 'x-union-user-id');
  const nicknameHeader = getHeader(req, 'x-union-nickname');
  const nickname = nicknameHeader ? safeDecode(nicknameHeader) : null;

  if (!userId || !nickname) {
    sendError(res, 401, 'Union 사용자 정보가 필요합니다.');
    return null;
  }

  return { userId, nickname };
}

export function getHeader(req: VercelRequest, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function getStringParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function getBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
