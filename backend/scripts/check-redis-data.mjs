/* global fetch */
import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";

import { parseRoomEvent } from "../../shared/dist/index.js";

const expectedRoomHashFields = new Set(["version", "status", "createdAt", "updatedAt", "players"]);

function loadDotEnv() {
  try {
    const content = readFileSync(new URL("../../.env", import.meta.url), "utf8");

    for (const line of content.split("\n")) {
      const trimmedLine = line.trim();

      if (trimmedLine.length === 0 || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
        continue;
      }

      const [name, ...valueParts] = trimmedLine.split("=");
      const value = valueParts.join("=").trim();

      if (process.env[name] === undefined) {
        process.env[name] = value.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Environment variables may already be provided by the shell or Vercel.
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function redisCommand(command, ...args) {
  const url = requireEnv("KV_REST_API_URL");
  const token = requireEnv("KV_REST_API_TOKEN");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!response.ok) {
    throw new Error(`Redis command failed: ${command} ${response.status}`);
  }

  const body = await response.json();

  if (body.error !== undefined) {
    throw new Error(`Redis command failed: ${command} ${String(body.error)}`);
  }

  return body.result;
}

async function scanRoomKeys() {
  const roomKeys = [];
  let cursor = "0";

  do {
    const result = await redisCommand("SCAN", cursor, "MATCH", "room:*", "COUNT", 200);

    if (!Array.isArray(result) || result.length !== 2 || !Array.isArray(result[1])) {
      throw new Error("Unexpected SCAN response.");
    }

    cursor = String(result[0]);
    roomKeys.push(...result[1].map(String));
  } while (cursor !== "0");

  return roomKeys.filter((key) => !key.endsWith(":events") && !key.endsWith(":lock")).sort();
}

function normalizeHash(value) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (!Array.isArray(value)) {
    return {};
  }

  const hash = {};

  for (let index = 0; index < value.length; index += 2) {
    hash[String(value[index])] = value[index + 1];
  }

  return hash;
}

function parseRawJson(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getRoomId(roomKey) {
  return roomKey.slice("room:".length);
}

function getUnexpectedHashFields(hash) {
  return Object.keys(hash).filter((field) => !expectedRoomHashFields.has(field));
}

function getNumber(value) {
  const numberValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);

  return Number.isInteger(numberValue) ? numberValue : undefined;
}

async function checkRoom(roomKey) {
  const roomId = getRoomId(roomKey);
  const eventsKey = `${roomKey}:events`;
  const issues = [];
  const warnings = [];
  const [roomType, eventsType, hashValue, eventCount, rawEvents] = await Promise.all([
    redisCommand("TYPE", roomKey),
    redisCommand("TYPE", eventsKey),
    redisCommand("HGETALL", roomKey),
    redisCommand("LLEN", eventsKey),
    redisCommand("LRANGE", eventsKey, 0, -1),
  ]);
  const roomHash = normalizeHash(hashValue);

  if (roomType !== "hash") {
    issues.push(`room key type is ${String(roomType)}`);
  }

  if (eventsType !== "list") {
    issues.push(`events key type is ${String(eventsType)}`);
  }

  const unexpectedHashFields = getUnexpectedHashFields(roomHash);

  if (unexpectedHashFields.length > 0) {
    issues.push(`unexpected hash fields: ${unexpectedHashFields.join(",")}`);
  }

  const version = getNumber(roomHash.version);

  if (version === undefined) {
    issues.push("hash version is missing or invalid");
  } else if (version !== eventCount) {
    issues.push(`hash version ${version} does not match events length ${String(eventCount)}`);
  }

  if (!Array.isArray(rawEvents)) {
    issues.push("events LRANGE response is not an array");

    return {
      roomId,
      eventCount: 0,
      issues,
      warnings,
    };
  }

  const parsedEvents = rawEvents.map((rawEvent) => parseRoomEvent(rawEvent));
  const invalidEventIndexes = parsedEvents
    .map((event, index) => (event === undefined ? index : undefined))
    .filter((index) => index !== undefined);

  if (invalidEventIndexes.length > 0) {
    issues.push(`unparseable events at indexes: ${invalidEventIndexes.join(",")}`);
  }

  const validEvents = parsedEvents.filter((event) => event !== undefined);
  const firstEvent = validEvents[0];

  if (firstEvent?.type !== "ROOM_CREATED") {
    issues.push("first valid event is not ROOM_CREATED");
  }

  if (!validEvents.some((event) => event.type === "PLAYER_JOINED")) {
    issues.push("missing PLAYER_JOINED event");
  }

  rawEvents.forEach((rawEvent, index) => {
    const rawValue = parseRawJson(rawEvent);

    if (
      rawValue !== undefined &&
      rawValue !== null &&
      typeof rawValue === "object" &&
      "payload" in rawValue &&
      Array.isArray(rawValue.payload)
    ) {
      warnings.push(`event index ${index} has array payload`);
    }
  });

  return {
    roomId,
    eventCount: rawEvents.length,
    issues,
    warnings,
  };
}

function printResult(results) {
  const roomsWithIssues = results.filter((result) => result.issues.length > 0);
  const roomsWithWarnings = results.filter((result) => result.warnings.length > 0);

  process.stdout.write(`Redis room data check\n`);
  process.stdout.write(`rooms: ${results.length}\n`);
  process.stdout.write(`roomsWithIssues: ${roomsWithIssues.length}\n`);
  process.stdout.write(`roomsWithWarnings: ${roomsWithWarnings.length}\n`);

  for (const result of results) {
    if (result.issues.length === 0 && result.warnings.length === 0) {
      continue;
    }

    process.stdout.write(`\nroom:${result.roomId} events=${result.eventCount}\n`);

    for (const issue of result.issues) {
      process.stdout.write(`  issue: ${issue}\n`);
    }

    for (const warning of result.warnings) {
      process.stdout.write(`  warning: ${warning}\n`);
    }
  }
}

async function main() {
  loadDotEnv();

  const roomKeys = await scanRoomKeys();
  const results = [];

  for (const roomKey of roomKeys) {
    results.push(await checkRoom(roomKey));
  }

  printResult(results);

  if (results.some((result) => result.issues.length > 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
