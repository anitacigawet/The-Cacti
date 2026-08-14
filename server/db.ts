import initSqlJs, { type Database } from "sql.js";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../drizzle/schema.js";
import { ENV } from "./_core/env.js";
import fs from "node:fs";
import path from "node:path";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _sqliteDb: Database | undefined;

function saveToDisk(sqliteDb: Database, dbPath: string) {
  const data = sqliteDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

/** Apply all pending SQL migrations from drizzle/migrations/*.sql */
function applyMigrations(sqliteDb: Database): void {
  const migrationsDir = path.resolve("drizzle/migrations");
  if (!fs.existsSync(migrationsDir)) return;

  // Track applied migrations in a simple meta table
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`);

  const applied = new Set<string>(
    (sqliteDb.exec("SELECT hash FROM __drizzle_migrations") ?? [])
      .flatMap((r) => r.values)
      .map((row) => String(row[0]))
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    // Drizzle separates statements with "--> statement-breakpoint"
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqliteDb.run(stmt);
    }
    sqliteDb.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
      file,
      Date.now(),
    ]);
    console.log(`[Database] Applied migration: ${file}`);
  }
}

export async function initDb(): Promise<void> {
  if (_db) return;

  const SQL = await initSqlJs();
  const dbPath = path.resolve(ENV.databasePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const buffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
  _sqliteDb = buffer ? new SQL.Database(buffer) : new SQL.Database();

  const sqliteDb = _sqliteDb;
  sqliteDb.run("PRAGMA foreign_keys = ON");

  // Apply any pending migrations before exposing the DB
  applyMigrations(sqliteDb);
  saveToDisk(sqliteDb, dbPath);

  const save = () => saveToDisk(sqliteDb, dbPath);

  _db = drizzle(
    async (sql, params, method) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = params as any[];

      if (method === "run") {
        sqliteDb.run(sql, p);
        save();
        return { rows: [] };
      }

      const stmt = sqliteDb.prepare(sql);
      try {
        stmt.bind(p);
        const rows: unknown[][] = [];
        while (stmt.step()) {
          rows.push(stmt.get() as unknown[]);
        }

        // Flush after mutations that use RETURNING (INSERT/UPDATE/DELETE + all/get)
        const upper = sql.trimStart().toUpperCase();
        if (
          upper.startsWith("INSERT") ||
          upper.startsWith("UPDATE") ||
          upper.startsWith("DELETE")
        ) {
          save();
        }

        if (method === "get") {
          return { rows: rows[0] ?? [] };
        }
        return { rows };
      } finally {
        stmt.free();
      }
    },
    { schema }
  );

  console.log(`[Database] SQLite opened at ${dbPath}`);
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) throw new Error("[Database] Not initialized — call initDb() first");
  return _db;
}
