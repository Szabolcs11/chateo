import { z } from "zod";

import { createRoomMessageSchema } from "../modules/rooms/rooms.validation.js";
import { messageReactionSchema } from "../modules/messages/messages.validation.js";

const positiveId = z.number().int().positive();

export const roomSocketPayloadSchema = z.object({
  roomId: positiveId,
});

export const sendMessageSocketPayloadSchema = roomSocketPayloadSchema.extend({
  type: createRoomMessageSchema.shape.type,
  content: createRoomMessageSchema.shape.content,
});

export const editMessageSocketPayloadSchema = z.object({
  messageId: positiveId,
  content: createRoomMessageSchema.shape.content,
});

export const deleteMessageSocketPayloadSchema = z.object({
  messageId: positiveId,
});

export const reactionSocketPayloadSchema = z.object({
  messageId: positiveId,
  emoji: messageReactionSchema.shape.emoji,
});
