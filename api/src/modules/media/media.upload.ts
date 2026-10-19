import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import type { RequestHandler } from "express";

import { AppError } from "../../utils/app-error.js";

export const mediaDirectory = path.resolve(process.cwd(), "public", "media");
export const mediaTempDirectory = path.join(mediaDirectory, ".tmp");

const allowedMimeTypes = new Set([
  "audio/mpeg",
  "video/mp4",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      void fs.mkdir(mediaTempDirectory, { recursive: true }).then(
        () => callback(null, mediaTempDirectory),
        (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), ""),
      );
    },
    filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`),
  }),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
    fields: 0,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, "media.unsupportedType"));
      return;
    }
    callback(null, true);
  },
});

export const receiveMedia: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      next(
        error.code === "LIMIT_FILE_SIZE"
          ? new AppError(413, "media.fileTooLarge")
          : new AppError(400, "media.uploadFailed"),
      );
      return;
    }
    next(error);
  });
};
