import type { NextFunction, Request, RequestHandler } from "express";
import { AppError } from "../../utils/app-error";

export const requireAvatarId: RequestHandler = (req, _res, next): void => {
  void requireAvatar(req, next).catch(next);
};

async function requireAvatar(req: Request, next: NextFunction): Promise<void> {
  const id = req.params["id"];
  if (!id) {
    next(new AppError(401, "errors.notFound"));
  }

  next();
}
