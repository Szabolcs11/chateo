import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireAvatarId } from "./avatars.validation.js";
import { getAvatar } from "./vehicle-notifications.controller.js";

export const avatarRouter = Router();

avatarRouter.use(requireAuth);

avatarRouter.get("/:id", requireAvatarId, getAvatar);
// avatarRouter.post("/", validate({ body: createVehicleNotificationSchema }), createNotification);
