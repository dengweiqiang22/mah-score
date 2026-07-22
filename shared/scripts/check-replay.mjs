import assert from "node:assert/strict";

import {
  buildReplayEventsFromSnapshot,
  createPlayerLedger,
  createScoreHistory,
  createSettlement,
  getRoomOwnerPlayerId,
  parseRoomEvent,
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
assert.equal(roomCreatedState.status, "PLAYING");
assert.deepEqual(roomCreatedState.currentRound, {
  number: 1,
  status: "ACTIVE",
  result: undefined,
  winnerIds: [],
});
assert.deepEqual(roomCreatedState.scores, [
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
assert.equal(getRoomOwnerPlayerId(roomCreatedState.events, roomCreatedState.players), "player_1");

const ownerPayloadState = replayRoomEvents([
  {
    ...baseEvent,
    id: "owner_payload_1",
    type: "ROOM_CREATED",
    version: 1,
    payload: {
      ownerPlayerId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "owner_payload_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "owner_payload_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
]);

assert.equal(getRoomOwnerPlayerId(ownerPayloadState.events, ownerPayloadState.players), "player_2");

const lifecycleState = replayRoomEvents([
  {
    ...baseEvent,
    id: "lifecycle_1",
    type: "ROOM_CREATED",
    version: 1,
    payload: {},
  },
  {
    ...baseEvent,
    id: "lifecycle_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "lifecycle_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "lifecycle_4",
    type: "PLAYER_RENAMED",
    version: 4,
    payload: {
      avatarId: "panda",
      playerId: "player_1",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "lifecycle_5",
    type: "PLAYER_REMOVED",
    version: 5,
    payload: {
      playerId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "lifecycle_6",
    type: "PLAYER_JOINED",
    version: 6,
    payload: {
      playerId: "player_3",
      nickname: "赵六",
    },
  },
  {
    ...baseEvent,
    id: "lifecycle_7",
    type: "GAME_STARTED",
    version: 7,
    payload: {},
  },
  {
    ...baseEvent,
    id: "lifecycle_8",
    type: "GAME_FINISHED",
    version: 8,
    payload: {},
  },
]);

assert.equal(lifecycleState.version, 8);
assert.equal(lifecycleState.status, "FINISHED");
assert.deepEqual(lifecycleState.players, [
  {
    avatarId: "panda",
    id: "player_1",
    nickname: "王五",
  },
  {
    id: "player_3",
    nickname: "赵六",
  },
]);
assert.deepEqual(lifecycleState.scores, [
  {
    playerId: "player_1",
    total: 0,
  },
  {
    playerId: "player_3",
    total: 0,
  },
]);
assert.deepEqual(
  lifecycleState.events.map((event) => event.type),
  [
    "ROOM_CREATED",
    "PLAYER_JOINED",
    "PLAYER_JOINED",
    "PLAYER_RENAMED",
    "PLAYER_REMOVED",
    "PLAYER_JOINED",
    "GAME_STARTED",
    "GAME_FINISHED",
  ],
);

const legacyRoomCreatedEvent = parseRoomEvent(
  JSON.stringify({
    ...baseEvent,
    id: "legacy_room_created_payload",
    type: "ROOM_CREATED",
    version: 1,
    payload: [],
  }),
);

assert.deepEqual(legacyRoomCreatedEvent?.payload, {});

const legacyPayloadState = replayRoomEvents(
  [
    legacyRoomCreatedEvent,
    {
      ...baseEvent,
      id: "legacy_payload_player",
      type: "PLAYER_JOINED",
      version: 2,
      payload: {
        playerId: "player_legacy_payload",
        nickname: "旧格式",
      },
    },
  ].filter((event) => event !== undefined),
);

assert.equal(legacyPayloadState.version, 2);
assert.deepEqual(legacyPayloadState.players, [
  {
    id: "player_legacy_payload",
    nickname: "旧格式",
  },
]);

const outOfOrderLifecycleState = replayRoomEvents([
  {
    ...baseEvent,
    id: "out_of_order_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "out_of_order_1",
    type: "ROOM_CREATED",
    version: 1,
    payload: {},
  },
  {
    ...baseEvent,
    id: "out_of_order_4",
    type: "GAME_STARTED",
    version: 4,
    payload: {},
  },
  {
    ...baseEvent,
    id: "out_of_order_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
]);

assert.equal(outOfOrderLifecycleState.version, 4);
assert.equal(outOfOrderLifecycleState.status, "PLAYING");
assert.deepEqual(
  outOfOrderLifecycleState.events.map((event) => event.id),
  ["out_of_order_1", "out_of_order_2", "out_of_order_3", "out_of_order_4"],
);

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
assert.deepEqual(legacyReplayState.scores, [
  {
    playerId: "legacy_player_1",
    total: 1,
  },
  {
    playerId: "legacy_player_2",
    total: -1,
  },
]);

const legacyFinishedReplayState = replayRoomEvents(
  buildReplayEventsFromSnapshot(
    {
      ...legacySnapshot,
      status: "FINISHED",
    },
    [],
  ),
);

assert.equal(legacyFinishedReplayState.roomId, "456");
assert.equal(legacyFinishedReplayState.status, "FINISHED");
assert.deepEqual(
  legacyFinishedReplayState.players.map((player) => player.id),
  ["legacy_player_1", "legacy_player_2"],
);
assert.deepEqual(
  legacyFinishedReplayState.events.map((event) => event.type),
  ["ROOM_CREATED", "PLAYER_JOINED", "PLAYER_JOINED", "GAME_STARTED", "GAME_FINISHED"],
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
  winnerIds: ["player_1", "player_2"],
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
    total: 1,
  },
  {
    playerId: "player_2",
    total: 1,
  },
  {
    playerId: "player_3",
    total: -2,
  },
]);
assert.deepEqual(
  state.rounds.map((round) => round.eventId),
  ["event_6", "event_8"],
);
assert.deepEqual(
  state.events.map((event) => event.id),
  ["event_1", "event_2", "event_3", "event_4", "event_5", "event_6", "event_8", "event_11"],
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

const settledDrawGameState = replayRoomEvents([
  ...events.slice(0, 5),
  {
    ...baseEvent,
    id: "settled_draw_6",
    type: "KONG",
    version: 6,
    payload: {
      playerId: "player_1",
      kongType: "SUPPLEMENT_KONG",
    },
  },
  {
    ...baseEvent,
    id: "settled_draw_7",
    type: "DRAW_GAME",
    version: 7,
    payload: {
      flowerPigPlayerIds: ["player_3"],
      readyHands: [
        {
          playerId: "player_2",
          maxFan: 2,
        },
      ],
      notReadyPlayerIds: ["player_1"],
      kongTaxRefundPlayerIds: ["player_1", "player_3"],
    },
  },
]);
const settledDrawGameHistory = createScoreHistory(
  settledDrawGameState.events,
  settledDrawGameState.players,
);

assert.deepEqual(settledDrawGameState.scores, [
  {
    playerId: "player_1",
    total: 7,
  },
  {
    playerId: "player_2",
    total: 11,
  },
  {
    playerId: "player_3",
    total: -18,
  },
]);
assert.deepEqual(
  settledDrawGameHistory.find((item) => item.event.id === "settled_draw_7")?.flows,
  [
    {
      playerId: "player_3",
      nickname: "赵六",
      delta: -17,
    },
    {
      playerId: "player_1",
      nickname: "王五",
      delta: 5,
    },
    {
      playerId: "player_2",
      nickname: "李四",
      delta: 12,
    },
  ],
);
assert.deepEqual(
  settledDrawGameHistory.find((item) => item.event.id === "settled_draw_7")?.taxRefunds,
  [
    {
      playerId: "player_1",
      nickname: "王五",
      details: [
        {
          label: "补杠",
          delta: -2,
        },
      ],
    },
  ],
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
const extendedScoreLedger = createPlayerLedger(extendedScoreHistory, extendedScoreState.players);

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
  extendedScoreHistory.map((item) => ({
    eventId: item.event.id,
    roundNumber: item.roundNumber,
    roundActionNumber: item.roundActionNumber,
    title: item.title,
    isUndone: item.isUndone,
  })),
  [
    {
      eventId: "extended_10",
      roundNumber: 1,
      roundActionNumber: 5,
      title: "王五 · 自摸 · 四番",
      isUndone: false,
    },
    {
      eventId: "extended_9",
      roundNumber: 1,
      roundActionNumber: 4,
      title: "李四 · 暗杠",
      isUndone: true,
    },
    {
      eventId: "extended_8",
      roundNumber: 1,
      roundActionNumber: 3,
      title: "赵六 · 补杠",
      isUndone: false,
    },
    {
      eventId: "extended_7",
      roundNumber: 1,
      roundActionNumber: 2,
      title: "王五 · 直杠 · 赵六",
      isUndone: false,
    },
    {
      eventId: "extended_6",
      roundNumber: 1,
      roundActionNumber: 1,
      title: "张三 · 点炮 · 李四 · 三番",
      isUndone: false,
    },
  ],
);
assert.deepEqual(
  extendedScoreHistory
    .find((item) => item.event.id === "extended_10")
    ?.flows.map((flow) => ({
      delta: flow.delta,
      playerId: flow.playerId,
    })),
  [
    {
      delta: 16,
      playerId: "player_3",
    },
    {
      delta: -8,
      playerId: "player_2",
    },
    {
      delta: -8,
      playerId: "player_4",
    },
  ],
);
assert.deepEqual(
  extendedScoreHistory
    .find((item) => item.event.id === "extended_8")
    ?.flows.map((flow) => ({
      delta: flow.delta,
      playerId: flow.playerId,
    })),
  [
    {
      delta: 2,
      playerId: "player_4",
    },
    {
      delta: -1,
      playerId: "player_2",
    },
    {
      delta: -1,
      playerId: "player_3",
    },
  ],
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

const undoScoreEvents = [
  {
    ...baseEvent,
    id: "undo_1",
    type: "PLAYER_JOINED",
    version: 1,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "undo_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "undo_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_3",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "undo_4",
    type: "GAME_STARTED",
    version: 4,
    payload: {},
  },
  {
    ...baseEvent,
    id: "undo_5",
    type: "DISCARD_WIN",
    version: 5,
    payload: {
      winnerId: "player_1",
      discarderId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "undo_6",
    type: "UNDO",
    version: 6,
    payload: {
      targetEventId: "undo_5",
    },
  },
  {
    ...baseEvent,
    id: "undo_7",
    type: "SELF_DRAW",
    version: 7,
    payload: {
      winnerId: "player_2",
    },
  },
];
const undoScoreState = replayRoomEvents(undoScoreEvents);
const undoScoreHistory = createScoreHistory(undoScoreEvents, undoScoreState.players);

assert.deepEqual(undoScoreState.scores, [
  {
    playerId: "player_1",
    total: -2,
  },
  {
    playerId: "player_2",
    total: 4,
  },
  {
    playerId: "player_3",
    total: -2,
  },
]);
assert.deepEqual(
  undoScoreState.rounds.map((round) => round.eventId),
  ["undo_7"],
);
assert.deepEqual(
  undoScoreHistory.map((item) => ({
    eventId: item.event.id,
    isUndone: item.isUndone,
    isUndoable: item.event.type !== "DRAW_GAME" && !item.isUndone,
  })),
  [
    {
      eventId: "undo_7",
      isUndone: false,
      isUndoable: true,
    },
    {
      eventId: "undo_5",
      isUndone: true,
      isUndoable: false,
    },
  ],
);

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

const invalidScoreState = replayRoomEvents([
  ...extendedScoreEvents.slice(0, 5),
  {
    ...baseEvent,
    id: "invalid_same_player",
    type: "DISCARD_WIN",
    version: 6,
    payload: {
      winnerId: "player_1",
      discarderId: "player_1",
    },
  },
  {
    ...baseEvent,
    id: "invalid_missing_player",
    type: "SELF_DRAW",
    version: 7,
    payload: {
      winnerId: "missing_player",
    },
  },
  {
    ...baseEvent,
    id: "valid_first_win",
    type: "DISCARD_WIN",
    version: 8,
    payload: {
      winnerId: "player_2",
      discarderId: "player_3",
    },
  },
  {
    ...baseEvent,
    id: "invalid_duplicate_winner",
    type: "SELF_DRAW",
    version: 9,
    payload: {
      winnerId: "player_2",
    },
  },
]);

assert.deepEqual(invalidScoreState.scores, [
  {
    playerId: "player_1",
    total: 0,
  },
  {
    playerId: "player_2",
    total: 1,
  },
  {
    playerId: "player_3",
    total: -1,
  },
  {
    playerId: "player_4",
    total: 0,
  },
]);
assert.deepEqual(invalidScoreState.currentRound.winnerIds, ["player_2"]);

const multiWinRoundEvents = [
  {
    ...baseEvent,
    id: "multi_1",
    type: "PLAYER_JOINED",
    version: 1,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "multi_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "multi_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_3",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "multi_4",
    type: "PLAYER_JOINED",
    version: 4,
    payload: {
      playerId: "player_4",
      nickname: "赵六",
    },
  },
  {
    ...baseEvent,
    id: "multi_5",
    type: "GAME_STARTED",
    version: 5,
    payload: {},
  },
  {
    ...baseEvent,
    id: "multi_6",
    type: "DISCARD_WIN",
    version: 6,
    payload: {
      winnerId: "player_1",
      discarderId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "multi_7",
    type: "SELF_DRAW",
    version: 7,
    payload: {
      winnerId: "player_2",
    },
  },
  {
    ...baseEvent,
    id: "multi_8",
    type: "DISCARD_WIN",
    version: 8,
    payload: {
      winnerId: "player_3",
      discarderId: "player_4",
    },
  },
];

const multiWinRoundState = replayRoomEvents(multiWinRoundEvents);
const multiWinRoundSettlement = createSettlement(
  multiWinRoundState.roomId,
  multiWinRoundState.players,
  multiWinRoundState.scores,
  multiWinRoundEvents,
  multiWinRoundState.currentRound,
);

assert.equal(multiWinRoundState.currentRound.status, "FINISHED");
assert.equal(multiWinRoundSettlement.totalRounds, 1);

const twoPlayerRoundState = replayRoomEvents([
  {
    ...baseEvent,
    id: "two_player_1",
    type: "PLAYER_JOINED",
    version: 1,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "two_player_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "two_player_3",
    type: "GAME_STARTED",
    version: 3,
    payload: {},
  },
  {
    ...baseEvent,
    id: "two_player_4",
    type: "DISCARD_WIN",
    version: 4,
    payload: {
      winnerId: "player_1",
      discarderId: "player_2",
    },
  },
]);

assert.deepEqual(twoPlayerRoundState.currentRound, {
  number: 1,
  status: "FINISHED",
  result: "WIN",
  winnerIds: ["player_1"],
});

const threePlayerOneWinnerRoundState = replayRoomEvents([
  {
    ...baseEvent,
    id: "three_player_1",
    type: "PLAYER_JOINED",
    version: 1,
    payload: {
      playerId: "player_1",
      nickname: "张三",
    },
  },
  {
    ...baseEvent,
    id: "three_player_2",
    type: "PLAYER_JOINED",
    version: 2,
    payload: {
      playerId: "player_2",
      nickname: "李四",
    },
  },
  {
    ...baseEvent,
    id: "three_player_3",
    type: "PLAYER_JOINED",
    version: 3,
    payload: {
      playerId: "player_3",
      nickname: "王五",
    },
  },
  {
    ...baseEvent,
    id: "three_player_4",
    type: "GAME_STARTED",
    version: 4,
    payload: {},
  },
  {
    ...baseEvent,
    id: "three_player_5",
    type: "SELF_DRAW",
    version: 5,
    payload: {
      winnerId: "player_1",
    },
  },
]);

assert.equal(threePlayerOneWinnerRoundState.currentRound.status, "ACTIVE");
assert.deepEqual(threePlayerOneWinnerRoundState.currentRound.winnerIds, ["player_1"]);

const threePlayerTwoWinnerRoundState = replayRoomEvents([
  ...threePlayerOneWinnerRoundState.events,
  {
    ...baseEvent,
    id: "three_player_6",
    type: "DISCARD_WIN",
    version: 6,
    payload: {
      winnerId: "player_2",
      discarderId: "player_3",
    },
  },
]);

assert.deepEqual(threePlayerTwoWinnerRoundState.currentRound, {
  number: 1,
  status: "FINISHED",
  result: "WIN",
  winnerIds: ["player_1", "player_2"],
});

const drawGameSettlement = createSettlement(
  drawGameState.roomId,
  drawGameState.players,
  drawGameState.scores,
  [
    ...events.slice(0, 6),
    {
      ...baseEvent,
      id: "event_draw",
      type: "DRAW_GAME",
      version: 7,
      payload: {},
    },
  ],
  drawGameState.currentRound,
);

assert.equal(drawGameSettlement.totalRounds, 1);

const unfinishedRoundEvents = [
  ...multiWinRoundEvents,
  {
    ...baseEvent,
    id: "unfinished_9",
    type: "ROUND_CONFIRMED",
    version: 9,
    payload: {},
  },
  {
    ...baseEvent,
    id: "unfinished_10",
    type: "KONG",
    version: 10,
    payload: {
      playerId: "player_3",
      kongType: "DISCARD_KONG",
      fromPlayerId: "player_4",
    },
  },
  {
    ...baseEvent,
    id: "unfinished_11",
    type: "KONG",
    version: 11,
    payload: {
      playerId: "player_4",
      kongType: "SUPPLEMENT_KONG",
    },
  },
  {
    ...baseEvent,
    id: "unfinished_12",
    type: "GAME_FINISHED",
    version: 12,
    payload: {},
  },
];

const unfinishedRoundState = replayRoomEvents(unfinishedRoundEvents);
const unfinishedRoundSettlement = createSettlement(
  unfinishedRoundState.roomId,
  unfinishedRoundState.players,
  unfinishedRoundState.scores,
  unfinishedRoundEvents,
  unfinishedRoundState.currentRound,
);

assert.equal(unfinishedRoundState.currentRound.number, 2);
assert.equal(unfinishedRoundState.currentRound.status, "ACTIVE");
assert.equal(unfinishedRoundSettlement.totalRounds, 2);
assert.equal(unfinishedRoundSettlement.text.includes("总局数：2"), true);
assert.equal(
  unfinishedRoundSettlement.players.find((player) => player.playerId === "player_3")?.kongCount,
  1,
);
assert.equal(
  unfinishedRoundSettlement.players.find((player) => player.playerId === "player_4")?.kongCount,
  1,
);
