import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  addMessageReaction,
  deleteMessage,
  getMessage,
  getMessageReactions,
  removeMessageReaction,
  updateMessage,
} from "./messages.controller.js";
import { messageParamsSchema, messageReactionSchema, updateMessageSchema } from "./messages.validation.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);
messagesRouter.get("/:id", validate({ params: messageParamsSchema }), getMessage);
messagesRouter.patch(
  "/:id",
  validate({ params: messageParamsSchema, body: updateMessageSchema }),
  updateMessage,
);
messagesRouter.delete("/:id", validate({ params: messageParamsSchema }), deleteMessage);
messagesRouter.get("/:id/reactions", validate({ params: messageParamsSchema }), getMessageReactions);
messagesRouter.post(
  "/:id/reactions",
  validate({ params: messageParamsSchema, body: messageReactionSchema }),
  addMessageReaction,
);
messagesRouter.delete(
  "/:id/reactions",
  validate({ params: messageParamsSchema, body: messageReactionSchema }),
  removeMessageReaction,
);
