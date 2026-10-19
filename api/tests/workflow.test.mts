import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const testDatabaseName = process.env["TEST_DB_NAME"] ?? "chateo_test";
if (!/_test$/i.test(testDatabaseName)) {
  throw new Error("TEST_DB_NAME must be a dedicated database name ending in '_test'.");
}
if (testDatabaseName === process.env["DB_NAME"]) {
  throw new Error(
    "TEST_DB_NAME must differ from DB_NAME so the workflow cannot change the configured application database.",
  );
}

process.env["DB_NAME"] = testDatabaseName;

const { app } = await import("../src/app.js");
const { db } = await import("../src/config/database.js");
const { mediaService } = await import("../src/modules/media/media.service.js");

type JsonObject = Record<string, unknown>;

type ApiResponse = {
  response: Response;
  body: JsonObject;
};

type CallOptions = {
  method?: string;
  cookie?: string;
  body?: unknown;
  form?: FormData;
};

function asObject(value: unknown, description: string): JsonObject {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${description} must be an object`);
  return value as JsonObject;
}

function nestedObject(value: unknown, key: string): JsonObject {
  const response = asObject(value, "response");
  const direct = response[key];
  if (direct !== null && typeof direct === "object" && !Array.isArray(direct)) {
    return asObject(direct, `response.${key}`);
  }
  const data = response["data"];
  if (data !== null && typeof data === "object" && !Array.isArray(data) && key in data) {
    return asObject((data as JsonObject)[key], `response.data.${key}`);
  }
  return asObject(undefined, `response.${key}`);
}

function nestedId(value: unknown, parentKey: string, idKey = "Id"): number {
  const id = nestedObject(value, parentKey)[idKey];
  assert.equal(typeof id, "number", `${parentKey}.${idKey} must be numeric`);
  return id as number;
}

function objectArray(value: unknown, key: string): JsonObject[] {
  const items = asObject(value, "response")[key];
  assert.ok(Array.isArray(items), `response.${key} must be an array`);
  return items.map((item, index) => asObject(item, `response.${key}[${index}]`));
}

function responseCookie(response: Response): string {
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "Login must set a session cookie");
  return cookie.split(";")[0]!;
}

let baseUrl = "";
let server: ReturnType<typeof app.listen> | undefined;
let databaseReady = false;
const registeredEmails: string[] = [];
const createdRoomIds: number[] = [];
const uploadedMediaIds: Array<{ id: string; ownerId: number }> = [];

async function call(path: string, expectedStatus: number, options: CallOptions = {}): Promise<ApiResponse> {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const init: RequestInit = { method: options.method ?? "GET", headers };
  if (body !== undefined) init.body = body;
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    assert.fail(`Expected JSON from ${path}, received HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const responseBody = asObject(parsed, `${path} response`);
  assert.equal(
    response.status,
    expectedStatus,
    `${options.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(responseBody)}`,
  );
  return { response, body: responseBody };
}

async function register(fullName: string, email: string, password: string): Promise<number> {
  registeredEmails.push(email);
  const result = await call("/api/auth/register", 201, {
    method: "POST",
    body: { FullName: fullName, Email: email, Password: password, PasswordConfirm: password },
  });
  return nestedId(result.body, "user");
}

async function login(email: string, password: string): Promise<string> {
  const result = await call("/api/auth/login", 200, {
    method: "POST",
    body: { Email: email, Password: password },
  });
  return responseCookie(result.response);
}

