import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  addRoomMember,
  createRoom,
  deleteRoom,
  getRoom,
  getRoomMembers,
  getRoomMessages,
  getRooms,
  leaveRoom,
  removeRoomMember,
  sendRoomMessage,
  updateRoom,
  updateRoomMemberRole,
} from "./rooms.controller.js";
import {
  addRoomMemberSchema,
  createRoomMessageSchema,
  createRoomSchema,
  roomMemberParamsSchema,
  roomParamsSchema,
  updateRoomMemberRoleSchema,
  updateRoomSchema,
} from "./rooms.validation.js";

export const roomsRouter = Router();

roomsRouter.use(requireAuth);
roomsRouter.get("/", getRooms);
roomsRouter.post("/", validate({ body: createRoomSchema }), createRoom);
roomsRouter.get("/:id", validate({ params: roomParamsSchema }), getRoom);
roomsRouter.patch("/:id", validate({ params: roomParamsSchema, body: updateRoomSchema }), updateRoom);
roomsRouter.delete("/:id", validate({ params: roomParamsSchema }), deleteRoom);
roomsRouter.get("/:id/members", validate({ params: roomParamsSchema }), getRoomMembers);
roomsRouter.post("/:id/members", validate({ params: roomParamsSchema, body: addRoomMemberSchema }), addRoomMember);
roomsRouter.delete("/:id/members/:userId", validate({ params: roomMemberParamsSchema }), removeRoomMember);
roomsRouter.patch(
  "/:id/members/:userId/role",
  validate({ params: roomMemberParamsSchema, body: updateRoomMemberRoleSchema }),
  updateRoomMemberRole,
);
roomsRouter.post("/:id/leave", validate({ params: roomParamsSchema }), leaveRoom);
roomsRouter.get("/:id/messages", validate({ params: roomParamsSchema }), getRoomMessages);
roomsRouter.post(
  "/:id/messages",
  validate({ params: roomParamsSchema, body: createRoomMessageSchema }),
  sendRoomMessage,
);
