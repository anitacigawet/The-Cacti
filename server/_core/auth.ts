import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { ENV } from "./env.js";
import { getDb } from "../db.js";
import { users, type User, type UserTier } from "../../drizzle/schema.js";

// ─── JWT (HS256) ────────────────────────────────────────────────────────────

const SESSION_COOKIE = "cacti_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export type SessionPayload = {
  uid: number;
  iat: number;
  exp: number;
};

export function signSession(uid: number): string {
  const secret = ENV.jwtSecret;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { uid, iat: now, exp: now + SESSION_MAX_AGE_SEC };
  const body = b64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const sig = b64url(crypto.createHmac("sha256", secret).update(signingInput).digest());
  return `${signingInput}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const secret = ENV.jwtSecret;
  if (!secret) return null;
  const expected = b64url(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest());
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ─────────────────────────────────────────────────────────

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string): void {
  const secure = ENV.isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

export function readSessionCookie(req: Request): string | null {
  return parseCookie(req.headers.cookie, SESSION_COOKIE);
}

// ─── User lookup from request ───────────────────────────────────────────────

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
  return rows[0] ?? null;
}

// ─── Google OAuth ───────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_COOKIE = "cacti_oauth_state";
const STATE_MAX_AGE_SEC = 60 * 10; // 10 minutes

export function buildGoogleAuthUrl(state: string): string {
  const redirectUri = `${ENV.publicUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: ENV.googleOauthClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function setOauthStateCookie(res: Response, state: string): void {
  const secure = ENV.isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${STATE_MAX_AGE_SEC}${secure}`
  );
}

export function readOauthStateCookie(req: Request): string | null {
  return parseCookie(req.headers.cookie, STATE_COOKIE);
}

export function clearOauthStateCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const redirectUri = `${ENV.publicUrl}/api/auth/google/callback`;
  const body = new URLSearchParams({
    code,
    client_id: ENV.googleOauthClientId,
    client_secret: ENV.googleOauthClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${errText}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google userinfo failed: ${res.status} ${errText}`);
  }
  return (await res.json()) as GoogleUserInfo;
}

// ─── User upsert ────────────────────────────────────────────────────────────

export async function upsertUserFromGoogle(profile: GoogleUserInfo): Promise<User> {
  const db = getDb();
  const email = profile.email.toLowerCase();
  const isOwner = ENV.ownerEmail !== "" && email === ENV.ownerEmail;
  const initialTier: UserTier = isOwner ? "owner" : "invited";

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleId, profile.sub))
    .limit(1);

  if (existing.length > 0) {
    const u = existing[0];
    // Promote to owner on subsequent sign-in if email matches OWNER_EMAIL.
    const nextTier: UserTier = isOwner ? "owner" : (u.tier as UserTier);
    await db
      .update(users)
      .set({
        email,
        name: profile.name ?? u.name,
        avatarUrl: profile.picture ?? u.avatarUrl,
        tier: nextTier,
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, u.id));
    return { ...u, email, name: profile.name ?? u.name, avatarUrl: profile.picture ?? u.avatarUrl, tier: nextTier, lastSeenAt: new Date() };
  }

  const inserted = await db
    .insert(users)
    .values({
      googleId: profile.sub,
      email,
      name: profile.name ?? email,
      avatarUrl: profile.picture ?? null,
      tier: initialTier,
    })
    .returning();
  return inserted[0];
}

// ─── Tier helpers ───────────────────────────────────────────────────────────

export type EffectiveTier = UserTier;

export function effectiveTier(user: User | null): EffectiveTier {
  if (!user) return "public";
  return user.tier as UserTier;
}

/**
 * Returns the maximum `createdAt` a user of this tier is allowed to see.
 * Use as `WHERE createdAt <= freshnessThreshold(tier)` — older data is allowed,
 * newer data is hidden until enough time has passed.
 *
 * - Owner: now (sees everything except future-dated rows).
 * - Invited: now − 3 hours (data must be at least 3 hours old).
 * - Public (anonymous): now − 24 hours (data must be at least 24 hours old).
 */
export function freshnessThreshold(tier: EffectiveTier): Date {
  const now = Date.now();
  switch (tier) {
    case "owner":
      return new Date(now);
    case "invited":
      return new Date(now - 3 * 60 * 60 * 1000);
    case "public":
    default:
      return new Date(now - 24 * 60 * 60 * 1000);
  }
}
