import type { KongType, ScoreFan } from "../types/score.js";

export type EntryEventType =
  | "DISCARD_KONG"
  | "SUPPLEMENT_KONG"
  | "CONCEALED_KONG"
  | "DISCARD_WIN"
  | "SELF_DRAW"
  | "DRAW_GAME";

export type EntryState =
  | { readonly type: "idle" }
  | { readonly actorId: string; readonly type: "player_selected" }
  | { readonly actorId: string; readonly type: "waiting_for_self_draw_fan" }
  | { readonly actorId: string; readonly fan: ScoreFan; readonly type: "self_draw_ready" }
  | { readonly actorId: string; readonly type: "waiting_for_discard_win_counterparty" }
  | {
      readonly actorId: string;
      readonly counterpartyId: string;
      readonly type: "waiting_for_discard_win_fan";
    }
  | {
      readonly actorId: string;
      readonly counterpartyId: string;
      readonly fan: ScoreFan;
      readonly type: "discard_win_ready";
    }
  | { readonly actorId: string; readonly type: "waiting_for_discard_kong_counterparty" }
  | {
      readonly actorId: string;
      readonly counterpartyId: string;
      readonly type: "discard_kong_ready";
    }
  | {
      readonly actorId: string;
      readonly kongType: "SUPPLEMENT_KONG" | "CONCEALED_KONG";
      readonly type: "shared_kong_ready";
    }
  | { readonly type: "draw_confirm" };

export type EntrySubmitDraft =
  | {
      readonly action: "SELF_DRAW";
      readonly fan: ScoreFan;
      readonly winnerId: string;
    }
  | {
      readonly action: "DISCARD_WIN";
      readonly discarderId: string;
      readonly fan: ScoreFan;
      readonly winnerId: string;
    }
  | {
      readonly action: "KONG";
      readonly fromPlayerId: string;
      readonly kongType: "DISCARD_KONG";
      readonly playerId: string;
    }
  | {
      readonly action: "KONG";
      readonly kongType: "SUPPLEMENT_KONG" | "CONCEALED_KONG";
      readonly playerId: string;
    }
  | { readonly action: "DRAW_GAME" };

export interface EntryTransition {
  readonly errorMessage?: string;
  readonly state: EntryState;
  readonly submitDraft?: EntrySubmitDraft;
}

export function getEntryActorId(state: EntryState): string | undefined {
  if (state.type === "idle" || state.type === "draw_confirm") {
    return undefined;
  }

  return state.actorId;
}

export function getEntryCounterpartyId(state: EntryState): string | undefined {
  if (
    state.type === "waiting_for_discard_win_fan" ||
    state.type === "discard_win_ready" ||
    state.type === "discard_kong_ready"
  ) {
    return state.counterpartyId;
  }

  return undefined;
}

export function getEntryFan(state: EntryState): ScoreFan | undefined {
  if (state.type === "self_draw_ready" || state.type === "discard_win_ready") {
    return state.fan;
  }

  return undefined;
}

export function getEntryKongType(state: EntryState): KongType | undefined {
  if (state.type === "waiting_for_discard_kong_counterparty" || state.type === "discard_kong_ready") {
    return "DISCARD_KONG";
  }

  if (state.type === "shared_kong_ready") {
    return state.kongType;
  }

  return undefined;
}

export function getEntryMode(state: EntryState): "SELF_DRAW" | "DISCARD_WIN" | "KONG" | "DRAW_GAME" | undefined {
  if (state.type === "idle" || state.type === "player_selected") {
    return undefined;
  }

  if (state.type === "draw_confirm") {
    return "DRAW_GAME";
  }

  if (state.type === "waiting_for_self_draw_fan" || state.type === "self_draw_ready") {
    return "SELF_DRAW";
  }

  if (
    state.type === "waiting_for_discard_win_counterparty" ||
    state.type === "waiting_for_discard_win_fan" ||
    state.type === "discard_win_ready"
  ) {
    return "DISCARD_WIN";
  }

  return "KONG";
}

export function isWaitingForCounterparty(state: EntryState): boolean {
  return (
    state.type === "waiting_for_discard_win_counterparty" ||
    state.type === "waiting_for_discard_kong_counterparty"
  );
}

export function isSelectingFan(state: EntryState): boolean {
  return state.type === "waiting_for_self_draw_fan" || state.type === "waiting_for_discard_win_fan";
}

function isBlockedPlayer(playerId: string, blockedPlayerIds: readonly string[]): boolean {
  return blockedPlayerIds.includes(playerId);
}

export function selectEntryPlayer(
  state: EntryState,
  playerId: string,
  blockedPlayerIds: readonly string[],
): EntryTransition {
  if (state.type === "draw_confirm" || isBlockedPlayer(playerId, blockedPlayerIds)) {
    return { state };
  }

  if (state.type === "waiting_for_discard_kong_counterparty") {
    if (state.actorId === playerId) {
      return { errorMessage: "引杠玩家不能和杠牌玩家相同。", state };
    }

    return {
      state: { actorId: state.actorId, counterpartyId: playerId, type: "discard_kong_ready" },
      submitDraft: {
        action: "KONG",
        fromPlayerId: playerId,
        kongType: "DISCARD_KONG",
        playerId: state.actorId,
      },
    };
  }

  if (state.type === "waiting_for_discard_win_counterparty") {
    if (state.actorId === playerId) {
      return { errorMessage: "点炮玩家不能和胡牌玩家相同。", state };
    }

    return {
      state: {
        actorId: state.actorId,
        counterpartyId: playerId,
        type: "waiting_for_discard_win_fan",
      },
    };
  }

  return {
    state: getEntryActorId(state) === playerId ? { type: "idle" } : { actorId: playerId, type: "player_selected" },
  };
}

export function selectEntryEvent(state: EntryState, eventType: EntryEventType): EntryTransition {
  if (eventType === "DRAW_GAME") {
    return { state: { type: "draw_confirm" } };
  }

  const actorId = getEntryActorId(state);

  if (actorId === undefined) {
    return { errorMessage: "请先选择玩家。", state };
  }

  if (eventType === "SELF_DRAW") {
    return { state: { actorId, type: "waiting_for_self_draw_fan" } };
  }

  if (eventType === "DISCARD_WIN") {
    return { state: { actorId, type: "waiting_for_discard_win_counterparty" } };
  }

  if (eventType === "DISCARD_KONG") {
    return { state: { actorId, type: "waiting_for_discard_kong_counterparty" } };
  }

  return {
    state: { actorId, kongType: eventType, type: "shared_kong_ready" },
    submitDraft: {
      action: "KONG",
      kongType: eventType,
      playerId: actorId,
    },
  };
}

export function selectEntryFan(state: EntryState, fan: ScoreFan): EntryTransition {
  if (state.type === "waiting_for_self_draw_fan") {
    return {
      state: { actorId: state.actorId, fan, type: "self_draw_ready" },
      submitDraft: {
        action: "SELF_DRAW",
        fan,
        winnerId: state.actorId,
      },
    };
  }

  if (state.type === "waiting_for_discard_win_fan") {
    return {
      state: {
        actorId: state.actorId,
        counterpartyId: state.counterpartyId,
        fan,
        type: "discard_win_ready",
      },
      submitDraft: {
        action: "DISCARD_WIN",
        discarderId: state.counterpartyId,
        fan,
        winnerId: state.actorId,
      },
    };
  }

  return { state };
}

export function confirmDrawGame(state: EntryState): EntryTransition {
  if (state.type !== "draw_confirm") {
    return { state };
  }

  return {
    state,
    submitDraft: { action: "DRAW_GAME" },
  };
}
