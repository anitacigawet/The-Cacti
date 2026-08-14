export const AXIOS_TIMEOUT_MS = 30_000;

/** Server-handled Google OAuth entry point. Redirects to Google then back to /. */
export function getLoginUrl(): string {
  return "/api/auth/google";
}
