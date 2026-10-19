import type { AuthenticatedUser } from "../middlewares/auth.middleware.js";
import type { MessageReaction, MessageType, RoomMessage, RoomRole } from "../modules/rooms/rooms.types.js";
import type { Socket } from "socket.io";

export type SocketEventResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: { key: string; message: string } };

export type SocketAcknowledgement<TData> = (result: SocketEventResult<TData>) => void;

export interface ClientToServerEvents {
  "room:join": (payload: { roomId: number }, acknowledge: SocketAcknowledgement<{ roomId: number }>) => void;
  "room:leave": (payload: { roomId: number }, acknowledge: SocketAcknowledgement<{ roomId: number }>) => void;
  "message:send": (
    payload: { roomId: number; type?: MessageType; content: string },
    acknowledge: SocketAcknowledgement<RoomMessage>,
  ) => void;
  "message:edit": (
    payload: { messageId: number; content: string },
    acknowledge: SocketAcknowledgement<RoomMessage>,
  ) => void;
  "message:delete": (
    payload: { messageId: number },
    acknowledge: SocketAcknowledgement<{ messageId: number }>,
  ) => void;
  "reaction:add": (
    payload: { messageId: number; emoji: string },
    acknowledge: SocketAcknowledgement<{ messageId: number; reactions: MessageReaction[] }>,
  ) => void;
  "reaction:remove": (
    payload: { messageId: number; emoji: string },
    acknowledge: SocketAcknowledgement<{ messageId: number; reactions: MessageReaction[] }>,
  ) => void;
}

export interface ServerToClientEvents {
  "message:created": (message: RoomMessage) => void;
  "message:updated": (message: RoomMessage) => void;
  "message:deleted": (message: { roomId: number; messageId: number }) => void;
  "reaction:updated": (update: { roomId: number; messageId: number; reactions: MessageReaction[] }) => void;
  "room:member:added": (membership: { roomId: number; userId: number }) => void;
  "room:member:removed": (membership: { roomId: number; userId: number }) => void;
  "room:member:role-updated": (membership: { roomId: number; userId: number; role: RoomRole }) => void;
  "room:access-revoked": (access: { roomId: number }) => void;
  "room:deleted": (room: { roomId: number }) => void;
}

export type InterServerEvents = Record<string, (...args: never[]) => void>;

export interface SocketData {
  user: AuthenticatedUser;
  sessionToken: string;
}

export type AuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
