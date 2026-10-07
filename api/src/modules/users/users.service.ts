import { AppError } from "../../utils/app-error.js";

export const usersService = {
  async getProfile(_userId: number | undefined): Promise<never> {
    throw new AppError(501, "errors.notImplemented");
  },

  async updateProfile(_userId: number | undefined, _input: unknown): Promise<never> {
    throw new AppError(501, "errors.notImplemented");
  }
};
