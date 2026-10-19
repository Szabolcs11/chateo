import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";

import { env } from "../config/env.js";
import { authService } from "../modules/auth/auth.service.js";
import { AppError } from "../utils/app-error.js";
import { getSessionTokenFromCookieHeader } from "../utils/session-cookie.js";
import { realtimeEvents, roomChannel, userChannel } from "./realtime-events.js";
import { registerSocketHandlers } from "./socket.handlers.js";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "./socket.types.js";
import type { RoomRole } from "../modules/rooms/rooms.types.js";

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
const listenerCleanup = new WeakMap<RealtimeServer, () => void>();

export function initializeSocketServer(
  httpServer: HttpServer,
): RealtimeServer {
  const io: RealtimeServer = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: (origin, callback): void => {
        if (!origin || env.socketAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Socket origin is not allowed"));
      },
      credentials: true,
    },
    allowRequest: (request, callback): void => {
      const origin = request.headers.origin;
      if (!origin || env.socketAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback("Socket origin is not allowed", false);
    },
    maxHttpBufferSize: 1_000_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use((socket, next) => {
    void authenticateSocket(socket)
      .then((data) => {
        socket.data.user = data.user;
        socket.data.sessionToken = data.sessionToken;
        next();
      })
      .catch((error: unknown) => {
        if (!(error instanceof AppError)) console.error("Socket authentication failed", error);
        const message = error instanceof AppError ? error.message : "Authentication failed";
        next(new Error(message));
      });
  });

  io.on("connection", (socket) => {
    void authService
      .getUserBySessionToken(socket.data.sessionToken)
      .then((user) => {
        if (!user || user.Id !== socket.data.user.Id) {
          socket.disconnect(true);
          return;
        }

        return Promise.resolve(socket.join(userChannel(socket.data.user.Id))).then(() => {
          if (socket.connected) registerSocketHandlers(io, socket);
        });
      })
      .catch((error: unknown) => {
        console.error("Socket initialization failed", error);
        socket.disconnect(true);
      });
  });

  const onSessionRevoked = (token: string): void => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.sessionToken === token) socket.disconnect(true);
    }
  };
  const onMemberRemoved = (roomId: number, userId: number): void => {
    const userRoom = userChannel(userId);
    io.to(roomChannel(roomId)).emit("room:member:removed", { roomId, userId });
    io.to(userRoom).emit("room:access-revoked", { roomId });
    void Promise.resolve(io.in(userRoom).socketsLeave(roomChannel(roomId))).catch((error: unknown) => {
      console.error("Failed to revoke room access from user sockets", error);
    });
  };
  const onMemberAdded = (roomId: number, userId: number): void => {
    io.to(roomChannel(roomId)).emit("room:member:added", { roomId, userId });
  };
  const onMemberRoleUpdated = (roomId: number, userId: number, role: RoomRole): void => {
    io.to(roomChannel(roomId)).emit("room:member:role-updated", { roomId, userId, role });
  };
  const onRoomDeleted = (roomId: number): void => {
    const channel = roomChannel(roomId);
    io.to(channel).emit("room:deleted", { roomId });
    void Promise.resolve(io.in(channel).socketsLeave(channel)).catch((error: unknown) => {
      console.error("Failed to clear deleted room socket subscriptions", error);
    });
  };

  realtimeEvents.on("session:revoked", onSessionRevoked);
  realtimeEvents.on("room:member-removed", onMemberRemoved);
  realtimeEvents.on("room:member-added", onMemberAdded);
  realtimeEvents.on("room:member-role-updated", onMemberRoleUpdated);
  realtimeEvents.on("room:deleted", onRoomDeleted);

  listenerCleanup.set(io, () => {
    realtimeEvents.off("session:revoked", onSessionRevoked);
    realtimeEvents.off("room:member-removed", onMemberRemoved);
    realtimeEvents.off("room:member-added", onMemberAdded);
    realtimeEvents.off("room:member-role-updated", onMemberRoleUpdated);
    realtimeEvents.off("room:deleted", onRoomDeleted);
  });

  return io;
}

export async function closeSocketServer(io: RealtimeServer): Promise<void> {
  listenerCleanup.get(io)?.();
  listenerCleanup.delete(io);
  await io.close();
}

async function authenticateSocket(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): Promise<{
  user: SocketData["user"];
  sessionToken: string;
}> {
  const sessionToken = getSessionTokenFromCookieHeader(socket.handshake.headers.cookie);
  if (!sessionToken) throw new AppError(401, "errors.auth.required");

  const user = await authService.getUserBySessionToken(sessionToken);
  if (!user) throw new AppError(401, "errors.auth.required");

  return {
    user: {
      Id: user.Id,
      Email: user.Email,
      FullName: user.FullName,
      AvatarUrl: user.AvatarUrl,
    },
    sessionToken,
  };
}
