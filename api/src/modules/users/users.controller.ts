import type { RequestHandler } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { usersService } from "./users.service.js";

export const getProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.getProfile(req.user!.Id);
  res.status(200).json({ user });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.updateProfile(req.user?.Id, req.body);
  res.status(200).json({ user });
});

export const getUserProfile: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await usersService.getProfile(parseInt(id || "0"));
  res.status(200).json({ user });
});
