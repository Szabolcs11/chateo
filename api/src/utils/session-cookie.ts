import type { CookieOptions, Request, Response } from "express";

import { env } from "../config/env.js";

const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.nodeEnv === "production",
  maxAge: env.sessionCookie.maxAgeMs,
  path: "/"
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.sessionCookie.name, token, sessionCookieOptions);
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.sessionCookie.name, {
    httpOnly: sessionCookieOptions.httpOnly,
    sameSite: sessionCookieOptions.sameSite,
    secure: sessionCookieOptions.secure,
    path: sessionCookieOptions.path
  });
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.header("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  return cookies[env.sessionCookie.name] ?? null;
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, cookie) => {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      return cookies;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}
