import type { Response } from "express";
import { AppError } from "../../utils/app-error.js";
import { clearSessionCookie } from "../../utils/session-cookie.js";
import type { User } from "../users/users.types.js";
import { authRepository } from "./auth.repository.js";
import type { GoogleLoginInput, LoginInput, RegisterInput } from "./auth.validation.js";

export const authService = {
  async register(input: RegisterInput): Promise<User> {
    const { FullName, Email, Password, PasswordConfirm } = input;
    if (Password !== PasswordConfirm) throw new AppError(400, "validation.passwordsDoNotMatch");
    const userWithEmail = await authRepository.findUserByEmail(Email);
    if (userWithEmail) throw new AppError(400, "validation.emailAlreadyExists");

    const createdUserId = await authRepository.createUser(FullName, Email, Password);
    const user = await authRepository.findUserById(createdUserId.id);
    if (!user) throw new AppError(500, "errors.internal");
    return user;
  },

  async login(input: LoginInput): Promise<{ token: string; user: User }> {
    const { Email, Password, FcmToken } = input;
    const user = await authRepository.findUserByEmail(Email);
    if (!user) throw new AppError(401, "errors.invalidCredentials");

    const isPasswordValid = await authRepository.verifyPassword(user.Id, Password);
    if (!isPasswordValid) throw new AppError(401, "errors.invalidCredentials");

    const token = await authRepository.createSession(user.Id);
    await authRepository.updateFcmToken(user.Id, FcmToken ?? "");
    return { token, user };
  },

  async getUserBySessionToken(token: string): Promise<User | null> {
    return authRepository.findUserBySessionToken(token);
  },

  async googleLogin(input: GoogleLoginInput): Promise<{ token: string; user: User }> {
    const { idToken, FcmToken } = input;

    const payload = JSON.parse(Buffer.from((idToken as any).split(".")[1], "base64").toString());

    if (!payload) throw new AppError(400, "errors.invalidGoogleToken");
    const { sub, email, name } = payload;
    if (!sub || !email || !name) throw new AppError(400, "errors.internal");
    let user = await authRepository.findUserByEmail(email);
    if (user) {
      const token = await authRepository.createSession(user.Id);
      await authRepository.updateFcmToken(user.Id, FcmToken ?? "");
      return { token, user };
    }
    const createdUserId = await authRepository.createUser(name, email, sub);
    user = await authRepository.findUserById(createdUserId.id);
    if (!user) throw new AppError(500, "errors.internal");
    const token = await authRepository.createSession(user.Id);
    await authRepository.updateFcmToken(user.Id, FcmToken ?? "");
    return { token, user };
  },

  async logout(res: Response): Promise<void> {
    await clearSessionCookie(res);
  },
};
