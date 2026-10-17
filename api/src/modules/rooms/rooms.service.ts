import { AppError } from "../../utils/app-error.js";
import { roomsRepository } from "./rooms.repository.js";
import type { CreateRoomInput, CreateRoomMessageInput, UpdateRoomInput } from "./rooms.validation.js";
import type { Room, RoomMember, RoomMessage } from "./rooms.types.js";

export const roomsService = {
  async getAll(userId: number): Promise<Room[]> {
    return roomsRepository.findAllForUser(userId);
  },

  async create(userId: number, input: CreateRoomInput): Promise<Room> {
    if (input.type === "DIRECT" && input.memberIds.length !== 1) {
      throw new AppError(400, "room.directMembers");
    }
    if (input.memberIds.includes(userId)) throw new AppError(400, "room.cannotAddSelf");
    if (!(await roomsRepository.usersExist(input.memberIds))) throw new AppError(404, "room.userNotFound");
    return roomsRepository.create(input, userId);
  },

  async get(roomId: number, userId: number): Promise<Room> {
    const room = await roomsRepository.findForUser(roomId, userId);
    if (!room) {
      if (!(await roomsRepository.findById(roomId))) throw new AppError(404, "room.notFound");
      throw new AppError(403, "errors.forbidden");
    }
    return room;
  },

  async update(roomId: number, userId: number, input: UpdateRoomInput): Promise<Room> {
    await this.requireOwner(roomId, userId);
    const room = await roomsRepository.update(roomId, input);
    if (!room) throw new AppError(404, "room.notFound");
    return room;
  },

  async delete(roomId: number, userId: number): Promise<void> {
    await this.requireOwner(roomId, userId);
    if (!(await roomsRepository.delete(roomId))) throw new AppError(404, "room.notFound");
  },

  async getMembers(roomId: number, userId: number): Promise<RoomMember[]> {
    await this.requireMember(roomId, userId);
    return roomsRepository.findMembers(roomId);
  },

  async addMember(roomId: number, actorId: number, userId: number): Promise<void> {
    await this.requireModerator(roomId, actorId);
    const room = await roomsRepository.findById(roomId);
    if (room?.Type === "DIRECT") throw new AppError(400, "room.directMembers");
    if (!(await roomsRepository.usersExist([userId]))) throw new AppError(404, "room.userNotFound");
    if (!(await roomsRepository.addMember(roomId, userId))) throw new AppError(409, "room.alreadyMember");
  },

  async removeMember(roomId: number, actorId: number, userId: number): Promise<void> {
    await this.ensureRoomExists(roomId);
    const result = await roomsRepository.removeMember(roomId, actorId, userId);
    if (result === "forbidden") throw new AppError(403, "errors.forbidden");
    if (result === "notFound") throw new AppError(404, "room.memberNotFound");
    if (result === "lastOwner") throw new AppError(409, "room.lastOwner");
  },

  async updateMemberRole(roomId: number, actorId: number, userId: number, role: "OWNER" | "MODERATOR" | "MEMBER"): Promise<void> {
    await this.ensureRoomExists(roomId);
    const result = await roomsRepository.updateMemberRole(roomId, actorId, userId, role);
    if (result === "forbidden") throw new AppError(403, "errors.forbidden");
    if (result === "notFound") throw new AppError(404, "room.memberNotFound");
    if (result === "lastOwner") throw new AppError(409, "room.lastOwner");
  },

  async leave(roomId: number, userId: number): Promise<void> {
    await this.ensureRoomExists(roomId);
    const result = await roomsRepository.leave(roomId, userId);
    if (result === "notFound") throw new AppError(404, "room.memberNotFound");
    if (result === "lastOwner") throw new AppError(409, "room.lastOwner");
  },

  async getMessages(roomId: number, userId: number): Promise<RoomMessage[]> {
    await this.requireMember(roomId, userId);
    return roomsRepository.findMessages(roomId);
  },

  async sendMessage(roomId: number, userId: number, input: CreateRoomMessageInput): Promise<RoomMessage> {
    await this.requireMember(roomId, userId);
    return roomsRepository.createMessage(roomId, userId, input);
  },

  async requireMember(roomId: number, userId: number): Promise<void> {
    if (!(await roomsRepository.findForUser(roomId, userId))) {
      await this.ensureRoomExists(roomId);
      throw new AppError(403, "errors.forbidden");
    }
  },

  async requireOwner(roomId: number, userId: number): Promise<void> {
    await this.ensureRoomExists(roomId);
    if ((await roomsRepository.getMemberRole(roomId, userId)) !== "OWNER") {
      throw new AppError(403, "errors.forbidden");
    }
  },

  async requireModerator(roomId: number, userId: number): Promise<void> {
    await this.ensureRoomExists(roomId);
    const role = await roomsRepository.getMemberRole(roomId, userId);
    if (role !== "OWNER" && role !== "MODERATOR") {
      throw new AppError(403, "errors.forbidden");
    }
  },

  async ensureRoomExists(roomId: number): Promise<void> {
    if (!(await roomsRepository.findById(roomId))) throw new AppError(404, "room.notFound");
  },
};
