import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer, RoomSnapshot } from "../types/room.js";
import type { CurrentRoundState, RoomState, RoundState, ScoreState } from "../types/roomState.js";

interface MutableReplayState {
  roomId: string;
  version: number;
  status: RoomState["status"];
  players: RoomPlayer[];
  scores: ScoreState[];
  currentRound: CurrentRoundState;
  rounds: RoundState[];
  events: RoomEvent[];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function getStringPayloadValue(event: RoomEvent, key: string): string | undefined {
  const value = event.payload[key];

  return isString(value) ? value : undefined;
}

function getNumberPayloadValue(event: RoomEvent, key: string): number | undefined {
  const value = event.payload[key];

  return typeof value === "number" ? value : undefined;
}

function getFanScore(event: RoomEvent): number {
  const fan = getNumberPayloadValue(event, "fan");

  if (fan === 2) {
    return 2;
  }

  if (fan === 3) {
    return 4;
  }

  if (fan === 4) {
    return 8;
  }

  return 1;
}

function getScoreTotal(scores: readonly ScoreState[], playerId: string): number {
  return scores.find((score) => score.playerId === playerId)?.total ?? 0;
}

function getUndoTargetEventId(event: RoomEvent): string | undefined {
  return getStringPayloadValue(event, "targetEventId");
}

function getEffectiveEvents(events: readonly RoomEvent[]): readonly RoomEvent[] {
  const undoneEventIds = new Set<string>();

  for (const event of events) {
    if (event.type === "UNDO") {
      const targetEventId = getUndoTargetEventId(event);

      if (targetEventId !== undefined) {
        undoneEventIds.add(targetEventId);
      }
    }
  }

  return events.filter((event) => event.type !== "UNDO" && !undoneEventIds.has(event.id));
}

function createSyntheticRoomCreatedEvent(snapshot: RoomSnapshot): RoomEvent {
  return {
    id: `room_${snapshot.roomId}_created`,
    roomId: snapshot.roomId,
    type: "ROOM_CREATED",
    version: 0,
    operator: "room",
    timestamp: snapshot.createdAt,
    payload: {},
  };
}

function createSyntheticPlayerJoinedEvents(snapshot: RoomSnapshot): readonly RoomEvent[] {
  return snapshot.players.map((player) => ({
    id: `room_${snapshot.roomId}_player_${player.id}`,
    roomId: snapshot.roomId,
    type: "PLAYER_JOINED",
    version: 0,
    operator: "room",
    timestamp: snapshot.createdAt,
    payload: {
      playerId: player.id,
      nickname: player.nickname,
    },
  }));
}

function createSyntheticGameStartedEvent(snapshot: RoomSnapshot): RoomEvent {
  return {
    id: `room_${snapshot.roomId}_started`,
    roomId: snapshot.roomId,
    type: "GAME_STARTED",
    version: 0,
    operator: "room",
    timestamp: snapshot.createdAt,
    payload: {},
  };
}

function createSyntheticGameFinishedEvent(snapshot: RoomSnapshot): RoomEvent {
  return {
    id: `room_${snapshot.roomId}_finished`,
    roomId: snapshot.roomId,
    type: "GAME_FINISHED",
    version: 0,
    operator: "room",
    timestamp: snapshot.createdAt,
    payload: {},
  };
}

export function buildReplayEventsFromSnapshot(
  snapshot: RoomSnapshot,
  events: readonly RoomEvent[],
): readonly RoomEvent[] {
  const hasRoomCreatedEvent = events.some((event) => event.type === "ROOM_CREATED");
  const hasPlayerJoinedEvent = events.some((event) => event.type === "PLAYER_JOINED");
  const hasGameStartedEvent = events.some((event) => event.type === "GAME_STARTED");
  const hasGameFinishedEvent = events.some((event) => event.type === "GAME_FINISHED");

  const syntheticEvents: RoomEvent[] = [];

  if (!hasRoomCreatedEvent) {
    syntheticEvents.push(createSyntheticRoomCreatedEvent(snapshot));
  }

  if (!hasPlayerJoinedEvent) {
    syntheticEvents.push(...createSyntheticPlayerJoinedEvents(snapshot));
  }

  if ((snapshot.status === "PLAYING" || snapshot.status === "FINISHED") && !hasGameStartedEvent) {
    syntheticEvents.push(createSyntheticGameStartedEvent(snapshot));
  }

  if (snapshot.status === "FINISHED" && !hasGameFinishedEvent) {
    syntheticEvents.push(createSyntheticGameFinishedEvent(snapshot));
  }

  return [...syntheticEvents, ...events];
}

function createInitialState(roomId: string): MutableReplayState {
  return {
    roomId,
    version: 0,
    status: "WAITING",
    players: [],
    scores: [],
    currentRound: {
      number: 0,
      status: "WAITING",
      result: undefined,
      winnerIds: [],
    },
    rounds: [],
    events: [],
  };
}

function upsertScore(scores: ScoreState[], playerId: string): ScoreState[] {
  if (scores.some((score) => score.playerId === playerId)) {
    return scores;
  }

  return [
    ...scores,
    {
      playerId,
      total: 0,
    },
  ];
}

function removeScore(scores: ScoreState[], playerId: string): ScoreState[] {
  return scores.filter((score) => score.playerId !== playerId);
}

function getCurrentRoundWinnerIds(currentRound: CurrentRoundState): Set<string> {
  return new Set(currentRound.winnerIds);
}

function playerExists(state: MutableReplayState, playerId: string): boolean {
  return state.players.some((player) => player.id === playerId);
}

function hasWonCurrentRound(state: MutableReplayState, playerId: string): boolean {
  return state.currentRound.winnerIds.includes(playerId);
}

function getActivePlayers(state: MutableReplayState): readonly RoomPlayer[] {
  const winnerIds = getCurrentRoundWinnerIds(state.currentRound);

  return state.players.filter((player) => !winnerIds.has(player.id));
}

function ensureActiveRound(state: MutableReplayState): MutableReplayState {
  if (state.currentRound.number > 0) {
    return state;
  }

  return {
    ...state,
    currentRound: {
      number: 1,
      status: "ACTIVE",
      result: undefined,
      winnerIds: [],
    },
  };
}

function finishCurrentRound(state: MutableReplayState, result: "WIN" | "DRAW"): MutableReplayState {
  if (state.currentRound.number === 0) {
    return {
      ...state,
      currentRound: {
        number: 1,
        status: "FINISHED",
        result,
        winnerIds: [],
      },
    };
  }

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      status: "FINISHED",
      result,
    },
  };
}

