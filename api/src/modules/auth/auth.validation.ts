import { z } from "zod";

export const registerSchema = z.object({
  FullName: z.string().trim().min(1).max(128),
  Email: z.string().trim().email().max(128),
  Password: z.string().min(8).max(128),
  PasswordConfirm: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  Email: z.string().trim().email().max(128),
  Password: z.string().min(1).max(128),
  FcmToken: z.string().min(1),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1),
  FcmToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
