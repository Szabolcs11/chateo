import type { DbDate } from "../../types/database.js";
import type { User } from "../users/users.types.js";

export type RoomType = "DIRECT" | "GROUP";
export type RoomRole = "OWNER" | "MODERATOR" | "MEMBER";
export type MessageType = "TEXT" | "IMAGE" | "FILE";

export type Room = {
  Id: number;
  Type: RoomType;
  Name: string | null;
  Description: string | null;
  Image: string | null;
  CreatedBy: number;
  CreatedAt: DbDate;
  UpdatedAt: DbDate;
};

export type RoomMember = {
  Id: number;
  RoomId: number;
  UserId: number;
  Role: RoomRole;
  JoinedAt: DbDate;
  User: User;
};

export type RoomMessage = {
  Id: number;
  RoomId: number;
  SenderId: number;
  Type: MessageType;
  Content: string;
  CreatedAt: DbDate;
  UpdatedAt: DbDate | null;
  Sender: Pick<User, "Id" | "FullName" | "Email" | "AvatarUrl">;
};

export type MessageReaction = {
  Emoji: string;
  Count: number;
  Users: Pick<User, "Id" | "FullName" | "AvatarUrl">[];
};
