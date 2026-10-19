import { Router } from "express";

import { authRouter } from "./modules/auth/auth.routes.js";
import { avatarRouter } from "./modules/avatars/avatars.routes.js";
import { friendRequestsRouter } from "./modules/friend-requests/friend-requests.routes.js";
import { friendsRouter } from "./modules/friends/friends.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { roomsRouter } from "./modules/rooms/rooms.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/friend-requests", friendRequestsRouter);
apiRouter.use("/friends", friendsRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/media", mediaRouter);

apiRouter.use("/avatars", avatarRouter);
