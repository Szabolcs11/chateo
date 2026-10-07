import type { NextFunction, Request, RequestHandler } from "express";

import { authService } from "../modules/auth/auth.service.js";
import { AppError } from "../utils/app-error.js";
import { getSessionTokenFromRequest } from "../utils/session-cookie.js";

export type AuthenticatedUser = {
  Id: number;
  Email: string;
  FullName: string;
  AvatarUrl: string;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export const requireAuth: RequestHandler = (req, _res, next): void => {
  void authenticateRequest(req, next, true).catch(next);
};

export const requireGuest: RequestHandler = (req, _res, next): void => {
  void authenticateRequest(req, next, false).catch(next);
};

async function authenticateRequest(req: Request, next: NextFunction, requireAuthenticatedUser: boolean): Promise<void> {
  const token = getSessionTokenFromRequest(req);

  if (!token) {
    if (!requireAuthenticatedUser) {
      next();
      return;
    }

    next(new AppError(401, "errors.auth.required"));
    return;
  }

  const user = await authService.getUserBySessionToken(token);

  if (!user) {
    if (!requireAuthenticatedUser) {
      next();
      return;
    }

    next(new AppError(401, "errors.auth.required"));
    return;
  }

  if (!requireAuthenticatedUser) {
    next(new AppError(409, "errors.auth.alreadyAuthenticated"));
    return;
  }

  req.user = {
    Id: user.Id,
    Email: user.Email,
    FullName: user.FullName,
    AvatarUrl: user.AvatarUrl,
  };

  next();
}
