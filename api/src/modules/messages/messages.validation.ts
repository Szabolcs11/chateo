import emojiRegex from "emoji-regex";
import { z } from "zod";

const emojiPattern = new RegExp(`^(?:${emojiRegex().source})$`);

export const messageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1).max(1024),
});

export const messageReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32).regex(emojiPattern),
});

export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageReactionInput = z.infer<typeof messageReactionSchema>;
