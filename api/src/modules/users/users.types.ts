import type { DbDate } from "../../types/database.js";

export type User = {
  Id: number;
  FullName: string;
  Email: string;
  AvatarUrl: string;
  GoogleId: string;
  PrimaryVehicleId: number | null;
  FcmToken: string;
  CreatedAt: DbDate;
};
