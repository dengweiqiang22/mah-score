import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer } from "../types/room.js";
import type { RoundState } from "../types/roomState.js";

export interface HistoryFlowItem {
  readonly playerId: string;
  readonly nickname: string;
  readonly delta: number;
}

export interface ScoreHistoryItem {
  readonly event: RoomEvent;
  readonly round: RoundState;
  readonly roundNumber: number;
  readonly roundActionNumber: number;
  readonly title: string;
  readonly isUndone: boolean;
  readonly detail: string;
  readonly flows: readonly HistoryFlowItem[];
}

export interface PlayerLedgerEntry {
  readonly eventId: string;
  readonly version: number;
  readonly roundNumber: number;
  readonly title: string;
  readonly detail: string;
  readonly delta: number;
  readonly isUndone: boolean;
  readonly isUndoable: boolean;
}

export interface PlayerLedgerItem {
  readonly playerId: string;
  readonly nickname: string;
  readonly total: number;
  readonly income: number;
  readonly expense: number;
  readonly entries: readonly PlayerLedgerEntry[];
}

function getPayloadString(payload: RoomEvent["payload"], key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPayloadNumber(payload: RoomEvent["payload"], key: string): number | undefined {
  const value = payload[key];

  return typeof value === "number" ? value : undefined;
}

function getFanScore(fan: number | undefined): number {
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

function getPlayerNickname(players: readonly RoomPlayer[], playerId: string | undefined): string {
  if (playerId === undefined) {
    return "未知玩家";
  }

  return players.find((player) => player.id === playerId)?.nickname ?? "未知玩家";
}

function getKongTypeLabel(kongType: string | undefined): string {
  if (kongType === "DISCARD_KONG") {
    return "直杠";
  }

  if (kongType === "SUPPLEMENT_KONG") {
    return "补杠";
  }

  if (kongType === "CONCEALED_KONG") {
    return "暗杠";
  }

  return "杠牌";
}

function formatRoundTitle(round: RoundState, players: readonly RoomPlayer[]): string {
  if (round.type === "DISCARD_WIN") {
    const winnerName = getPlayerNickname(players, getPayloadString(round.payload, "winnerId"));

    return `${winnerName} 胡牌`;
  }

  if (round.type === "SELF_DRAW") {
    const winnerName = getPlayerNickname(players, getPayloadString(round.payload, "winnerId"));

    return `${winnerName} 自摸`;
  }

  if (round.type === "KONG") {
    const playerName = getPlayerNickname(players, getPayloadString(round.payload, "playerId"));
    const kongType = getPayloadString(round.payload, "kongType");

    return `${playerName} ${getKongTypeLabel(kongType)}`;
  }

  return "流局";
}

function formatRoundDetail(round: RoundState, players: readonly RoomPlayer[]): string {
  if (round.type === "DISCARD_WIN") {
    const discarderName = getPlayerNickname(
      players,
      getPayloadString(round.payload, "discarderId"),
    );
    const fan = getPayloadNumber(round.payload, "fan");
    const score = getFanScore(fan);

    return `${discarderName} 点炮 · ${fan ?? 1} 番 · +${score} / -${score}`;
  }

  if (round.type === "SELF_DRAW") {
    const fan = getPayloadNumber(round.payload, "fan");
    const score = getFanScore(fan);

    return `未胡玩家付分 · ${fan ?? 1} 番 · 每家 ${score}`;
  }

  if (round.type === "KONG") {
    const kongType = getPayloadString(round.payload, "kongType");

    if (kongType === "DISCARD_KONG") {
      const fromPlayerName = getPlayerNickname(
        players,
        getPayloadString(round.payload, "fromPlayerId"),
      );

      return `${fromPlayerName} 引杠 · +1 / -1`;
    }

    if (kongType === "CONCEALED_KONG") {
      return "未胡玩家各付 2 分";
    }

    return "未胡玩家各付 1 分";
  }

  return "本局不计分";
}

function createHistoryFlow(
  players: readonly RoomPlayer[],
  playerId: string | undefined,
  delta: number,
): HistoryFlowItem | undefined {
  if (playerId === undefined) {
    return undefined;
  }

  return {
    playerId,
    nickname: getPlayerNickname(players, playerId),
    delta,
  };
}

function getRoundActivePlayers(
  players: readonly RoomPlayer[],
  currentRoundWinnerIds: ReadonlySet<string>,
): readonly RoomPlayer[] {
  return players.filter((player) => !currentRoundWinnerIds.has(player.id));
}

function isScoreHistoryEvent(event: RoomEvent): boolean {
  return (
    event.type === "DISCARD_WIN" ||
    event.type === "SELF_DRAW" ||
    event.type === "KONG" ||
    event.type === "DRAW_GAME"
  );
}

function getPayloadStringValue(event: RoomEvent, key: string): string | undefined {
  return getPayloadString(event.payload, key);
}

function getPayloadNumberValue(event: RoomEvent, key: string): number | undefined {
  return getPayloadNumber(event.payload, key);
}

function getUndoTargetEventId(event: RoomEvent): string | undefined {
  return getPayloadStringValue(event, "targetEventId");
}

function createRoundFromEvent(event: RoomEvent): RoundState {
  return {
    eventId: event.id,
    type: event.type,
    version: event.version,
    payload: event.payload,
  };
}

function createScoreHistoryItem(
  event: RoomEvent,
  roundNumber: number,
  roundActionNumber: number,
  players: readonly RoomPlayer[],
  roundWinnerIds: ReadonlySet<string>,
  isUndone: boolean,
): ScoreHistoryItem {
  const round = createRoundFromEvent(event);
  const title = formatRoundTitle(round, players);

  if (event.type === "DISCARD_WIN") {
    const winnerId = getPayloadStringValue(event, "winnerId");
    const discarderId = getPayloadStringValue(event, "discarderId");
    const fan = getPayloadNumberValue(event, "fan");
    const score = getFanScore(fan);

    return {
      event,
      round,
      roundNumber,
      roundActionNumber,
      title,
      isUndone,
      detail: formatRoundDetail(round, players),
      flows: [
        createHistoryFlow(players, winnerId, score),
        createHistoryFlow(players, discarderId, -score),
      ].filter((item): item is HistoryFlowItem => item !== undefined),
    };
  }

  if (event.type === "SELF_DRAW") {
    const winnerId = getPayloadStringValue(event, "winnerId");
    const fan = getPayloadNumberValue(event, "fan");
    const score = getFanScore(fan);
    const activePlayers = getRoundActivePlayers(players, roundWinnerIds);

    return {
      event,
      round,
      roundNumber,
      roundActionNumber,
      title,
      isUndone,
      detail: formatRoundDetail(round, players),
      flows: activePlayers
        .map((player) =>
          createHistoryFlow(
            players,
            player.id,
            player.id === winnerId ? score * (activePlayers.length - 1) : -score,
          ),
        )
        .filter((item): item is HistoryFlowItem => item !== undefined),
    };
  }

  if (event.type === "KONG") {
    const playerId = getPayloadStringValue(event, "playerId");
    const kongType = getPayloadStringValue(event, "kongType");
    const fromPlayerId = getPayloadStringValue(event, "fromPlayerId");
    const activePlayers = getRoundActivePlayers(players, roundWinnerIds);

    if (kongType === "DISCARD_KONG") {
      return {
        event,
        round,
        roundNumber,
        roundActionNumber,
        title,
        isUndone,
        detail: formatRoundDetail(round, players),
        flows: [
          createHistoryFlow(players, playerId, 1),
          createHistoryFlow(players, fromPlayerId, -1),
        ].filter((item): item is HistoryFlowItem => item !== undefined),
      };
    }

    const payerScore = kongType === "CONCEALED_KONG" ? 2 : 1;

    return {
      event,
      round,
      roundNumber,
      roundActionNumber,
      title,
      isUndone,
      detail: formatRoundDetail(round, players),
      flows: activePlayers
        .map((player) =>
          createHistoryFlow(
            players,
            player.id,
            player.id === playerId ? payerScore * (activePlayers.length - 1) : -payerScore,
          ),
        )
        .filter((item): item is HistoryFlowItem => item !== undefined),
    };
  }

  return {
    event,
    round,
    roundNumber,
    roundActionNumber,
    title,
    isUndone,
    detail: formatRoundDetail(round, players),
    flows: [],
  };
}

export function createScoreHistory(
  events: readonly RoomEvent[],
  players: readonly RoomPlayer[],
): readonly ScoreHistoryItem[] {
  const undoneEventIds = new Set(
    events.flatMap((event) => {
      if (event.type !== "UNDO") {
        return [];
      }

      const targetEventId = getUndoTargetEventId(event);

      return targetEventId === undefined ? [] : [targetEventId];
    }),
  );
  const winnerIds = new Set<string>();
  let roundNumber = 1;
  let roundActionNumber = 0;

  return [...events]
    .sort((left, right) => left.version - right.version)
    .flatMap((event) => {
      if (event.type === "ROUND_CONFIRMED") {
        roundNumber += 1;
        roundActionNumber = 0;
        winnerIds.clear();
        return [];
      }

      if (!isScoreHistoryEvent(event)) {
        return [];
      }

      roundActionNumber += 1;

      const historyItem = createScoreHistoryItem(
        event,
        roundNumber,
        roundActionNumber,
        players,
        new Set(winnerIds),
        undoneEventIds.has(event.id),
      );

      if (!historyItem.isUndone) {
        if (event.type === "DISCARD_WIN" || event.type === "SELF_DRAW") {
          const winnerId = getPayloadStringValue(event, "winnerId");

          if (winnerId !== undefined && !winnerIds.has(winnerId)) {
            winnerIds.add(winnerId);
          }
        }

        if (event.type === "DRAW_GAME") {
          winnerIds.clear();
        }
      }

      return [historyItem];
    })
    .sort((left, right) => right.event.version - left.event.version);
}

export function createPlayerLedger(
  scoreHistory: readonly ScoreHistoryItem[],
  players: readonly RoomPlayer[],
): readonly PlayerLedgerItem[] {
  const ledgerMap = new Map<string, PlayerLedgerItem>();

  for (const player of players) {
    ledgerMap.set(player.id, {
      playerId: player.id,
      nickname: player.nickname,
      total: 0,
      income: 0,
      expense: 0,
      entries: [],
    });
  }

  for (const item of scoreHistory) {
    for (const flow of item.flows) {
      const currentLedger = ledgerMap.get(flow.playerId);

      if (currentLedger === undefined) {
        continue;
      }

      const nextEntry: PlayerLedgerEntry = {
        eventId: item.event.id,
        version: item.event.version,
        roundNumber: item.roundNumber,
        title: item.title,
        detail: item.detail,
        delta: flow.delta,
        isUndone: item.isUndone,
        isUndoable: !item.isUndone && flow.delta > 0,
      };

      ledgerMap.set(flow.playerId, {
        ...currentLedger,
        total: item.isUndone ? currentLedger.total : currentLedger.total + flow.delta,
        income: item.isUndone
          ? currentLedger.income
          : currentLedger.income + (flow.delta > 0 ? flow.delta : 0),
        expense: item.isUndone
          ? currentLedger.expense
          : currentLedger.expense + (flow.delta < 0 ? -flow.delta : 0),
        entries: [...currentLedger.entries, nextEntry],
      });
    }
  }

  return players.map((player) => ledgerMap.get(player.id)).filter((item): item is PlayerLedgerItem => item !== undefined);
}
