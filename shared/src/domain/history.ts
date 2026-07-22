import type { RoomEvent } from "../types/event.js";
import type { RoomPlayer } from "../types/room.js";
import type { RoundState } from "../types/roomState.js";

import {
  createDrawGameKongTaxRefundDetails,
  createDrawGameSettlementFlows,
  getDrawGameSettlementPayload,
} from "./drawGameSettlement.js";
import { getFanScore, getSelfDrawScoreFan } from "./roomRules.js";

export interface HistoryFlowItem {
  readonly playerId: string;
  readonly nickname: string;
  readonly delta: number;
}

export interface HistoryTaxRefundDetail {
  readonly delta: number;
  readonly label: string;
}

export interface HistoryTaxRefundItem {
  readonly details: readonly HistoryTaxRefundDetail[];
  readonly nickname: string;
  readonly playerId: string;
}

export interface ScoreHistoryItem {
  readonly event: RoomEvent;
  readonly round: RoundState;
  readonly roundNumber: number;
  readonly roundActionNumber: number;
  readonly title: string;
  readonly isUndone: boolean;
  readonly detail: string;
  readonly displayFlows?: readonly HistoryFlowItem[];
  readonly flows: readonly HistoryFlowItem[];
  readonly taxRefunds?: readonly HistoryTaxRefundItem[];
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

export interface RoundLedgerItem {
  readonly roundNumber: number;
  readonly entries: readonly ScoreHistoryItem[];
  readonly ledger: readonly PlayerLedgerItem[];
}

function getPayloadString(payload: RoomEvent["payload"], key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPayloadNumber(payload: RoomEvent["payload"], key: string): number | undefined {
  const value = payload[key];

  return typeof value === "number" ? value : undefined;
}

function getFanLabel(fan: number | undefined): string {
  if (fan === 2) {
    return "二番";
  }

  if (fan === 3) {
    return "三番";
  }

  if (fan === 4) {
    return "四番";
  }

  return "一番";
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

function createHistoryTaxRefunds(
  players: readonly RoomPlayer[],
  currentRoundEvents: readonly RoomEvent[],
  refundPlayerIds: readonly string[],
): readonly HistoryTaxRefundItem[] {
  const details = createDrawGameKongTaxRefundDetails(
    players,
    currentRoundEvents,
    new Set(refundPlayerIds),
  );
  const detailsByPlayerId = new Map<string, HistoryTaxRefundDetail[]>();

  for (const detail of details) {
    const playerDetails = detailsByPlayerId.get(detail.playerId) ?? [];

    detailsByPlayerId.set(detail.playerId, [
      ...playerDetails,
      {
        delta: detail.delta,
        label: getKongTypeLabel(detail.kongType),
      },
    ]);
  }

  return [...detailsByPlayerId.entries()].map(([playerId, playerDetails]) => ({
    details: playerDetails,
    nickname: getPlayerNickname(players, playerId),
    playerId,
  }));
}

function formatRoundTitle(round: RoundState, players: readonly RoomPlayer[]): string {
  if (round.type === "DISCARD_WIN") {
    const winnerName = getPlayerNickname(players, getPayloadString(round.payload, "winnerId"));
    const discarderName = getPlayerNickname(
      players,
      getPayloadString(round.payload, "discarderId"),
    );
    const fan = getPayloadNumber(round.payload, "fan");

    return `${winnerName} · 点炮 · ${discarderName} · ${getFanLabel(fan)}`;
  }

  if (round.type === "SELF_DRAW") {
    const winnerName = getPlayerNickname(players, getPayloadString(round.payload, "winnerId"));
    const fan = getSelfDrawScoreFan(getPayloadNumber(round.payload, "fan"));

    return `${winnerName} · 自摸 · ${getFanLabel(fan)}`;
  }

  if (round.type === "KONG") {
    const playerName = getPlayerNickname(players, getPayloadString(round.payload, "playerId"));
    const kongType = getPayloadString(round.payload, "kongType");

    if (kongType === "DISCARD_KONG") {
      const fromPlayerName = getPlayerNickname(
        players,
        getPayloadString(round.payload, "fromPlayerId"),
      );

      return `${playerName} · 直杠 · ${fromPlayerName}`;
    }

    return `${playerName} · ${getKongTypeLabel(kongType)}`;
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
    const effectiveFan = getSelfDrawScoreFan(fan);
    const score = getFanScore(effectiveFan);

    return `未胡玩家付分 · ${effectiveFan} 番 · 每家 ${score}`;
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

function sortIncomeFlowsFirst(flows: readonly HistoryFlowItem[]): readonly HistoryFlowItem[] {
  return [...flows].sort((left, right) => {
    if (left.delta > 0 && right.delta <= 0) {
      return -1;
    }

    if (left.delta <= 0 && right.delta > 0) {
      return 1;
    }

    return 0;
  });
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
  currentRoundEvents: readonly RoomEvent[],
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
    const score = getFanScore(getSelfDrawScoreFan(fan));
    const activePlayers = getRoundActivePlayers(players, roundWinnerIds);

    return {
      event,
      round,
      roundNumber,
      roundActionNumber,
      title,
      isUndone,
      detail: formatRoundDetail(round, players),
      flows: sortIncomeFlowsFirst(
        activePlayers
          .map((player) =>
            createHistoryFlow(
              players,
              player.id,
              player.id === winnerId ? score * (activePlayers.length - 1) : -score,
            ),
          )
          .filter((item): item is HistoryFlowItem => item !== undefined),
      ),
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
      flows: sortIncomeFlowsFirst(
        activePlayers
          .map((player) =>
            createHistoryFlow(
              players,
              player.id,
              player.id === playerId ? payerScore * (activePlayers.length - 1) : -payerScore,
            ),
          )
          .filter((item): item is HistoryFlowItem => item !== undefined),
      ),
    };
  }

  if (event.type === "DRAW_GAME") {
    const settlementPayload = getDrawGameSettlementPayload(event.payload);
    const flows = createDrawGameSettlementFlows(
      players,
      roundWinnerIds,
      currentRoundEvents,
      settlementPayload,
    );
    const displayFlows = createDrawGameSettlementFlows(
      players,
      roundWinnerIds,
      currentRoundEvents,
      settlementPayload,
      { includeKongTaxRefund: false },
    ).map((flow) => ({
      ...flow,
      nickname: getPlayerNickname(players, flow.playerId),
    }));

    return {
      event,
      round,
      roundNumber,
      roundActionNumber,
      title,
      isUndone,
      detail:
        flows.length === 0
          ? `第 ${roundNumber} 局结束，无分数变化`
          : `第 ${roundNumber} 局流局结算`,
      flows: flows.map((flow) => ({
        ...flow,
        nickname: getPlayerNickname(players, flow.playerId),
      })),
      displayFlows,
      taxRefunds: createHistoryTaxRefunds(
        players,
        currentRoundEvents,
        settlementPayload.kongTaxRefundPlayerIds,
      ),
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
  let currentRoundEvents: RoomEvent[] = [];
  let roundNumber = 1;
  let roundActionNumber = 0;

  return [...events]
    .sort((left, right) => left.version - right.version)
    .flatMap((event) => {
      if (event.type === "ROUND_CONFIRMED") {
        roundNumber += 1;
        roundActionNumber = 0;
        winnerIds.clear();
        currentRoundEvents = [];
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
        currentRoundEvents,
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

      if (!historyItem.isUndone) {
        currentRoundEvents = [...currentRoundEvents, event];
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

export function createRoundLedgers(
  scoreHistory: readonly ScoreHistoryItem[],
  players: readonly RoomPlayer[],
  currentRoundNumber: number,
): readonly RoundLedgerItem[] {
  const roundNumbers = Array.from(
    new Set(
      scoreHistory
        .filter((item) => item.roundNumber < currentRoundNumber)
        .map((item) => item.roundNumber),
    ),
  ).sort((left, right) => right - left);

  return roundNumbers.map((roundNumber) => {
    const entries = scoreHistory.filter((item) => item.roundNumber === roundNumber);

    return {
      roundNumber,
      entries,
      ledger: createPlayerLedger(entries, players),
    };
  });
}
