import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer } from "../types/room.js";
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

function createInitialState(roomId: string): MutableReplayState {
  return {
    roomId,
    version: 0,
    status: "WAITING",
    players: [],
    scores: [],
    currentRound: {
      number: 0,
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

function startNextRound(state: MutableReplayState): MutableReplayState {
  return {
    ...state,
    currentRound: {
      number: state.currentRound.number + 1,
      winnerIds: [],
    },
  };
}

function ensureActiveRound(state: MutableReplayState): MutableReplayState {
  if (state.currentRound.number > 0) {
    return state;
  }

  return {
    ...state,
    currentRound: {
      number: 1,
      winnerIds: [],
    },
  };
}

function recordRoundWinner(state: MutableReplayState, winnerId: string): MutableReplayState {
  const activeState = ensureActiveRound(state);
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
    return startNextRound(nextState);
  }

  return nextState;
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

  const winnerExists = state.players.some((player) => player.id === winnerId);
  const discarderExists = state.players.some((player) => player.id === discarderId);

  if (!winnerExists || !discarderExists) {
    return state;
  }

  return {
    ...state,
    scores: addScore(addScore(state.scores, winnerId, 1), discarderId, -1),
  };
}

function applySelfDrawScore(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  const winnerId = getStringPayloadValue(event, "winnerId");

  if (winnerId === undefined || !state.players.some((player) => player.id === winnerId)) {
    return state;
  }

  return {
    ...state,
    scores: state.players.reduce(
      (scores, player) => addScore(scores, player.id, player.id === winnerId ? state.players.length - 1 : -1),
      state.scores,
    ),
  };
}

function applyScoreEvent(state: MutableReplayState, event: RoomEvent): MutableReplayState {
  if (event.type === "DISCARD_WIN") {
    const scoredState = applyDiscardWinScore(state, event);
    const winnerId = getStringPayloadValue(event, "winnerId");

    return winnerId === undefined ? scoredState : recordRoundWinner(scoredState, winnerId);
  }

  if (event.type === "SELF_DRAW") {
    const scoredState = applySelfDrawScore(state, event);
    const winnerId = getStringPayloadValue(event, "winnerId");

    return winnerId === undefined ? scoredState : recordRoundWinner(scoredState, winnerId);
  }

  if (event.type === "DRAW_GAME") {
    return startNextRound(ensureActiveRound(state));
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

  if (event.type === "GAME_STARTED") {
    return {
      ...nextState,
      status: "PLAYING",
      currentRound: {
        number: 1,
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

  if (event.type === "DISCARD_WIN" || event.type === "SELF_DRAW" || event.type === "DRAW_GAME") {
    return applyScoreEvent(applyRoundEvent(nextState, event), event);
  }

  return nextState;
}

export function replayRoomEvents(events: readonly RoomEvent[]): RoomState {
  const firstEvent = events[0];
  const initialRoomId = firstEvent?.roomId ?? "";
  const effectiveEvents = getEffectiveEvents([...events].sort((left, right) => left.version - right.version));
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