function confirmFinishedRound(state: MutableReplayState): MutableReplayState {
  if (state.currentRound.status !== "FINISHED") {
    return state;
  }

  return {
    ...state,
    currentRound: {
      number: state.currentRound.number + 1,
      status: "ACTIVE",
      result: undefined,
      winnerIds: [],
    },
  };
}

function recordRoundWinner(state: MutableReplayState, winnerId: string): MutableReplayState {
  const activeState = ensureActiveRound(state);

  if (!playerExists(activeState, winnerId)) {
    return activeState;
  }

  const winnerIds = getCurrentRoundWinnerIds(activeState.currentRound);

  if (winnerIds.has(winnerId)) {
    return activeState;
  }

  winnerIds.add(winnerId);

  const nextState: MutableReplayState = {
    ...activeState,
    currentRound: {
      ...activeState.currentRound,
      winnerIds: [...winnerIds],
    },
  };

  if (winnerIds.size >= 3) {
    return finishCurrentRound(nextState, "WIN");
  }

  return {
    ...nextState,
    currentRound: {
      ...nextState.currentRound,
      status: "ACTIVE",
      result: undefined,
    },
  };
}

function addScore(scores: ScoreState[], playerId: string, delta: number): ScoreState[] {
  const nextScores = upsertScore(scores, playerId);

  return nextScores.map((score) =>
    score.playerId === playerId
      ? {
          ...score,
          total: score.total + delta,
        }
      : score,
  );
}

