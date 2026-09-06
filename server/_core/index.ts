import { startServer } from "./server.js";
import { setupVite } from "./vite.js";

startServer(async (app, server) => { await setupVite(app, server); }).catch(console.error);
