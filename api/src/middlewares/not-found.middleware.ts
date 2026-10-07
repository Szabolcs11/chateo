import type { RequestHandler } from "express";

import { resolveLanguage, translate } from "../utils/localization.js";

export const notFoundMiddleware: RequestHandler = (req, res) => {
  const language = resolveLanguage(req.header("x-language") ?? req.header("accept-language"));

  res.status(404).json({
    success: false,
    key: "errors.notFound",
    message: translate("errors.notFound", language),
    details: {
      method: req.method,
      path: req.originalUrl
    }
  });
};