function applyPlayerJoined(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const playerId = getStringPayloadValue(event, "playerId");
  const nickname = getStringPayloadValue(event, "nickname");

  if (playerId === undefined || nickname === undefined) {
    return state;
  }

  if (state.players.some((player) => player.id === playerId)) {
    return state;
  }

  return {
    ...state,
    players: [
      ...state.players,
      {
        id: playerId,
        nickname,
      },
    ],
    scores: upsertScore(state.scores, playerId),
  };
}

function applyPlayerRenamed(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const playerId = getStringPayloadValue(event, "playerId");
  const nickname = getStringPayloadValue(event, "nickname");

  if (playerId === undefined || nickname === undefined) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            nickname,
          }
        : player,
    ),
  };
}

function applyPlayerRemoved(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const playerId = getStringPayloadValue(event, "playerId");

  if (playerId === undefined) {
    return state;
  }

  return {
    ...state,
    players: state.players.filter((player) => player.id !== playerId),
    scores: removeScore(state.scores, playerId),
  };
}

function applyRoundEvent(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  return {
    ...state,
    rounds: [
      ...state.rounds,
      {
        eventId: event.id,
        type: event.type,
        version: event.version,
        payload: event.payload,
      },
    ],
  };
}

function applyDiscardWinScore(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const winnerId = getStringPayloadValue(event, "winnerId");
  const discarderId = getStringPayloadValue(event, "discarderId");

  if (winnerId === undefined || discarderId === undefined || winnerId === discarderId) {
    return state;
  }

  if (
    !playerExists(state, winnerId) ||
    !playerExists(state, discarderId) ||
    hasWonCurrentRound(state, winnerId)
  ) {
    return state;
  }

  const score = getFanScore(event);

  return {
    ...state,
    scores: addScore(addScore(state.scores, winnerId, score), discarderId, -score),
  };
}

function applySelfDrawScore(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const winnerId = getStringPayloadValue(event, "winnerId");

  if (
    winnerId === undefined ||
    !playerExists(state, winnerId) ||
    hasWonCurrentRound(state, winnerId)
  ) {
    return state;
  }

  const score = getFanScore(event);
  const activePlayers = getActivePlayers(state);

  return {
    ...state,
    scores: activePlayers.reduce(
      (scores, player) =>
        addScore(
          scores,
          player.id,
          player.id === winnerId ? score * (activePlayers.length - 1) : -score,
        ),
      state.scores,
    ),
  };
}

function applyDiscardKongScore(
  state: MutableReplayState,
  event: RoomEvent,
  playerId: string,
): MutableReplayState {
  const fromPlayerId = getStringPayloadValue(event, "fromPlayerId");

  if (
    fromPlayerId === undefined ||
    fromPlayerId === playerId ||
    !playerExists(state, fromPlayerId) ||
    hasWonCurrentRound(state, fromPlayerId)
  ) {
    return state;
  }

  return {
    ...state,
    scores: addScore(addScore(state.scores, playerId, 1), fromPlayerId, -1),
  };
}

function applySharedKongScore(
  state: MutableReplayState,
  playerId: string,
  payerScore: number,
): MutableReplayState {
  const activePlayers = getActivePlayers(state);

  return {
    ...state,
    scores: activePlayers.reduce(
      (scores, player) =>
        addScore(
          scores,
          player.id,
          player.id === playerId ? payerScore * (activePlayers.length - 1) : -payerScore,
        ),
      state.scores,
    ),
  };
}

