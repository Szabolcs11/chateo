import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type ErrorLogContext = {
  event?: string;
  method?: string;
  path?: string;
  statusCode?: number;
};

export async function logError(error: unknown, context: ErrorLogContext = {}): Promise<void> {
  const now = new Date();
  const logDirectory = path.resolve(process.cwd(), "logs", "errors", formatLocalDate(now));
  const logFile = path.join(logDirectory, "error.log");
  const entry = {
    timestamp: now.toISOString(),
    ...context,
    error: serializeError(error),
  };

  try {
    await mkdir(logDirectory, { recursive: true });
    await appendFile(logFile, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (loggingError) {
    console.error("Unable to write to the error log.", loggingError);
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}
