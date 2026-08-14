export const ENV = {
  isProduction: process.env.NODE_ENV === "production",

  // Gemini (https://ai.google.dev/api)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  // OpenAI (https://platform.openai.com/docs)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",

  // DeepSeek (https://api-docs.deepseek.com/)
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",

  // Active provider override via env. UI Settings still wins at runtime.
  activeProvider: process.env.LLM_PROVIDER ?? "",

  // Database
  databasePath: process.env.DATABASE_PATH ?? "./data/app.db",

  // Server
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:3002",

  // Auth
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),

  // Notifications (Resend — optional; falls back to console logging if unset)
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
};
