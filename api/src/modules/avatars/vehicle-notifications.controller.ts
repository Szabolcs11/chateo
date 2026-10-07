import type { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { AppError } from "../../utils/app-error.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const getAvatar: RequestHandler = asyncHandler(async (req, res) => {
  const id = req.params?.["id"] as string;
  if (!id) throw new AppError(401, "errors.validation.failed");

  const uploadRoot = path.resolve(__dirname, "..", "..", "..", "public/avatars");
  const fileName = req.params["id"];
  if (!fileName) throw new AppError(404, "errors.notFound");
  const filePath = path.join(uploadRoot, fileName);

  const fallbackPath = path.join(__dirname, "..", "..", "..", "public/avatars", "DefaultAvatar.png");

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.sendFile(fallbackPath);
    }

    return res.sendFile(filePath);
  });
});
