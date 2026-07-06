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
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_3",
      nickname: "赵六",
    },
  },
  {
    ...baseEvent,
    id: "event_4",
    type: "PLAYER_RENAMED",
    version: 4,
    payload: {
      playerId: "player_1",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "event_5",
    type: "GAME_STARTED",
    version: 5,
    payload: {},
  },
  {
    ...baseEvent,
    id: "event_6",
    type: "DISCARD_WIN",
    version: 6,
    payload: {
      winnerId: "player_1",
      discarderId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "event_7",
    type: "DRAW_GAME",
    version: 7,
    payload: {},
  },
  {
    ...baseEvent,
    id: "event_8",
    type: "SELF_DRAW",
    version: 8,
    payload: {
      winnerId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "event_9",
    type: "DISCARD_WIN",
    version: 9,
    payload: {
      winnerId: "player_3",
      discarderId: "player_1",
    },
  },
  {
    ...baseEvent,
    id: "event_10",
    type: "UNDO",
    version: 10,
    payload: {
      targetEventId: "event_7",
    },
  },
  {
    ...baseEvent,
    id: "event_11",
    type: "GAME_FINISHED",
    version: 11,
    payload: {},
  },
];

const state = replayRoomEvents(events);

assert.equal(state.roomId, "123");
assert.equal(state.version, 11);
assert.equal(state.status, "FINISHED");
assert.deepEqual(state.currentRound, {
  number: 2,
  winnerIds: [],
});
assert.deepEqual(state.players, [
  {
    id: "player_1",
    nickname: "王五",
  },
  {
    id: "player_2",
    nickname: "李四",
  },
  {
    id: "player_3",
    nickname: "赵六",
  },
]);
assert.deepEqual(state.scores, [
  {
    playerId: "player_1",
    total: -1,
  },
  {
    playerId: "player_2",
    total: 1,
  },
  {
    playerId: "player_3",
    total: 0,
  },
]);
assert.deepEqual(
  state.rounds.map((round) => round.eventId),
  ["event_6", "event_8", "event_9"],
);
assert.deepEqual(
  state.events.map((event) => event.id),
  ["event_1", "event_2", "event_3", "event_4", "event_5", "event_6", "event_8", "event_9", "event_11"],
);

const drawGameState = replayRoomEvents([
  ...events.slice(0, 6),
  {
    ...baseEvent,
    id: "event_draw",
    type: "DRAW_GAME",
    version: 7,
    payload: {},
  },
]);

assert.deepEqual(drawGameState.currentRound, {
  number: 2,
  winnerIds: [],
});
assert.deepEqual(
  drawGameState.rounds.map((round) => round.eventId),
  ["event_6", "event_draw"],
);
