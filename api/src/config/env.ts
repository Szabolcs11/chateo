import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().default("parkolos"),
  SESSION_TOKEN_BYTES: z.coerce.number().int().positive().default(16),
  SESSION_COOKIE_NAME: z.string().default("chateo_session"),
  SESSION_COOKIE_MAX_AGE_DAYS: z.coerce.number().int().positive().default(180),
  PUSH_NOTIFICATIONS_ENABLED: z.enum(["true", "false"]).default("true"),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  nodeEnv: parsedEnv.NODE_ENV,
  port: parsedEnv.PORT,
  db: {
    host: parsedEnv.DB_HOST,
    port: parsedEnv.DB_PORT,
    user: parsedEnv.DB_USER,
    password: parsedEnv.DB_PASSWORD,
    database: parsedEnv.DB_NAME,
  },
  sessionTokenBytes: parsedEnv.SESSION_TOKEN_BYTES,
  sessionCookie: {
    name: parsedEnv.SESSION_COOKIE_NAME,
    maxAgeMs: parsedEnv.SESSION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  },
  pushNotificationsEnabled: parsedEnv.PUSH_NOTIFICATIONS_ENABLED === "true",
  googleClientId: parsedEnv.GOOGLE_CLIENT_ID,
};
