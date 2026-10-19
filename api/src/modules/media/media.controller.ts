import type { RequestHandler } from "express";

import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { mediaService } from "./media.service.js";

export const uploadMedia: RequestHandler = asyncHandler(async (req, res) => {
  const media = await mediaService.upload(req.file, req.user!.Id);
  const url = `/api/media/${media.id}`;
  res.location(url);
  sendSuccess(res, req, {
    statusCode: 201,
    messageKey: "media.uploaded",
    data: { ...media, url },
  });
});

export const getMedia: RequestHandler = asyncHandler(async (req, res) => {
  const media = await mediaService.get(req.params["id"]!);
  res.type(media.mimeType).sendFile(media.filePath);
});

export const deleteMedia: RequestHandler = asyncHandler(async (req, res) => {
  await mediaService.delete(req.params["id"]!, req.user!.Id);
  sendSuccess(res, req, { statusCode: 200, messageKey: "media.deleted" });
});
