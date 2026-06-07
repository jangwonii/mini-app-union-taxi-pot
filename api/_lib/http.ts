import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';

export interface UserContext {
  userId: string;
  nickname: string;
}

export function setCors(req: VercelRequest, res: VercelResponse): boolean {
  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

export function sendError(res: VercelResponse, statusCode: number, message: string): void {
  res.status(statusCode).json({ error: message });
}

export function sendServerError(res: VercelResponse, error: unknown): void {
  const message = getErrorMessage(error);
  console.error('[api:error]', message, error);
  sendError(res, 500, message);
}

let jwksUrl: string | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<UserContext | null> {
  const authHeader = getHeader(req, 'authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;

  if (token) {
    const verified = await verifyUnionToken(token);
    if (verified) return verified;
  }

  if (process.env.NODE_ENV === 'production') {
    sendError(res, 401, 'Union 인증 토큰이 필요합니다.');
    return null;
  }

  const userId = getHeader(req, 'x-union-user-id');
  const nicknameHeader = getHeader(req, 'x-union-nickname');
  const nickname = nicknameHeader ? safeDecode(nicknameHeader) : null;

  if (!userId || !nickname) {
    sendError(res, 401, 'Union 사용자 정보가 필요합니다.');
    return null;
  }

  return { userId, nickname };
}

async function verifyUnionToken(token: string): Promise<UserContext | null> {
  const jwksUrlEnv = process.env.UNION_JWKS_URL;
  const issuer = process.env.UNION_ISSUER;
  const audience = process.env.UNION_AUDIENCE;

  if (jwksUrlEnv && issuer && audience) {
    try {
      if (!jwks || jwksUrl !== jwksUrlEnv) {
        jwksUrl = jwksUrlEnv;
        jwks = createRemoteJWKSet(new URL(jwksUrlEnv));
      }

      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['RS256'],
        issuer,
        audience,
      });
      return userFromTokenPayload(payload);
    } catch (error) {
      console.error('[auth:error]', getErrorMessage(error));
      return null;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    if (token.startsWith('mock_access_token_')) {
      return { userId: 'mock-user-001', nickname: 'Mock유저' };
    }

    try {
      return userFromTokenPayload(decodeJwt(token));
    } catch {
      return null;
    }
  }

  return null;
}

function userFromTokenPayload(payload: JWTPayload): UserContext | null {
  if (typeof payload.sub !== 'string' || !payload.sub) return null;

  const nickname = typeof payload.nickname === 'string' && payload.nickname
    ? payload.nickname
    : `Union-${payload.sub.slice(0, 8)}`;

  return { userId: payload.sub, nickname };
}

function devUserFromHeaders(req: VercelRequest): UserContext | null {
  const userId = getHeader(req, 'x-union-user-id');
  const nicknameHeader = getHeader(req, 'x-union-nickname');
  const nickname = nicknameHeader ? safeDecode(nicknameHeader) : null;
  return userId && nickname ? { userId, nickname } : null;
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return '서버 오류가 발생했습니다.';
}
