import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { getProfile, updateProfile } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, getProfile);
usersRouter.patch("/me", requireAuth, updateProfile);