function applyKongScore(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const playerId = getStringPayloadValue(event, "playerId");
  const kongType = getStringPayloadValue(event, "kongType");

  if (
    playerId === undefined ||
    !playerExists(state, playerId) ||
    hasWonCurrentRound(state, playerId)
  ) {
    return state;
  }

  if (kongType === "DISCARD_KONG") {
    return applyDiscardKongScore(state, event, playerId);
  }

  if (kongType === "SUPPLEMENT_KONG") {
    return applySharedKongScore(state, playerId, 1);
  }

  if (kongType === "CONCEALED_KONG") {
    return applySharedKongScore(state, playerId, 2);
  }

  return state;
}

function applyScoreEvent(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  if (event.type === "DISCARD_WIN") {
    const scoredState = applyDiscardWinScore(state, event);
    const winnerId = getStringPayloadValue(event, "winnerId");

    return scoredState === state || winnerId === undefined
      ? scoredState
      : recordRoundWinner(scoredState, winnerId);
  }

  if (event.type === "SELF_DRAW") {
    const scoredState = applySelfDrawScore(state, event);
    const winnerId = getStringPayloadValue(event, "winnerId");

    return scoredState === state || winnerId === undefined
      ? scoredState
      : recordRoundWinner(scoredState, winnerId);
  }

  if (event.type === "KONG") {
    return applyKongScore(state, event);
  }

  if (event.type === "DRAW_GAME") {
    return finishCurrentRound(ensureActiveRound(state), "DRAW");
  }

  if (event.type === "ROUND_CONFIRMED") {
    return confirmFinishedRound(state);
  }

  return state;
}

function applyEvent(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const nextState: MutableReplayState = {
    ...state,
    roomId: event.roomId,
    version: event.version,
    events: [...state.events, event],
  };

  if (event.type === "PLAYER_JOINED") {
    return applyPlayerJoined(nextState, event);
  }

  if (event.type === "PLAYER_RENAMED") {
    return applyPlayerRenamed(nextState, event);
  }

  if (event.type === "PLAYER_REMOVED") {
    return applyPlayerRemoved(nextState, event);
  }

  if (event.type === "ROOM_CREATED") {
    return nextState;
  }

  if (event.type === "GAME_STARTED") {
    return {
      ...nextState,
      status: "PLAYING",
      currentRound: {
        number: 1,
        status: "ACTIVE",
        result: undefined,
        winnerIds: [],
      },
    };
  }

  if (event.type === "GAME_FINISHED") {
    return {
      ...nextState,
      status: "FINISHED",
    };
  }

  if (event.type === "ROUND_CONFIRMED") {
    if (state.currentRound.status !== "FINISHED") {
      return state;
    }

    return applyScoreEvent(applyRoundEvent(nextState, event), event);
  }

  if (
    event.type === "DISCARD_WIN" ||
    event.type === "SELF_DRAW" ||
    event.type === "KONG" ||
    event.type === "DRAW_GAME"
  ) {
    if (state.currentRound.status === "FINISHED") {
      return state;
    }

    return applyScoreEvent(applyRoundEvent(nextState, event), event);
  }

  return nextState;
}

export function replayRoomEvents(events: readonly RoomEvent[]): RoomState {
  const firstEvent = events[0];
  const initialRoomId = firstEvent?.roomId ?? "";
  const effectiveEvents = getEffectiveEvents(
    [...events].sort((left, right) => left.version - right.version),
  );
  const finalState = effectiveEvents.reduce<MutableReplayState>(
    (state, event) => applyEvent(state, event),
    createInitialState(initialRoomId),
  );

  return {
    roomId: finalState.roomId,
    version: finalState.version,
    status: finalState.status,
    players: finalState.players,
    scores: finalState.players.map((player) => ({
      playerId: player.id,
      total: getScoreTotal(finalState.scores, player.id),
    })),
    currentRound: finalState.currentRound,
    rounds: finalState.rounds,
    events: finalState.events,
  };
}
