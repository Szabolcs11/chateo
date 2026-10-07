import { db } from "../../config/database.js";
import type { User } from "./users.types.js";

export const usersRepository = {
  async findById(_id: number): Promise<void> {
    await db.execute("SELECT 1");
  },
  async getAllUser(): Promise<User[]> {
    const [rows] = await db.execute("SELECT Id, FullName, FcmToken FROM users");
    const user = rows as User[];
    return user;
  },
};
