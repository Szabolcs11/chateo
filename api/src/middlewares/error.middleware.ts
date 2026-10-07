import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../utils/app-error.js";
import { logError } from "../utils/error-logger.js";
import { resolveLanguage, translate } from "../utils/localization.js";
import { formatValidationErrors } from "../utils/validation-errors.js";

export const errorMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  const language = resolveLanguage(req.header("x-language") ?? req.header("accept-language"));
  const statusCode = error instanceof AppError ? error.statusCode : error instanceof ZodError ? 400 : 500;

  void logError(error, {
    method: req.method,
    path: req.originalUrl,
    statusCode,
  });

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      key: "errors.validation.failed",
      message: translate("errors.validation.failed", language),
      errors: formatValidationErrors(error.issues, language)
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      key: error.key,
      message: translate(error.key, language),
      details: error.details
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    key: "errors.internal",
    message: translate("errors.internal", language)
  });
};
