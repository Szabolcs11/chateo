import type { RequestHandler } from "express";

import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import { setSessionCookie } from "../../utils/session-cookie.js";
import { getSessionTokenFromRequest } from "../../utils/session-cookie.js";
import { authService } from "./auth.service.js";

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  sendSuccess(res, req, {
    statusCode: 201,
    messageKey: "success.userCreated",
    data: {
      user: result,
    },
  });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  setSessionCookie(res, result.token);
  sendSuccess(res, req, {
    statusCode: 200,
    messageKey: "success.login",
    data: {
      user: result.user,
    },
  });
});

export const googleLogin: RequestHandler = asyncHandler(async (req, res) => {
  const { idToken, FcmToken } = req.body;
  const result = await authService.googleLogin({ idToken: idToken, FcmToken: FcmToken });
  setSessionCookie(res, result.token);
  sendSuccess(res, req, {
    statusCode: 200,
    messageKey: "success.googleLogin",
    data: {
      user: result.user,
    },
  });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const token = getSessionTokenFromRequest(req);
  if (!token) throw new AppError(401, "errors.auth.required");
  await authService.logout(token, res);
  sendSuccess(res, req, {
    statusCode: 200,
    messageKey: "success.logout",
  });
});

export const authenticate: RequestHandler = asyncHandler(async (req, res) => {
  res.status(200).json({ user: req.user });
});
