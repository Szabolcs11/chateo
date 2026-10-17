import type { RequestHandler } from "express";

import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { roomsService } from "./rooms.service.js";

export const getRooms: RequestHandler = asyncHandler(async (req, res) => {
  const rooms = await roomsService.getAll(req.user!.Id);
  res.status(200).json({ rooms });
});

export const createRoom: RequestHandler = asyncHandler(async (req, res) => {
  const room = await roomsService.create(req.user!.Id, req.body);
  sendSuccess(res, req, { statusCode: 201, messageKey: "success.roomCreated", data: { room } });
});

export const getRoom: RequestHandler = asyncHandler(async (req, res) => {
  const room = await roomsService.get(Number(req.params["id"]), req.user!.Id);
  res.status(200).json({ room });
});

export const updateRoom: RequestHandler = asyncHandler(async (req, res) => {
  const room = await roomsService.update(Number(req.params["id"]), req.user!.Id, req.body);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.roomUpdated", data: { room } });
});

export const deleteRoom: RequestHandler = asyncHandler(async (req, res) => {
  await roomsService.delete(Number(req.params["id"]), req.user!.Id);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.roomDeleted" });
});

export const getRoomMembers: RequestHandler = asyncHandler(async (req, res) => {
  const members = await roomsService.getMembers(Number(req.params["id"]), req.user!.Id);
  res.status(200).json({ members });
});

export const addRoomMember: RequestHandler = asyncHandler(async (req, res) => {
  await roomsService.addMember(Number(req.params["id"]), req.user!.Id, req.body.userId);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.roomMemberAdded" });
});

export const removeRoomMember: RequestHandler = asyncHandler(async (req, res) => {
  await roomsService.removeMember(Number(req.params["id"]), req.user!.Id, Number(req.params["userId"]));
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.roomMemberRemoved" });
});

export const updateRoomMemberRole: RequestHandler = asyncHandler(async (req, res) => {
  await roomsService.updateMemberRole(
    Number(req.params["id"]),
    req.user!.Id,
    Number(req.params["userId"]),
    req.body.role,
  );
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.roomMemberRoleUpdated" });
});

export const leaveRoom: RequestHandler = asyncHandler(async (req, res) => {
  await roomsService.leave(Number(req.params["id"]), req.user!.Id);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.roomLeft" });
});

export const getRoomMessages: RequestHandler = asyncHandler(async (req, res) => {
  const messages = await roomsService.getMessages(Number(req.params["id"]), req.user!.Id);
  res.status(200).json({ messages });
});

export const sendRoomMessage: RequestHandler = asyncHandler(async (req, res) => {
  const message = await roomsService.sendMessage(Number(req.params["id"]), req.user!.Id, req.body);
  sendSuccess(res, req, { statusCode: 201, messageKey: "success.roomMessageSent", data: { message } });
});
