import type { KongType, ScoreFan } from "../types/score.js";

export type EntryEventType =
  | "DISCARD_KONG"
  | "SUPPLEMENT_KONG"
  | "CONCEALED_KONG"
  | "DISCARD_WIN"
  | "SELF_DRAW"
  | "DRAW_GAME";

type CounterpartyEventType = "dianpao" | "zhigang";

export type EntryState =
  | { readonly type: "idle" }
  | { readonly actorId: string; readonly type: "actor_selected" }
  | {
      readonly actorId: string;
      readonly counterpartyId?: string;
      readonly eventType: CounterpartyEventType;
      readonly type: "selecting_counterparty";
    }
  | {
      readonly actorId: string;
      readonly eventType: "zimo";
      readonly fan?: ScoreFan;
      readonly type: "selecting_fan";
    }
  | {
      readonly actorId: string;
      readonly counterpartyId: string;
      readonly eventType: "dianpao";
      readonly fan?: ScoreFan;
      readonly type: "selecting_fan";
    }
  | { readonly type: "liuju_mode" };

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
  if (state.type === "idle" || state.type === "liuju_mode") {
    return undefined;
  }

  return state.actorId;
}

export function getEntryCounterpartyId(state: EntryState): string | undefined {
  if ("counterpartyId" in state) {
    return state.counterpartyId;
  }

  return undefined;
}

export function getEntryFan(state: EntryState): ScoreFan | undefined {
  if (state.type === "selecting_fan") {
    return state.fan;
  }

  return undefined;
}

export function getEntryKongType(state: EntryState): KongType | undefined {
  if (state.type === "selecting_counterparty" && state.eventType === "zhigang") {
    return "DISCARD_KONG";
  }

  return undefined;
}

export function getEntryMode(state: EntryState): "SELF_DRAW" | "DISCARD_WIN" | "KONG" | "DRAW_GAME" | undefined {
  if (state.type === "idle" || state.type === "actor_selected") {
    return undefined;
  }

  if (state.type === "liuju_mode") {
    return "DRAW_GAME";
  }

  if (state.type === "selecting_fan" && state.eventType === "zimo") {
    return "SELF_DRAW";
  }

  if (
    (state.type === "selecting_counterparty" && state.eventType === "dianpao") ||
    (state.type === "selecting_fan" && state.eventType === "dianpao")
  ) {
    return "DISCARD_WIN";
  }

  return "KONG";
}

export function isWaitingForCounterparty(state: EntryState): boolean {
  return state.type === "selecting_counterparty";
}

export function isSelectingFan(state: EntryState): boolean {
  return state.type === "selecting_fan";
}

function isBlockedPlayer(playerId: string, blockedPlayerIds: readonly string[]): boolean {
  return blockedPlayerIds.includes(playerId);
}

export function selectEntryPlayer(
  state: EntryState,
  playerId: string,
  blockedPlayerIds: readonly string[],
): EntryTransition {
  if (state.type === "liuju_mode" || state.type === "selecting_fan" || isBlockedPlayer(playerId, blockedPlayerIds)) {
    return { state };
  }

  if (state.type === "selecting_counterparty" && state.eventType === "zhigang") {
    if (state.actorId === playerId) {
      return { errorMessage: "引杠玩家不能和杠牌玩家相同。", state };
    }

    return {
      state: {
        actorId: state.actorId,
        counterpartyId: playerId,
        eventType: "zhigang",
        type: "selecting_counterparty",
      },
      submitDraft: {
        action: "KONG",
        fromPlayerId: playerId,
        kongType: "DISCARD_KONG",
        playerId: state.actorId,
      },
    };
  }

  if (state.type === "selecting_counterparty" && state.eventType === "dianpao") {
    if (state.actorId === playerId) {
      return { errorMessage: "点炮玩家不能和胡牌玩家相同。", state };
    }

    return {
      state: {
        actorId: state.actorId,
        counterpartyId: playerId,
        eventType: "dianpao",
        type: "selecting_fan",
      },
    };
  }

  return {
    state: getEntryActorId(state) === playerId ? { type: "idle" } : { actorId: playerId, type: "actor_selected" },
  };
}

export function selectEntryEvent(state: EntryState, eventType: EntryEventType): EntryTransition {
  if (eventType === "DRAW_GAME") {
    return { state: { type: "liuju_mode" } };
  }

  const actorId = getEntryActorId(state);

  if (actorId === undefined) {
    return { errorMessage: "请先选择玩家。", state };
  }

  if (eventType === "SELF_DRAW") {
    return { state: { actorId, eventType: "zimo", type: "selecting_fan" } };
  }

  if (eventType === "DISCARD_WIN") {
    return { state: { actorId, eventType: "dianpao", type: "selecting_counterparty" } };
  }

  if (eventType === "DISCARD_KONG") {
    return { state: { actorId, eventType: "zhigang", type: "selecting_counterparty" } };
  }

  return {
    state: { actorId, type: "actor_selected" },
    submitDraft: {
      action: "KONG",
      kongType: eventType,
      playerId: actorId,
    },
  };
}

export function selectEntryFan(state: EntryState, fan: ScoreFan): EntryTransition {
  if (state.type === "selecting_fan" && state.eventType === "zimo") {
    return {
      state: { actorId: state.actorId, eventType: "zimo", fan, type: "selecting_fan" },
      submitDraft: {
        action: "SELF_DRAW",
        fan,
        winnerId: state.actorId,
      },
    };
  }

  if (state.type === "selecting_fan" && state.eventType === "dianpao") {
    return {
      state: {
        actorId: state.actorId,
        counterpartyId: state.counterpartyId,
        eventType: "dianpao",
        fan,
        type: "selecting_fan",
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
  if (state.type !== "liuju_mode") {
    return { state };
  }

  return {
    state,
    submitDraft: { action: "DRAW_GAME" },
  };
}
