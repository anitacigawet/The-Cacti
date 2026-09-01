import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import net from "node:net";
import { initDb } from "../db.js";
import { appRouter } from "../routers.js";
import { registerSSERoute } from "../routers/realtime.js";
import { startScheduler } from "../scheduler.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { createContext } from "./context.js";

export type FrontendMount = (app: Express, server: Server) => void | Promise<void>;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(port, () => probe.close(() => resolve(true)));
    probe.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

export async function startServer(mountFrontend: FrontendMount): Promise<void> {
  await initDb();

  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  registerSSERoute(app);
  registerAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  await mountFrontend(app, server);

  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} busy, using ${port}`);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startScheduler();
  });
}
