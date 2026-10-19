import type { RequestHandler } from "express";

import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { messagesService } from "./messages.service.js";

export const getMessage: RequestHandler = asyncHandler(async (req, res) => {
  const message = await messagesService.get(Number(req.params["id"]), req.user!.Id);
  res.status(200).json({ message });
});

export const updateMessage: RequestHandler = asyncHandler(async (req, res) => {
  const message = await messagesService.update(Number(req.params["id"]), req.user!.Id, req.body);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.messageUpdated", data: { message } });
});

export const deleteMessage: RequestHandler = asyncHandler(async (req, res) => {
  await messagesService.delete(Number(req.params["id"]), req.user!.Id);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.messageDeleted" });
});

export const getMessageReactions: RequestHandler = asyncHandler(async (req, res) => {
  const reactions = await messagesService.getReactions(Number(req.params["id"]), req.user!.Id);
  res.status(200).json({ reactions });
});

export const addMessageReaction: RequestHandler = asyncHandler(async (req, res) => {
  await messagesService.addReaction(Number(req.params["id"]), req.user!.Id, req.body);
  sendSuccess(res, req, { statusCode: 201, messageKey: "success.messageReactionAdded" });
});

export const removeMessageReaction: RequestHandler = asyncHandler(async (req, res) => {
  await messagesService.removeReaction(Number(req.params["id"]), req.user!.Id, req.body);
  sendSuccess(res, req, { statusCode: 200, messageKey: "success.messageReactionRemoved" });
});
