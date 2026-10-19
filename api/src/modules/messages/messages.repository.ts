import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../../config/database.js";
import { getDateTime } from "../../utils/shared-functions.js";
import type { User } from "../users/users.types.js";
import type { MessageReaction } from "../rooms/rooms.types.js";

type ReactionRow = RowDataPacket & {
  Emoji: string;
  UserId: number;
  FullName: string;
  AvatarUrl: string;
};

export const messagesRepository = {
  async updateContent(messageId: number, content: string): Promise<void> {
    await db.execute(
      "UPDATE messages SET Content = ?, UpdatedAt = ? WHERE Id = ? AND DeletedAt IS NULL",
      [content, getDateTime(), messageId],
    );
  },

  async delete(messageId: number, authorId: number): Promise<boolean> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        "UPDATE messages SET DeletedAt = ? WHERE Id = ? AND SenderId = ? AND DeletedAt IS NULL",
        [getDateTime(), messageId, authorId],
      );
      if ((result as ResultSetHeader).affectedRows !== 1) {
        await connection.rollback();
        return false;
      }
      await connection.execute("DELETE FROM message_reactions WHERE MessageId = ?", [messageId]);
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async findReactions(messageId: number): Promise<MessageReaction[]> {
    const [rows] = await db.execute(
      `SELECT message_reactions.Emoji, message_reactions.UserId,
              users.FullName, users.AvatarUrl
       FROM message_reactions
       INNER JOIN users ON users.Id = message_reactions.UserId
       WHERE message_reactions.MessageId = ?
       ORDER BY message_reactions.CreatedAt, message_reactions.UserId`,
      [messageId],
    );

    const reactions = new Map<string, MessageReaction>();
    for (const row of rows as ReactionRow[]) {
      let reaction = reactions.get(row.Emoji);
      if (!reaction) {
        reaction = { Emoji: row.Emoji, Count: 0, Users: [] };
        reactions.set(row.Emoji, reaction);
      }
      reaction.Count += 1;
      const user: Pick<User, "Id" | "FullName" | "AvatarUrl"> = {
        Id: row.UserId,
        FullName: row.FullName,
        AvatarUrl: row.AvatarUrl,
      };
      reaction.Users.push(user);
    }
    return [...reactions.values()];
  },

  async addReaction(messageId: number, userId: number, emoji: string): Promise<void> {
    await db.execute(
      `INSERT INTO message_reactions (MessageId, UserId, Emoji, CreatedAt)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE CreatedAt = message_reactions.CreatedAt`,
      [messageId, userId, emoji, getDateTime()],
    );
  },

  async removeReaction(messageId: number, userId: number, emoji: string): Promise<boolean> {
    const [result] = await db.execute(
      "DELETE FROM message_reactions WHERE MessageId = ? AND UserId = ? AND Emoji = ?",
      [messageId, userId, emoji],
    );
    return (result as ResultSetHeader).affectedRows === 1;
  },
};
