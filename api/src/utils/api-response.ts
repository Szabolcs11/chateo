import type { Request, Response } from "express";

import type { MessageKey } from "./localization.js";
import { resolveLanguage, translate } from "./localization.js";

type SuccessResponseOptions<TData> = {
  statusCode: number;
  messageKey?: MessageKey;
  data?: TData;
};

export function sendSuccess<TData>(
  res: Response,
  req: Request,
  options: SuccessResponseOptions<TData>
): void {
  const language = resolveLanguage(req.header("x-language") ?? req.header("accept-language"));
  const responseBody: {
    success: true;
    message: string;
    data?: TData;
  } = {
    success: true,
    message: options.messageKey ? translate(options.messageKey, language) : ""
  };

  if (options.data !== undefined) {
    responseBody.data = options.data;
  }

  res.status(options.statusCode).json(responseBody);
}
