import { ResultSetHeader } from "mysql2";
import { db } from "../../config/database.js";
import { DEFAULT_AVATARURL } from "../../config/utils.js";
import { createSessionToken } from "../../utils/session-token.js";
import { getDateTime } from "../../utils/shared-functions.js";
import type { User } from "../users/users.types.js";
import bcrypt from "bcrypt";

export const authRepository = {
  async createSession(userId: number): Promise<string> {
    const token = createSessionToken();
    const [rows] = await db.execute("INSERT INTO sessions (UserId, Token, CreatedAt) VALUES (?, ?, ?)", [
      userId,
      token,
      getDateTime(),
    ]);
    const insertId = (rows as { insertId: number }).insertId;
    if (!insertId) throw new Error("Failed to create session");

    return token;
  },
  async findUserByEmail(email: string): Promise<User | null> {
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    const user = (rows as User[])[0];
    return user || null;
  },
  async findUserById(userId: number): Promise<User | null> {
    const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    const user = (rows as User[])[0];
    return user || null;
  },
  async findUserBySessionToken(token: string): Promise<User | null> {
    const [rows] = await db.execute(
      `
        SELECT users.*
        FROM sessions
        INNER JOIN users ON users.Id = sessions.UserId
        WHERE sessions.Token = ?
        LIMIT 1
      `,
      [token],
    );
    const user = (rows as User[])[0];
    return user || null;
  },
  async createUser(fullName: string, email: string, password: string): Promise<{ id: number }> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      "INSERT INTO users (FullName, Email, Password, AvatarUrl, CreatedAt) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, hashedPassword, DEFAULT_AVATARURL, getDateTime()],
    );
    const insertId = (result as { insertId: number }).insertId;
    return { id: insertId };
  },
  async verifyPassword(userId: number, password: string): Promise<boolean> {
    const [rows] = await db.execute("SELECT Password FROM users WHERE id = ?", [userId]);
    const user = (rows as { Password: string }[])[0];
    if (!user) return false;
    const isPasswordMatch = await bcrypt.compare(password, user.Password);
    return isPasswordMatch;
  },
  async updateFcmToken(userId: number, token: string): Promise<boolean> {
    const [rows] = await db.execute("UPDATE users SET FcmToken = ? WHERE Id = ?", [token, userId]).catch((error) => {
      throw error;
    });
    if (!(rows as ResultSetHeader).affectedRows) return false;
    return true;
  },
};
