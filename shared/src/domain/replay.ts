import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer } from "../types/room.js";
import type { RoomState, RoundState, ScoreState } from "../types/roomState.js";

interface MutableReplayState {
  roomId: string;
  version: number;
  status: RoomState["status"];
  players: RoomPlayer[];
  scores: ScoreState[];
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
    };
  }

  if (event.type === "DISCARD_WIN" || event.type === "SELF_DRAW" || event.type === "DRAW_GAME") {
    return applyRoundEvent(nextState, event);
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
    scores: finalState.scores,
    rounds: finalState.rounds,
    events: finalState.events,
  };
}
