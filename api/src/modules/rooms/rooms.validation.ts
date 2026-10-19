import { z } from "zod";

const idSchema = z.coerce.number().int().positive();

export const roomParamsSchema = z.object({
  id: idSchema,
});

export const roomMemberParamsSchema = z.object({
  id: idSchema,
  userId: idSchema,
});

export const createRoomSchema = z.object({
  type: z.enum(["DIRECT", "GROUP"]).default("GROUP"),
  name: z.string().trim().min(1).max(64).nullable().optional(),
  description: z.string().max(512).nullable().optional(),
  image: z.string().max(128).nullable().optional(),
  memberIds: z
    .array(idSchema)
    .max(100)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length),
});

export const updateRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(64).nullable().optional(),
    description: z.string().max(512).nullable().optional(),
    image: z.string().max(128).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0);

export const addRoomMemberSchema = z.object({
  userId: idSchema,
});

export const updateRoomMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "MODERATOR", "MEMBER"]),
});

export const createRoomMessageSchema = z.object({
  type: z.enum(["TEXT", "IMAGE", "FILE"]).default("TEXT"),
  content: z.string().min(1).max(1024),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateRoomMessageInput = z.infer<typeof createRoomMessageSchema>;
