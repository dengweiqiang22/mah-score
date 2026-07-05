import assert from "node:assert/strict";

import { replayRoomEvents } from "../dist/index.js";

const baseEvent = {
  roomId: "123",
  operator: "test",
  timestamp: "2026-07-06T00:00:00.000Z",
};

const events = [
  {
    ...baseEvent,
    id: "event_1",
    type: "PLAYER_JOINED",
    version: 1,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "event_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "event_3",
    type: "PLAYER_RENAMED",
    version: 3,
    payload: {
      playerId: "player_1",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "event_4",
    type: "GAME_STARTED",
    version: 4,
    payload: {},
  },
  {
    ...baseEvent,
    id: "event_5",
    type: "DRAW_GAME",
    version: 5,
    payload: {
      round: 1,
    },
  },
  {
    ...baseEvent,
    id: "event_6",
    type: "UNDO",
    version: 6,
    payload: {
      targetEventId: "event_5",
    },
  },
];

const state = replayRoomEvents(events);

assert.equal(state.roomId, "123");
assert.equal(state.version, 4);
assert.equal(state.status, "PLAYING");
assert.deepEqual(state.players, [
  {
    id: "player_1",
    nickname: "王五",
  },
  {
    id: "player_2",
    nickname: "李四",
  },
]);
assert.deepEqual(state.scores, [
  {
    playerId: "player_1",
    total: 0,
  },
  {
    playerId: "player_2",
    total: 0,
  },
]);
assert.deepEqual(state.rounds, []);
assert.deepEqual(
  state.events.map((event) => event.id),
  ["event_1", "event_2", "event_3", "event_4"],
);
