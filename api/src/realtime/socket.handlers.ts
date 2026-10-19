import { ZodError } from "zod";
import type { Server } from "socket.io";

import type { MessageKey } from "../utils/localization.js";
import { AppError } from "../utils/app-error.js";
import { resolveLanguage, translate } from "../utils/localization.js";
import { messagesService } from "../modules/messages/messages.service.js";
import { roomsService } from "../modules/rooms/rooms.service.js";
import type { AuthenticatedSocket, ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "./socket.types.js";
import { roomChannel } from "./realtime-events.js";
import {
  deleteMessageSocketPayloadSchema,
  editMessageSocketPayloadSchema,
  reactionSocketPayloadSchema,
  roomSocketPayloadSchema,
  sendMessageSocketPayloadSchema,
} from "./socket.validation.js";

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type Ack<T> = ((result: { ok: true; data: T } | { ok: false; error: { key: string; message: string } }) => void) | undefined;

async function runWithAcknowledgement<T>(
  acknowledgement: Ack<T>,
  eventName: string,
  action: () => Promise<T>,
  languageHeader: string | string[] | undefined,
): Promise<void> {
  try {
    const data = await action();
    acknowledgement?.({ ok: true, data });
  } catch (error) {
    let key: MessageKey;
    if (error instanceof AppError) {
      key = error.key;
    } else if (error instanceof ZodError) {
      key = "errors.validation.failed";
    } else {
      key = "errors.internal";
      console.error(`Socket event ${eventName} failed`, error);
    }
    acknowledgement?.({
      ok: false,
      error: {
        key,
        message: translate(
          key,
          resolveLanguage(Array.isArray(languageHeader) ? languageHeader[0] : languageHeader),
        ),
      },
    });
  }
}

export function registerSocketHandlers(
  io: RealtimeServer,
  socket: AuthenticatedSocket,
): void {
  const languageHeader = socket.handshake.headers["accept-language"];

  socket.on("room:join", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "room:join",
      async () => {
        const { roomId } = roomSocketPayloadSchema.parse(payload);
        await roomsService.requireMember(roomId, socket.data.user.Id);
        await socket.join(roomChannel(roomId));
        return { roomId };
      },
      languageHeader,
    );
  });

  socket.on("room:leave", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "room:leave",
      async () => {
        const { roomId } = roomSocketPayloadSchema.parse(payload);
        await roomsService.requireMember(roomId, socket.data.user.Id);
        await socket.leave(roomChannel(roomId));
        return { roomId };
      },
      languageHeader,
    );
  });

  socket.on("message:send", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "message:send",
      async () => {
        const input = sendMessageSocketPayloadSchema.parse(payload);
        const message = await roomsService.sendMessage(input.roomId, socket.data.user.Id, {
          type: input.type,
          content: input.content,
        });
        io.to(roomChannel(input.roomId)).emit("message:created", message);
        return message;
      },
      languageHeader,
    );
  });

  socket.on("message:edit", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "message:edit",
      async () => {
        const input = editMessageSocketPayloadSchema.parse(payload);
        const message = await messagesService.update(input.messageId, socket.data.user.Id, {
          content: input.content,
        });
        io.to(roomChannel(message.RoomId)).emit("message:updated", message);
        return message;
      },
      languageHeader,
    );
  });

  socket.on("message:delete", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "message:delete",
      async () => {
        const { messageId } = deleteMessageSocketPayloadSchema.parse(payload);
        const message = await messagesService.get(messageId, socket.data.user.Id);
        await messagesService.delete(messageId, socket.data.user.Id);
        const deleted = { roomId: message.RoomId, messageId };
        io.to(roomChannel(message.RoomId)).emit("message:deleted", deleted);
        return { messageId };
      },
      languageHeader,
    );
  });

  socket.on("reaction:add", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "reaction:add",
      async () => {
        const input = reactionSocketPayloadSchema.parse(payload);
        const message = await messagesService.get(input.messageId, socket.data.user.Id);
        await messagesService.addReaction(input.messageId, socket.data.user.Id, { emoji: input.emoji });
        const reactions = await messagesService.getReactions(input.messageId, socket.data.user.Id);
        const updated = { roomId: message.RoomId, messageId: input.messageId, reactions };
        io.to(roomChannel(message.RoomId)).emit("reaction:updated", updated);
        return { messageId: input.messageId, reactions };
      },
      languageHeader,
    );
  });

  socket.on("reaction:remove", (payload, acknowledgement) => {
    void runWithAcknowledgement(
      acknowledgement,
      "reaction:remove",
      async () => {
        const input = reactionSocketPayloadSchema.parse(payload);
        const message = await messagesService.get(input.messageId, socket.data.user.Id);
        await messagesService.removeReaction(input.messageId, socket.data.user.Id, { emoji: input.emoji });
        const reactions = await messagesService.getReactions(input.messageId, socket.data.user.Id);
        const updated = { roomId: message.RoomId, messageId: input.messageId, reactions };
        io.to(roomChannel(message.RoomId)).emit("reaction:updated", updated);
        return { messageId: input.messageId, reactions };
      },
      languageHeader,
    );
  });
}
