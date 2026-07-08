import assert from "node:assert/strict";

import {
  buildReplayEventsFromSnapshot,
  createPlayerLedger,
  createScoreHistory,
  createSettlement,
  replayRoomEvents,
} from "../dist/index.js";

const baseEvent = {
  roomId: "123",
  operator: "test",
  timestamp: "2026-07-06T00:00:00.000Z",
};

const roomCreatedState = replayRoomEvents([
  {
    ...baseEvent,
    id: "room_created",
    type: "ROOM_CREATED",
    version: 1,
    payload: {},
  },
  {
    ...baseEvent,
    id: "room_player_1",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "room_player_2",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "room_player_3",
    type: "PLAYER_JOINED",
    version: 4,
    payload: {
      playerId: "player_3",
      nickname: "赵六",
    },
  },
  {
    ...baseEvent,
    id: "room_started",
    type: "GAME_STARTED",
    version: 5,
    payload: {},
  },
]);

assert.equal(roomCreatedState.roomId, "123");
assert.equal(roomCreatedState.version, 5);
assert.deepEqual(roomCreatedState.players, [
  {
    id: "player_1",
    nickname: "张三",
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

const legacySnapshot = {
  roomId: "456",
  createdAt: "2026-07-06T00:00:00.000Z",
  status: "PLAYING",
  players: [
    {
      id: "legacy_player_1",
      nickname: "老张",
    },
    {
      id: "legacy_player_2",
      nickname: "老李",
    },
  ],
};

const legacyReplayState = replayRoomEvents(
  buildReplayEventsFromSnapshot(legacySnapshot, [
    {
      ...baseEvent,
      roomId: "456",
      id: "legacy_score",
      type: "DISCARD_WIN",
      version: 1,
      payload: {
        winnerId: "legacy_player_1",
        discarderId: "legacy_player_2",
      },
    },
  ]),
);

assert.equal(legacyReplayState.roomId, "456");
assert.equal(legacyReplayState.status, "PLAYING");
assert.deepEqual(
  legacyReplayState.players.map((player) => player.id),
  ["legacy_player_1", "legacy_player_2"],
);
assert.deepEqual(
  legacyReplayState.scores,
  [
    {
      playerId: "legacy_player_1",
      total: 1,
    },
    {
      playerId: "legacy_player_2",
      total: -1,
    },
  ],
);

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
  number: 1,
  status: "FINISHED",
  result: "WIN",
  winnerIds: ["player_1", "player_2", "player_3"],
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
    total: 0,
  },
  {
    playerId: "player_2",
    total: 0,
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
  [
    "event_1",
    "event_2",
    "event_3",
    "event_4",
    "event_5",
    "event_6",
    "event_8",
    "event_9",
    "event_11",
  ],
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
  number: 1,
  status: "FINISHED",
  result: "DRAW",
  winnerIds: ["player_1"],
});
assert.deepEqual(
  drawGameState.rounds.map((round) => round.eventId),
  ["event_6", "event_draw"],
);

const confirmedRoundState = replayRoomEvents([
  ...events.slice(0, 6),
  {
    ...baseEvent,
    id: "event_finished",
    type: "DRAW_GAME",
    version: 7,
    payload: {},
  },
  {
    ...baseEvent,
    id: "event_confirmed",
    type: "ROUND_CONFIRMED",
    version: 8,
    payload: {},
  },
  {
    ...baseEvent,
    id: "event_next_round",
    type: "SELF_DRAW",
    version: 9,
    payload: {
      winnerId: "player_2",
    },
  },
]);

assert.deepEqual(confirmedRoundState.currentRound, {
  number: 2,
  status: "ACTIVE",
  result: undefined,
  winnerIds: ["player_2"],
});

const extendedScoreEvents = [
  {
    ...baseEvent,
    id: "extended_1",
    type: "PLAYER_JOINED",
    version: 1,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "extended_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "extended_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_3",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "extended_4",
    type: "PLAYER_JOINED",
    version: 4,
    payload: {
      playerId: "player_4",
      nickname: "赵六",
    },
  },
  {
    ...baseEvent,
    id: "extended_5",
    type: "GAME_STARTED",
    version: 5,
    payload: {},
  },
  {
    ...baseEvent,
    id: "extended_6",
    type: "DISCARD_WIN",
    version: 6,
    payload: {
      winnerId: "player_1",
      discarderId: "player_2",
      fan: 3,
    },
  },
  {
    ...baseEvent,
    id: "extended_7",
    type: "KONG",
    version: 7,
    payload: {
      playerId: "player_3",
      kongType: "DISCARD_KONG",
      fromPlayerId: "player_4",
    },
  },
  {
    ...baseEvent,
    id: "extended_8",
    type: "KONG",
    version: 8,
    payload: {
      playerId: "player_4",
      kongType: "SUPPLEMENT_KONG",
    },
  },
  {
    ...baseEvent,
    id: "extended_9",
    type: "KONG",
    version: 9,
    payload: {
      playerId: "player_2",
      kongType: "CONCEALED_KONG",
    },
  },
  {
    ...baseEvent,
    id: "extended_10",
    type: "SELF_DRAW",
    version: 10,
    payload: {
      winnerId: "player_3",
      fan: 4,
    },
  },
  {
    ...baseEvent,
    id: "extended_11",
    type: "UNDO",
    version: 11,
    payload: {
      targetEventId: "extended_9",
    },
  },
];

const extendedScoreState = replayRoomEvents(extendedScoreEvents);
const extendedScoreHistory = createScoreHistory(extendedScoreEvents, extendedScoreState.players);
const extendedScoreLedger = createPlayerLedger(
  extendedScoreHistory,
  extendedScoreState.players,
);

assert.deepEqual(extendedScoreState.currentRound, {
  number: 1,
  status: "ACTIVE",
  result: undefined,
  winnerIds: ["player_1", "player_3"],
});
assert.deepEqual(extendedScoreState.scores, [
  {
    playerId: "player_1",
    total: 4,
  },
  {
    playerId: "player_2",
    total: -13,
  },
  {
    playerId: "player_3",
    total: 16,
  },
  {
    playerId: "player_4",
    total: -7,
  },
]);
assert.deepEqual(
  extendedScoreState.rounds.map((round) => round.eventId),
  ["extended_6", "extended_7", "extended_8", "extended_10"],
);
assert.deepEqual(
  extendedScoreLedger.map((player) => ({
    playerId: player.playerId,
    total: player.total,
    income: player.income,
    expense: player.expense,
  })),
  [
    {
      playerId: "player_1",
      total: 4,
      income: 4,
      expense: 0,
    },
    {
      playerId: "player_2",
      total: -13,
      income: 0,
      expense: 13,
    },
    {
      playerId: "player_3",
      total: 16,
      income: 17,
      expense: 1,
    },
    {
      playerId: "player_4",
      total: -7,
      income: 2,
      expense: 9,
    },
  ],
);
const undoneLedgerEntry = extendedScoreLedger
  .find((player) => player.playerId === "player_2")
  ?.entries.find((entry) => entry.eventId === "extended_9");

assert.equal(undoneLedgerEntry?.isUndone, true);
assert.equal(undoneLedgerEntry?.isUndoable, false);

const concealedKongState = replayRoomEvents([
  ...extendedScoreEvents.slice(0, 5),
  {
    ...baseEvent,
    id: "concealed_kong",
    type: "KONG",
    version: 6,
    payload: {
      playerId: "player_2",
      kongType: "CONCEALED_KONG",
    },
  },
]);

assert.deepEqual(concealedKongState.scores, [
  {
    playerId: "player_1",
    total: -2,
  },
  {
    playerId: "player_2",
    total: 6,
  },
  {
    playerId: "player_3",
    total: -2,
  },
  {
    playerId: "player_4",
    total: -2,
  },
]);

const legacyFanState = replayRoomEvents([
  ...extendedScoreEvents.slice(0, 5),
  {
    ...baseEvent,
    id: "legacy_fan",
    type: "DISCARD_WIN",
    version: 6,
    payload: {
      winnerId: "player_1",
      discarderId: "player_2",
    },
  },
]);

assert.deepEqual(legacyFanState.scores, [
  {
    playerId: "player_1",
    total: 1,
  },
  {
    playerId: "player_2",
    total: -1,
  },
  {
    playerId: "player_3",
    total: 0,
  },
  {
    playerId: "player_4",
    total: 0,
  },
]);

const settlement = createSettlement(
  extendedScoreState.roomId,
  extendedScoreState.players,
  extendedScoreState.scores,
  extendedScoreState.rounds,
);

assert.equal(settlement.roomId, "123");
assert.equal(settlement.totalRounds, 2);
assert.deepEqual(settlement.players, [
  {
    playerId: "player_3",
    nickname: "王五",
    rank: 1,
    total: 16,
    winCount: 1,
    discardCount: 0,
    kongCount: 1,
  },
  {
    playerId: "player_1",
    nickname: "张三",
    rank: 2,
    total: 4,
    winCount: 1,
    discardCount: 0,
    kongCount: 0,
  },
  {
    playerId: "player_4",
    nickname: "赵六",
    rank: 3,
    total: -7,
    winCount: 0,
    discardCount: 0,
    kongCount: 1,
  },
  {
    playerId: "player_2",
    nickname: "李四",
    rank: 4,
    total: -13,
    winCount: 0,
    discardCount: 1,
    kongCount: 0,
  },
]);
assert.equal(
  settlement.text,
  [
    "mah-score 房间 123 结算",
    "总局数：2",
    "1. 王五 16 分 胡1 点炮0 杠1",
    "2. 张三 4 分 胡1 点炮0 杠0",
    "3. 赵六 -7 分 胡0 点炮0 杠1",
    "4. 李四 -13 分 胡0 点炮1 杠0",
  ].join("\n"),
);
