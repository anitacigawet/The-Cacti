import { startServer } from "./server.js";
import { setupVite } from "./vite.js";

startServer(setupVite).catch(console.error);
