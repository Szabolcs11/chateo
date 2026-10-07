import { z } from "zod";

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(128).optional(),
  avatarUrl: z.string().trim().url().max(128).optional(),
  primaryVehicleId: z.number().int().positive().nullable().optional()
});
