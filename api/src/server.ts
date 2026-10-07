import { env } from "./config/env.js";
import { app } from "./app.js";
import { verifyDatabaseConnection } from "./config/database.js";
import { logError } from "./utils/error-logger.js";

async function startServer(): Promise<void> {
  try {
    await verifyDatabaseConnection();
    console.log(`Database connected: ${env.db.host}:${env.db.port}/${env.db.database}`);

    app.listen(env.port, () => {
      console.log(`API server is running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Database connection failed. The API server was not started.", error);
    await logError(error, { event: "server_startup", statusCode: 500 });
    process.exitCode = 1;
  }
}

void startServer();
