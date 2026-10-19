import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../../config/database.js";
import { getDateTime } from "../../utils/shared-functions.js";
import type { User } from "../users/users.types.js";
import type { CreateRoomInput, CreateRoomMessageInput, UpdateRoomInput } from "./rooms.validation.js";
import type { MessageType, Room, RoomMember, RoomMessage, RoomRole } from "./rooms.types.js";

type RoomMemberRow = RowDataPacket & {
  Id: number;
  RoomId: number;
  UserId: number;
  Role: RoomRole;
  JoinedAt: RoomMember["JoinedAt"];
  FullName: string;
  Email: string;
  AvatarUrl: string;
  UserCreatedAt: User["CreatedAt"];
};

type RoomMessageRow = RowDataPacket & {
  Id: number;
  RoomId: number;
  SenderId: number;
  Type: MessageType;
  Content: string;
  CreatedAt: RoomMessage["CreatedAt"];
  UpdatedAt: RoomMessage["UpdatedAt"];
  SenderFullName: string;
  SenderEmail: string;
  SenderAvatarUrl: string;
};

const roomColumns =
  "rooms.Id AS Id, rooms.Type AS Type, rooms.Name AS Name, rooms.Description AS Description, rooms.Image AS Image, rooms.CreatedBy AS CreatedBy, rooms.CreatedAt AS CreatedAt, rooms.UpdatedAt AS UpdatedAt";

function mapRoomMember(row: RoomMemberRow): RoomMember {
  return {
    Id: row.Id,
    RoomId: row.RoomId,
    UserId: row.UserId,
    Role: row.Role,
    JoinedAt: row.JoinedAt,
    User: {
      Id: row.UserId,
      FullName: row.FullName,
      Email: row.Email,
      AvatarUrl: row.AvatarUrl,
      CreatedAt: row.UserCreatedAt,
    },
  };
}

function mapRoomMessage(row: RoomMessageRow): RoomMessage {
  return {
    Id: row.Id,
    RoomId: row.RoomId,
    SenderId: row.SenderId,
    Type: row.Type,
    Content: row.Content,
    CreatedAt: row.CreatedAt,
    UpdatedAt: row.UpdatedAt,
    Sender: {
      Id: row.SenderId,
      FullName: row.SenderFullName,
      Email: row.SenderEmail,
      AvatarUrl: row.SenderAvatarUrl,
    },
  };
}