async function cleanup(): Promise<void> {
  try {
    for (const media of uploadedMediaIds) {
      try {
        await mediaService.delete(media.id, media.ownerId);
      } catch (error) {
        if (!(error instanceof Error && "key" in error && error.key === "media.notFound")) throw error;
      }
    }

    if (databaseReady && registeredEmails.length > 0) {
      const placeholders = registeredEmails.map(() => "?").join(", ");
      const [userRows] = await db.execute(`SELECT Id FROM users WHERE Email IN (${placeholders})`, registeredEmails);
      const userIds = (userRows as Array<{ Id: number }>).map((user) => user.Id);

      if (userIds.length > 0) {
        const userPlaceholders = userIds.map(() => "?").join(", ");
        const roomPlaceholders = createdRoomIds.length > 0 ? createdRoomIds.map(() => "?").join(", ") : "NULL";
        await db.execute(
          `DELETE FROM message_reactions WHERE UserId IN (${userPlaceholders})
           OR MessageId IN (SELECT Id FROM messages WHERE SenderId IN (${userPlaceholders}))`,
          [...userIds, ...userIds],
        );
        await db.execute(
          `DELETE FROM messages WHERE SenderId IN (${userPlaceholders}) OR RoomId IN (${roomPlaceholders})`,
          [...userIds, ...createdRoomIds],
        );
        await db.execute(
          `DELETE FROM room_members WHERE UserId IN (${userPlaceholders}) OR RoomId IN (${roomPlaceholders})`,
          [...userIds, ...createdRoomIds],
        );
        await db.execute(`DELETE FROM rooms WHERE CreatedBy IN (${userPlaceholders}) OR Id IN (${roomPlaceholders})`, [
          ...userIds,
          ...createdRoomIds,
        ]);
        await db.execute(
          `DELETE FROM friend_requests WHERE SenderId IN (${userPlaceholders}) OR ReceiverId IN (${userPlaceholders})`,
          [...userIds, ...userIds],
        );
        await db.execute(
          `DELETE FROM friendships WHERE UserId IN (${userPlaceholders}) OR FriendId IN (${userPlaceholders})`,
          [...userIds, ...userIds],
        );
        await db.execute(`DELETE FROM users WHERE Id IN (${userPlaceholders})`, userIds);
      }
    }
  } finally {
    if (server) {
      const activeServer = server;
      server = undefined;
      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await db.end();
  }
}

before(async () => {
  const connection = await db.getConnection();
  try {
    await connection.ping();
    const [databaseRows] = await connection.query("SELECT DATABASE() AS DatabaseName");
    const actualDatabase = (databaseRows as Array<{ DatabaseName: string }>)[0]?.DatabaseName;
    assert.equal(actualDatabase, testDatabaseName, "The API must connect to TEST_DB_NAME");
    await connection.query("SELECT 1 FROM message_reactions LIMIT 0");
    databaseReady = true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ER_NO_SUCH_TABLE") {
      throw new Error(
        "The test database is missing message_reactions. Create it using the SQL provided with the messages endpoint before running the workflow.",
        { cause: error },
      );
    }
    throw error;
  } finally {
    connection.release();
  }

  server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(cleanup);

test("Chateo API workflow", { timeout: 120_000 }, async (t) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = "Workflow-test-Password-123!";
  const emails = {
    alice: `workflow-alice-${unique}@example.test`,
    bob: `workflow-bob-${unique}@example.test`,
    carol: `workflow-carol-${unique}@example.test`,
  };
  let aliceId = 0;
  let bobId = 0;
  let carolId = 0;
  let aliceCookie = "";
  let bobCookie = "";
  let carolCookie = "";
  let roomId = 0;

  await t.test("Authentication: register, login, and authenticate", async () => {
    await call("/health", 200);
    aliceId = await register("Workflow Alice", emails.alice, password);
    bobId = await register("Workflow Bob", emails.bob, password);
    carolId = await register("Workflow Carol", emails.carol, password);

    aliceCookie = await login(emails.alice, password);
    bobCookie = await login(emails.bob, password);
    carolCookie = await login(emails.carol, password);

    const authenticatedAlice = await call("/api/auth/authenticate", 200, {
      method: "POST",
      cookie: aliceCookie,
    });
    assert.equal(nestedObject(authenticatedAlice.body, "user")["Id"], aliceId);
  });

  await t.test("Users: read profiles", async () => {
    const ownProfile = await call("/api/users/me", 200, { cookie: aliceCookie });
    assert.equal(nestedObject(ownProfile.body, "user")["Email"], emails.alice);
    const otherProfile = await call(`/api/users/${bobId}`, 200, { cookie: aliceCookie });
    assert.equal(nestedObject(otherProfile.body, "user")["Email"], emails.bob);

    const unimplementedProfileUpdate = await call("/api/users/me", 501, {
      method: "PATCH",
      cookie: aliceCookie,
      body: { fullName: "Workflow Alice Updated" },
    });
    assert.equal(unimplementedProfileUpdate.body["key"], "errors.notImplemented");
  });

  await t.test("Friend requests: send, list, accept, reject, and cancel", async () => {
    const acceptedRequest = await call("/api/friend-requests", 201, {
      method: "POST",
      cookie: aliceCookie,
      body: { receiverId: bobId },
    });
    const acceptedRequestId = nestedId(acceptedRequest.body, "friendRequest");
    assert.ok(
      objectArray((await call("/api/friend-requests", 200, { cookie: aliceCookie })).body, "friendRequests").length >= 1,
    );
    assert.ok(
      objectArray((await call("/api/friend-requests/outgoing", 200, { cookie: aliceCookie })).body, "friendRequests")
        .length >= 1,
    );
    const bobIncoming = await call("/api/friend-requests/incoming", 200, { cookie: bobCookie });
    assert.ok(objectArray(bobIncoming.body, "friendRequests").some((request) => request["Id"] === acceptedRequestId));
    await call(`/api/friend-requests/${acceptedRequestId}/accept`, 200, {
      method: "POST",
      cookie: bobCookie,
    });

    const cancelRequest = await call("/api/friend-requests", 201, {
      method: "POST",
      cookie: aliceCookie,
      body: { receiverId: carolId },
    });
    await call(`/api/friend-requests/${nestedId(cancelRequest.body, "friendRequest")}`, 200, {
      method: "DELETE",
      cookie: aliceCookie,
    });

    const rejectRequest = await call("/api/friend-requests", 201, {
      method: "POST",
      cookie: carolCookie,
      body: { receiverId: aliceId },
    });
    await call(`/api/friend-requests/${nestedId(rejectRequest.body, "friendRequest")}/reject`, 200, {
      method: "POST",
      cookie: aliceCookie,
    });
  });

  await t.test("Friends: list and remove a friend", async () => {
    const friends = await call("/api/friends", 200, { cookie: aliceCookie });
    assert.ok(objectArray(friends.body, "friends").some((friend) => friend["Id"] === bobId));
    await call(`/api/friends/${bobId}`, 200, {
      method: "DELETE",
      cookie: aliceCookie,
    });
    assert.ok(
      !objectArray((await call("/api/friends", 200, { cookie: aliceCookie })).body, "friends").some(
        (friend) => friend["Id"] === bobId,
      ),
    );
  });

  await t.test("Rooms: create, list, update, and manage members", async () => {
    const roomCreation = await call("/api/rooms", 201, {
      method: "POST",
      cookie: aliceCookie,
      body: {
        type: "GROUP",
        name: "Workflow room",
        description: "Integration test room",
        memberIds: [bobId],
      },
    });
    const room = nestedObject(roomCreation.body, "room");
    roomId = room["Id"] as number;
    createdRoomIds.push(roomId);
    assert.equal(room["Name"], "Workflow room");

  assert.ok(
    objectArray((await call("/api/rooms", 200, { cookie: aliceCookie })).body, "rooms").some(
      (item) => item["Id"] === roomId,
    ),
  );
  assert.equal(
    nestedObject((await call(`/api/rooms/${roomId}`, 200, { cookie: aliceCookie })).body, "room")["Id"],
    roomId,
  );
  await call(`/api/rooms/${roomId}`, 200, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { name: "Workflow room updated", description: "Updated by owner" },
  });

  const initialMembers = objectArray(
    (await call(`/api/rooms/${roomId}/members`, 200, { cookie: aliceCookie })).body,
    "members",
  );
  assert.ok(initialMembers.some((member) => member["UserId"] === bobId && member["Role"] === "MEMBER"));
  await call(`/api/rooms/${roomId}/members/${bobId}/role`, 200, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { role: "MODERATOR" },
  });
  await call(`/api/rooms/${roomId}/members`, 200, {
    method: "POST",
    cookie: bobCookie,
    body: { userId: carolId },
  });
  await call(`/api/rooms/${roomId}/members/${carolId}`, 200, {
    method: "DELETE",
    cookie: bobCookie,
  });
  await call(`/api/rooms/${roomId}/members`, 200, {
    method: "POST",
    cookie: aliceCookie,
    body: { userId: carolId },
  });
  await call(`/api/rooms/${roomId}/members/${carolId}/role`, 200, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { role: "MODERATOR" },
  });
  await call(`/api/rooms/${roomId}/members/${carolId}`, 403, {
    method: "DELETE",
    cookie: bobCookie,
  });
  await call(`/api/rooms/${roomId}/members/${carolId}/role`, 200, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { role: "MEMBER" },
  });
  });

  await t.test("Messages: send, get, edit, delete, and react", async () => {
  const sentMessage = await call(`/api/rooms/${roomId}/messages`, 201, {
    method: "POST",
    cookie: aliceCookie,
    body: { type: "TEXT", content: "Original workflow message" },
  });
  const messageId = nestedId(sentMessage.body, "message");
  assert.equal(
    nestedObject((await call(`/api/messages/${messageId}`, 200, { cookie: bobCookie })).body, "message")["Content"],
    "Original workflow message",
  );

  await call(`/api/messages/${messageId}`, 403, {
    method: "PATCH",
    cookie: bobCookie,
    body: { content: "Unauthorized edit" },
  });
  const editedMessage = await call(`/api/messages/${messageId}`, 200, {
    method: "PATCH",
    cookie: aliceCookie,
    body: { content: "Edited workflow message" },
  });
  assert.equal(nestedObject(editedMessage.body, "message")["Content"], "Edited workflow message");
  assert.ok(
    objectArray((await call(`/api/rooms/${roomId}/messages`, 200, { cookie: bobCookie })).body, "messages").some(
      (item) => item["Id"] === messageId,
    ),
  );

  const emoji = String.fromCodePoint(0x1f600);
  await call(`/api/messages/${messageId}/reactions`, 201, {
    method: "POST",
    cookie: bobCookie,
    body: { emoji },
  });
  await call(`/api/messages/${messageId}/reactions`, 201, {
    method: "POST",
    cookie: aliceCookie,
    body: { emoji },
  });
  const reactions = objectArray(
    (await call(`/api/messages/${messageId}/reactions`, 200, { cookie: bobCookie })).body,
    "reactions",
  );
  assert.equal(reactions.find((reaction) => reaction["Emoji"] === emoji)?.["Count"], 2);
  await call(`/api/messages/${messageId}/reactions`, 200, {
    method: "DELETE",
    cookie: aliceCookie,
    body: { emoji },
  });
  await call(`/api/messages/${messageId}/reactions`, 200, {
    method: "DELETE",
    cookie: bobCookie,
    body: { emoji },
  });
  await call(`/api/messages/${messageId}`, 403, {
    method: "DELETE",
    cookie: bobCookie,
  });
  await call(`/api/messages/${messageId}`, 200, {
    method: "DELETE",
    cookie: aliceCookie,
  });
  await call(`/api/messages/${messageId}`, 404, { cookie: aliceCookie });
  });

  await t.test("Media and avatars: upload, retrieve, and delete media", async () => {
  const videoForm = new FormData();
  videoForm.append(
    "file",
    new Blob([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])], {
      type: "video/mp4",
    }),
    "workflow.mp4",
  );
  const videoUpload = await call("/api/media", 201, {
    method: "POST",
    cookie: aliceCookie,
    form: videoForm,
  });
  const videoMediaId = nestedObject(videoUpload.body, "data")["id"] as string;
  uploadedMediaIds.push({ id: videoMediaId, ownerId: aliceId });
  const videoResponse = await fetch(`${baseUrl}/api/media/${videoMediaId}`, { headers: { cookie: aliceCookie } });
  assert.equal(videoResponse.status, 200);
  assert.equal(videoResponse.headers.get("content-type")?.split(";")[0], "video/mp4");
  await call(`/api/media/${videoMediaId}`, 403, { method: "DELETE", cookie: bobCookie });
  await call(`/api/media/${videoMediaId}`, 200, { method: "DELETE", cookie: aliceCookie });
  uploadedMediaIds.pop();

  const png = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const imageForm = new FormData();
  imageForm.append("file", new Blob([png], { type: "image/png" }), "workflow.png");
  const imageUpload = await call("/api/media", 201, {
    method: "POST",
    cookie: aliceCookie,
    form: imageForm,
  });
  const imageMediaId = nestedObject(imageUpload.body, "data")["id"] as string;
  uploadedMediaIds.push({ id: imageMediaId, ownerId: aliceId });
  const imageResponse = await fetch(`${baseUrl}/api/media/${imageMediaId}`, { headers: { cookie: aliceCookie } });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type")?.split(";")[0], "image/webp");
  await call(`/api/media/${imageMediaId}`, 200, { method: "DELETE", cookie: aliceCookie });
  uploadedMediaIds.pop();

  const avatarResponse = await fetch(`${baseUrl}/api/avatars/DefaultAvatar.png`, {
    headers: { cookie: aliceCookie },
  });
  assert.equal(avatarResponse.status, 200);
  assert.equal(avatarResponse.headers.get("content-type")?.split(";")[0], "image/png");
  });

  await t.test("Rooms: transfer ownership, leave, and delete", async () => {
  const transferRoomResult = await call("/api/rooms", 201, {
    method: "POST",
    cookie: bobCookie,
    body: { type: "GROUP", name: "Ownership transfer room", memberIds: [aliceId, carolId] },
  });
  const transferRoomId = nestedId(transferRoomResult.body, "room");
  createdRoomIds.push(transferRoomId);
  await call(`/api/rooms/${transferRoomId}/members/${carolId}/role`, 200, {
    method: "PATCH",
    cookie: bobCookie,
    body: { role: "MODERATOR" },
  });
  await call(`/api/rooms/${transferRoomId}/leave`, 200, {
    method: "POST",
    cookie: bobCookie,
  });
  const transferredMembers = objectArray(
    (await call(`/api/rooms/${transferRoomId}/members`, 200, { cookie: carolCookie })).body,
    "members",
  );
  assert.ok(transferredMembers.some((member) => member["UserId"] === carolId && member["Role"] === "OWNER"));
  await call(`/api/rooms/${transferRoomId}`, 200, {
    method: "DELETE",
    cookie: carolCookie,
  });

  await call(`/api/rooms/${roomId}/members/${carolId}`, 200, {
    method: "DELETE",
    cookie: aliceCookie,
  });
  await call(`/api/rooms/${roomId}/leave`, 200, {
    method: "POST",
    cookie: bobCookie,
  });
  await call(`/api/rooms/${roomId}/members`, 403, { cookie: bobCookie });
  await call(`/api/rooms/${roomId}`, 200, {
    method: "DELETE",
    cookie: aliceCookie,
  });
  });

  await t.test("Authentication: log out and reject anonymous requests", async () => {
  await call("/api/auth/logout", 200, { method: "POST", cookie: aliceCookie });
  await call("/api/auth/authenticate", 401, { method: "POST" });
  await call("/api/auth/logout", 200, { method: "POST", cookie: bobCookie });
  await call("/api/auth/logout", 200, { method: "POST", cookie: carolCookie });
  });
});
