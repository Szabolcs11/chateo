import type { MessageKey } from "./localization.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly key: MessageKey;
  public readonly details?: unknown;

  constructor(statusCode: number, key: MessageKey, details?: unknown) {
    super(key);
    this.statusCode = statusCode;
    this.key = key;
    this.details = details;
  }
}
