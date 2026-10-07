import type { DbDate } from "../../types/database.js";

export type User = {
  Id: number;
  FullName: string;
  Email: string;
  AvatarUrl: string;
  GoogleId?: string;
  FcmToken?: string;
  CreatedAt: DbDate;
};
