import { AppError } from "../../utils/app-error.js";
import { authRepository } from "../auth/auth.repository.js";
import { User } from "./users.types.js";

export const usersService = {
  async getProfile(userId: number): Promise<User> {
    if (!userId) throw new AppError(404, "user.not_found");
    const user = await authRepository.findUserById(userId);
    if (!user) throw new AppError(404, "user.not_found");
    return user;
  },

  async updateProfile(_userId: number | undefined, _input: unknown): Promise<never> {
    throw new AppError(501, "errors.notImplemented");
  },
};
