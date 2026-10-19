import { EventEmitter } from "node:events";

export const realtimeEvents = new EventEmitter();

export function roomChannel(roomId: number): string {
  return `room:${roomId}`;
}

export function userChannel(userId: number): string {
  return `user:${userId}`;
}
