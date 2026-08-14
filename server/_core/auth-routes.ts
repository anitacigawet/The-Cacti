import crypto from "node:crypto";
import type { Application, Request, Response } from "express";
import {
  buildGoogleAuthUrl,
  clearOauthStateCookie,
  clearSessionCookie,
  exchangeCodeForToken,
  fetchGoogleUserInfo,
  readOauthStateCookie,
  setOauthStateCookie,
  setSessionCookie,
  signSession,
  upsertUserFromGoogle,
} from "./auth.js";
import { ENV } from "./env.js";

export function registerAuthRoutes(app: Application): void {
  // GET /api/auth/google — kick off Google OAuth flow
  app.get("/api/auth/google", (_req: Request, res: Response) => {
    if (!ENV.googleOauthClientId || !ENV.googleOauthClientSecret) {
      res
        .status(500)
        .send("Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.");
      return;
    }
    const state = crypto.randomBytes(24).toString("hex");
    setOauthStateCookie(res, state);
    res.redirect(buildGoogleAuthUrl(state));
  });

  // GET /api/auth/google/callback — exchange code for token, sign session, redirect home
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const expectedState = readOauthStateCookie(req);
      const { code, state, error } = req.query as Record<string, string | undefined>;
      clearOauthStateCookie(res);

      if (error) {
        res.status(400).send(`Google OAuth error: ${error}`);
        return;
      }
      if (!code || !state || state !== expectedState) {
        res.status(400).send("Invalid OAuth state — please try signing in again.");
        return;
      }

      const tokenResponse = await exchangeCodeForToken(code);
      const profile = await fetchGoogleUserInfo(tokenResponse.access_token);

      if (!profile.email) {
        res.status(400).send("Google account did not return an email address.");
        return;
      }

      const user = await upsertUserFromGoogle(profile);
      const session = signSession(user.id);
      setSessionCookie(res, session);
      res.redirect("/");
    } catch (err) {
      console.error("[auth] OAuth callback failed:", err);
      res.status(500).send("Sign-in failed. Please try again.");
    }
  });

  // POST /api/auth/logout — clear the session cookie
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.json({ success: true });
  });
}
