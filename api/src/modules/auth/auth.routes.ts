import { Router } from "express";

import { requireAuth, requireGuest } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate, login, logout, register } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export const authRouter = Router();

authRouter.post("/register", requireGuest, validate({ body: registerSchema }), register);
authRouter.post("/login", requireGuest, validate({ body: loginSchema }), login);
// authRouter.post("/google", requireGuest, validate({ body: googleLoginSchema }), googleLogin);
authRouter.post("/logout", requireAuth, logout);
authRouter.post("/authenticate", requireAuth, authenticate);
