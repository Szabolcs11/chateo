import { AppError } from "../../utils/app-error.js";
import { roomsService } from "../rooms/rooms.service.js";
import { roomsRepository } from "../rooms/rooms.repository.js";
import type { RoomMessage } from "../rooms/rooms.types.js";
import { messagesRepository } from "./messages.repository.js";
import type { MessageReaction } from "../rooms/rooms.types.js";
import type { MessageReactionInput, UpdateMessageInput } from "./messages.validation.js";

export const messagesService = {
  async get(messageId: number, userId: number): Promise<RoomMessage> {
    const message = await this.requireMessage(messageId, userId);
    return message;
  },

  async update(messageId: number, userId: number, input: UpdateMessageInput): Promise<RoomMessage> {
    const message = await this.requireMessage(messageId, userId);
    if (message.SenderId !== userId) throw new AppError(403, "message.notAuthor");
    await messagesRepository.updateContent(messageId, input.content);
    const updatedMessage = await roomsRepository.findMessageById(messageId);
    if (!updatedMessage) throw new AppError(404, "message.notFound");
    return updatedMessage;
  },

  async delete(messageId: number, userId: number): Promise<void> {
    const message = await this.requireMessage(messageId, userId);
    if (message.SenderId !== userId) throw new AppError(403, "message.notAuthor");
    if (!(await messagesRepository.delete(messageId, userId))) {
      throw new AppError(404, "message.notFound");
    }
  },

  async getReactions(messageId: number, userId: number): Promise<MessageReaction[]> {
    await this.requireMessage(messageId, userId);
    return messagesRepository.findReactions(messageId);
  },

  async addReaction(messageId: number, userId: number, input: MessageReactionInput): Promise<void> {
    await this.requireMessage(messageId, userId);
    await messagesRepository.addReaction(messageId, userId, input.emoji);
  },

  async removeReaction(messageId: number, userId: number, input: MessageReactionInput): Promise<void> {
    await this.requireMessage(messageId, userId);
    if (!(await messagesRepository.removeReaction(messageId, userId, input.emoji))) {
      throw new AppError(404, "message.reactionNotFound");
    }
  },

  async requireMessage(messageId: number, userId: number): Promise<RoomMessage> {
    const message = await roomsRepository.findMessageById(messageId);
    if (!message) throw new AppError(404, "message.notFound");
    await roomsService.requireMember(message.RoomId, userId);
    return message;
  },
};