export const roomsRepository = {
  async findAllForUser(userId: number): Promise<Room[]> {
    const [rows] = await db.execute(
      `SELECT ${roomColumns} FROM rooms
       INNER JOIN room_members ON room_members.RoomId = rooms.Id
       WHERE room_members.UserId = ? AND room_members.LeftAt IS NULL
       ORDER BY rooms.UpdatedAt DESC`,
      [userId],
    );
    return rows as Room[];
  },

  async findById(roomId: number): Promise<Room | null> {
    const [rows] = await db.execute(`SELECT ${roomColumns} FROM rooms WHERE Id = ? LIMIT 1`, [roomId]);
    return (rows as Room[])[0] ?? null;
  },

  async findForUser(roomId: number, userId: number): Promise<Room | null> {
    const [rows] = await db.execute(
      `SELECT ${roomColumns} FROM rooms
       INNER JOIN room_members ON room_members.RoomId = rooms.Id
       WHERE rooms.Id = ? AND room_members.UserId = ? AND room_members.LeftAt IS NULL
       LIMIT 1`,
      [roomId, userId],
    );
    return (rows as Room[])[0] ?? null;
  },

  async usersExist(userIds: number[]): Promise<boolean> {
    if (userIds.length === 0) return true;
    const placeholders = userIds.map(() => "?").join(", ");
    const [rows] = await db.execute(`SELECT Id FROM users WHERE Id IN (${placeholders})`, userIds);
    return (rows as RowDataPacket[]).length === userIds.length;
  },

  async create(input: CreateRoomInput, creatorId: number): Promise<Room> {
    const connection = await db.getConnection();
    const now = getDateTime();

    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        "INSERT INTO rooms (RoomKey, Type, Name, Description, Image, CreatedBy, CreatedAt, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          randomBytes(16).toString("hex"),
          input.type,
          input.name ?? null,
          input.description ?? null,
          input.image ?? null,
          creatorId,
          now,
          now,
        ],
      );
      const roomId = (result as ResultSetHeader).insertId;
      await connection.execute(
        "INSERT INTO room_members (RoomId, UserId, Role, JoinedAt, LeftAt) VALUES (?, ?, 'OWNER', ?, NULL)",
        [roomId, creatorId, now],
      );

      if (input.memberIds.length > 0) {
        const placeholders = input.memberIds.map(() => "(?, ?, 'MEMBER', ?, NULL)").join(", ");
        const values = input.memberIds.flatMap((memberId) => [roomId, memberId, now]);
        await connection.execute(
          `INSERT INTO room_members (RoomId, UserId, Role, JoinedAt, LeftAt) VALUES ${placeholders}`,
          values,
        );
      }

      await connection.commit();
      const room = await this.findById(roomId);
      if (!room) throw new Error("Created room was not found");
      return room;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async update(roomId: number, input: UpdateRoomInput): Promise<Room | null> {
    const fields: string[] = [];
    const values: (number | string | null)[] = [];

    if (input.name !== undefined) {
      fields.push("Name = ?");
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push("Description = ?");
      values.push(input.description);
    }
    if (input.image !== undefined) {
      fields.push("Image = ?");
      values.push(input.image);
    }
    fields.push("UpdatedAt = ?");
    values.push(getDateTime(), roomId);

    await db.execute(`UPDATE rooms SET ${fields.join(", ")} WHERE Id = ?`, values);
    return this.findById(roomId);
  },

  async delete(roomId: number): Promise<boolean> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const [roomRows] = await connection.execute("SELECT Id FROM rooms WHERE Id = ? FOR UPDATE", [roomId]);
      if ((roomRows as RowDataPacket[]).length === 0) {
        await connection.rollback();
        return false;
      }
      await connection.execute("DELETE FROM messages WHERE RoomId = ?", [roomId]);
      await connection.execute("DELETE FROM room_members WHERE RoomId = ?", [roomId]);
      const [deletedRooms] = await connection.execute("DELETE FROM rooms WHERE Id = ?", [roomId]);
      if ((deletedRooms as ResultSetHeader).affectedRows !== 1) {
        await connection.rollback();
        return false;
      }
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async findMembers(roomId: number): Promise<RoomMember[]> {
    const [rows] = await db.execute(
      `SELECT room_members.Id, room_members.RoomId, room_members.UserId, room_members.Role,
              room_members.JoinedAt, users.FullName, users.Email, users.AvatarUrl, users.CreatedAt AS UserCreatedAt
       FROM room_members
       INNER JOIN users ON users.Id = room_members.UserId
       WHERE room_members.RoomId = ? AND room_members.LeftAt IS NULL
       ORDER BY room_members.JoinedAt`,
      [roomId],
    );
    return (rows as RoomMemberRow[]).map(mapRoomMember);
  },

  async getMemberRole(roomId: number, userId: number): Promise<RoomRole | null> {
    const [rows] = await db.execute(
      "SELECT Role FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
      [roomId, userId],
    );
    return ((rows as (RowDataPacket & { Role: RoomRole })[])[0]?.Role) ?? null;
  },

  async addMember(roomId: number, userId: number): Promise<boolean> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute("SELECT Id FROM rooms WHERE Id = ? FOR UPDATE", [roomId]);
      const [activeMembership] = await connection.execute(
        "SELECT Id FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
        [roomId, userId],
      );
      if ((activeMembership as RowDataPacket[]).length > 0) {
        await connection.rollback();
        return false;
      }

      const now = getDateTime();
      const [previousMembership] = await connection.execute(
        "SELECT Id FROM room_members WHERE RoomId = ? AND UserId = ? ORDER BY Id DESC LIMIT 1",
        [roomId, userId],
      );
      const membershipId = (previousMembership as (RowDataPacket & { Id: number })[])[0]?.Id;

      if (membershipId) {
        await connection.execute(
          "UPDATE room_members SET Role = 'MEMBER', JoinedAt = ?, LeftAt = NULL WHERE Id = ?",
          [now, membershipId],
        );
      } else {
        await connection.execute(
          "INSERT INTO room_members (RoomId, UserId, Role, JoinedAt, LeftAt) VALUES (?, ?, 'MEMBER', ?, NULL)",
          [roomId, userId, now],
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async removeMember(roomId: number, actorId: number, userId: number): Promise<"removed" | "forbidden" | "notFound" | "lastOwner"> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute("SELECT Id FROM rooms WHERE Id = ? FOR UPDATE", [roomId]);
      const [actorRows] = await connection.execute(
        "SELECT Role FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
        [roomId, actorId],
      );
      const actorRole = (actorRows as (RowDataPacket & { Role: RoomRole })[])[0]?.Role;
      if (actorRole !== "OWNER" && actorRole !== "MODERATOR") {
        await connection.rollback();
        return "forbidden";
      }

      const [memberRows] = await connection.execute(
        "SELECT Role FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
        [roomId, userId],
      );
      const member = (memberRows as (RowDataPacket & { Role: RoomRole })[])[0];
      if (!member) {
        await connection.rollback();
        return "notFound";
      }

      if (actorRole === "MODERATOR" && member.Role !== "MEMBER") {
        await connection.rollback();
        return "forbidden";
      }

      if (member.Role === "OWNER") {
        const [ownerRows] = await connection.execute(
          "SELECT COUNT(*) AS OwnerCount FROM room_members WHERE RoomId = ? AND Role = 'OWNER' AND LeftAt IS NULL",
          [roomId],
        );
        if (((ownerRows as (RowDataPacket & { OwnerCount: number })[])[0]?.OwnerCount ?? 0) <= 1) {
          const [nextOwnerRows] = await connection.execute(
            "SELECT UserId FROM room_members WHERE RoomId = ? AND UserId <> ? AND LeftAt IS NULL ORDER BY (Role = 'MODERATOR') DESC, JoinedAt LIMIT 1",
            [roomId, userId],
          );
          const nextOwnerId = (nextOwnerRows as (RowDataPacket & { UserId: number })[])[0]?.UserId;
          if (nextOwnerId === undefined) {
            await connection.rollback();
            return "lastOwner";
          }
          await connection.execute(
            "UPDATE room_members SET Role = 'OWNER' WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL",
            [roomId, nextOwnerId],
          );
        }
      }

      await connection.execute("UPDATE room_members SET LeftAt = ? WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL", [
        getDateTime(),
        roomId,
        userId,
      ]);
      await connection.commit();
      return "removed";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async updateMemberRole(roomId: number, actorId: number, userId: number, role: RoomRole): Promise<"updated" | "forbidden" | "notFound" | "lastOwner"> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute("SELECT Id FROM rooms WHERE Id = ? FOR UPDATE", [roomId]);
      const [actorRows] = await connection.execute(
        "SELECT Role FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
        [roomId, actorId],
      );
      if ((actorRows as RowDataPacket[]).length === 0 || (actorRows as (RowDataPacket & { Role: RoomRole })[])[0]?.Role !== "OWNER") {
        await connection.rollback();
        return "forbidden";
      }

      const [memberRows] = await connection.execute(
        "SELECT Role FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
        [roomId, userId],
      );
      const member = (memberRows as (RowDataPacket & { Role: RoomRole })[])[0];
      if (!member) {
        await connection.rollback();
        return "notFound";
      }

      if (member.Role === "OWNER" && role !== "OWNER") {
        const [ownerRows] = await connection.execute(
          "SELECT COUNT(*) AS OwnerCount FROM room_members WHERE RoomId = ? AND Role = 'OWNER' AND LeftAt IS NULL",
          [roomId],
        );
        if (((ownerRows as (RowDataPacket & { OwnerCount: number })[])[0]?.OwnerCount ?? 0) <= 1) {
          const [nextOwnerRows] = await connection.execute(
            "SELECT UserId FROM room_members WHERE RoomId = ? AND UserId <> ? AND LeftAt IS NULL ORDER BY (Role = 'MODERATOR') DESC, JoinedAt LIMIT 1",
            [roomId, userId],
          );
          const nextOwnerId = (nextOwnerRows as (RowDataPacket & { UserId: number })[])[0]?.UserId;
          if (nextOwnerId === undefined) {
            await connection.rollback();
            return "lastOwner";
          }
          await connection.execute(
            "UPDATE room_members SET Role = 'OWNER' WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL",
            [roomId, nextOwnerId],
          );
        }
      }

      await connection.execute("UPDATE room_members SET Role = ? WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL", [
        role,
        roomId,
        userId,
      ]);
      await connection.commit();
      return "updated";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async leave(roomId: number, userId: number): Promise<"left" | "notFound" | "lastOwner"> {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute("SELECT Id FROM rooms WHERE Id = ? FOR UPDATE", [roomId]);
      const [memberRows] = await connection.execute(
        "SELECT Role FROM room_members WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL LIMIT 1",
        [roomId, userId],
      );
      const member = (memberRows as (RowDataPacket & { Role: RoomRole })[])[0];
      if (!member) {
        await connection.rollback();
        return "notFound";
      }

      if (member.Role === "OWNER") {
        const [ownerRows] = await connection.execute(
          "SELECT COUNT(*) AS OwnerCount FROM room_members WHERE RoomId = ? AND Role = 'OWNER' AND LeftAt IS NULL",
          [roomId],
        );
        if (((ownerRows as (RowDataPacket & { OwnerCount: number })[])[0]?.OwnerCount ?? 0) <= 1) {
          const [nextOwnerRows] = await connection.execute(
            "SELECT UserId FROM room_members WHERE RoomId = ? AND UserId <> ? AND LeftAt IS NULL ORDER BY (Role = 'MODERATOR') DESC, JoinedAt LIMIT 1",
            [roomId, userId],
          );
          const nextOwnerId = (nextOwnerRows as (RowDataPacket & { UserId: number })[])[0]?.UserId;
          if (nextOwnerId === undefined) {
            await connection.rollback();
            return "lastOwner";
          }
          await connection.execute(
            "UPDATE room_members SET Role = 'OWNER' WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL",
            [roomId, nextOwnerId],
          );
        }
      }

      await connection.execute("UPDATE room_members SET LeftAt = ? WHERE RoomId = ? AND UserId = ? AND LeftAt IS NULL", [
        getDateTime(),
        roomId,
        userId,
      ]);
      await connection.commit();
      return "left";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async findMessages(roomId: number): Promise<RoomMessage[]> {
    const [rows] = await db.execute(
      `SELECT messages.Id, messages.RoomId, messages.SenderId, messages.Type, messages.Content,
              messages.CreatedAt, messages.UpdatedAt,
              users.FullName AS SenderFullName, users.Email AS SenderEmail, users.AvatarUrl AS SenderAvatarUrl
       FROM messages
       INNER JOIN users ON users.Id = messages.SenderId
       WHERE messages.RoomId = ? AND messages.DeletedAt IS NULL
       ORDER BY messages.CreatedAt ASC, messages.Id ASC`,
      [roomId],
    );
    return (rows as RoomMessageRow[]).map(mapRoomMessage);
  },

  async findMessageById(messageId: number): Promise<RoomMessage | null> {
    const [rows] = await db.execute(
      `SELECT messages.Id, messages.RoomId, messages.SenderId, messages.Type, messages.Content,
              messages.CreatedAt, messages.UpdatedAt,
              users.FullName AS SenderFullName, users.Email AS SenderEmail, users.AvatarUrl AS SenderAvatarUrl
       FROM messages
       INNER JOIN users ON users.Id = messages.SenderId
       WHERE messages.Id = ? AND messages.DeletedAt IS NULL
       LIMIT 1`,
      [messageId],
    );
    const row = (rows as RoomMessageRow[])[0];
    return row ? mapRoomMessage(row) : null;
  },

  async createMessage(roomId: number, senderId: number, input: CreateRoomMessageInput): Promise<RoomMessage> {
    const now = getDateTime();
    const [result] = await db.execute(
      "INSERT INTO messages (RoomId, SenderId, Type, Content, CreatedAt) VALUES (?, ?, ?, ?, ?)",
      [roomId, senderId, input.type, input.content, now],
    );
    await db.execute("UPDATE rooms SET UpdatedAt = ? WHERE Id = ?", [now, roomId]);

    const [rows] = await db.execute(
      `SELECT messages.Id, messages.RoomId, messages.SenderId, messages.Type, messages.Content,
              messages.CreatedAt, messages.UpdatedAt,
              users.FullName AS SenderFullName, users.Email AS SenderEmail, users.AvatarUrl AS SenderAvatarUrl
       FROM messages
       INNER JOIN users ON users.Id = messages.SenderId
       WHERE messages.Id = ? LIMIT 1`,
      [(result as ResultSetHeader).insertId],
    );
    const row = (rows as RoomMessageRow[])[0];
    if (!row) throw new Error("Created message was not found");
    return mapRoomMessage(row);
  },
};
