import { createServer } from "node:http";

import { env } from "./config/env.js";
import { app } from "./app.js";
import { db, verifyDatabaseConnection } from "./config/database.js";
import { closeSocketServer, initializeSocketServer } from "./realtime/socket.server.js";
import { logError } from "./utils/error-logger.js";

const httpServer = createServer(app);
const socketServer = initializeSocketServer(httpServer);
let shutdownStarted = false;

async function startServer(): Promise<void> {
  try {
    await verifyDatabaseConnection();
    console.log(`Database connected: ${env.db.host}:${env.db.port}/${env.db.database}`);

    httpServer.listen(env.port, () => {
      console.log(`API server is running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Database connection failed. The API server was not started.", error);
    try {
      await closeSocketServer(socketServer);
    } catch (shutdownError) {
      console.error("Failed to close the Socket.IO server after startup failure.", shutdownError);
      await logError(shutdownError, { event: "server_startup_cleanup", statusCode: 500 });
    }
    try {
      await db.end();
    } catch (shutdownError) {
      console.error("Failed to close the database pool after startup failure.", shutdownError);
      await logError(shutdownError, { event: "server_startup_cleanup", statusCode: 500 });
    }
    await logError(error, { event: "server_startup", statusCode: 500 });
    process.exitCode = 1;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`Received ${signal}; shutting down the API server`);

  try {
    await closeSocketServer(socketServer);
    await db.end();
  } catch (error) {
    console.error("API server shutdown failed.", error);
    await logError(error, { event: "server_shutdown", statusCode: 500 });
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

void startServer();
