import { defineConfig } from "drizzle-kit";

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
