import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { deleteMedia, getMedia, uploadMedia } from "./media.controller.js";
import { mediaParamsSchema } from "./media.validation.js";
import { receiveMedia } from "./media.upload.js";

export const mediaRouter = Router();

mediaRouter.use(requireAuth);
mediaRouter.post("/", receiveMedia, uploadMedia);
mediaRouter.get("/:id", validate({ params: mediaParamsSchema }), getMedia);
mediaRouter.delete("/:id", validate({ params: mediaParamsSchema }), deleteMedia);
