import { startServer } from "./server.js";
import { serveStatic } from "./static.js";

startServer((app) => serveStatic(app)).catch(console.error);
