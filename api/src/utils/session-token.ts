import crypto from "node:crypto";

import { env } from "../config/env.js";

export function createSessionToken(): string {
  return crypto.randomBytes(env.sessionTokenBytes).toString("hex");
}
