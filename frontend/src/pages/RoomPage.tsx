import type {
  EntryEventType,
  EntryState,
  EntrySubmitDraft,
  KongType,
  RoomEvent,
  RoomPlayer,
  RoomState,
  ScoreFan,
  ScoreEventRequest,
} from "@mah-score/shared";
import type { ReactNode } from "react";

import { useEffect, useMemo, useState } from "react";
import {
  buildReplayEventsFromSnapshot,
  createPlayerLedger,
  createRoundLedgers,
  createScoreHistory,
  createSettlement,
  confirmDrawGame,
  getEntryActorId,
  getEntryCounterpartyId,
  getEntryFan,
  getEntryKongType,
  getEntryMode,
  getRoomOwnerPlayerId,
  getSelfDrawScoreFan,
  isSelectingFan,
  isWaitingForCounterparty,
  replayRoomEvents,
  selectEntryEvent,
  selectEntryFan,
  selectEntryPlayer,
} from "@mah-score/shared";
import {
  ArrowRightLeft,
  CircleSlash,
  Crosshair,
  EyeOff,
  Hand,
  Plus,
  Share2,
  Undo2,
  X,
} from "lucide-react";
import QRCode from "qrcode";

import {
  recordScoreEvent,
  recordRoomEvent,
  removePlayer,
  renamePlayer,
  startRoom,
  undoRoomEvent,
} from "../api/roomApi";
import { AvatarSelector } from "../components/AvatarSelector";
import { EntryStatus } from "../components/room/EntryStatus";
import { EventAction } from "../components/room/EventAction";
import { FanSelector } from "../components/room/FanSelector";
import { FinalSettlementPanel } from "../components/room/FinalSettlementPanel";
import { FinishRoomConfirmPanel } from "../components/room/FinishRoomConfirmPanel";
import { HistoryRoundsPanel } from "../components/room/HistoryRoundsPanel";
import { InvitePanel } from "../components/room/InvitePanel";
import { PlayerTile } from "../components/room/PlayerTile";
import { PlayerLedgerPanel } from "../components/room/PlayerLedgerPanel";
import { RecentEventRow } from "../components/room/RecentEventRow";
import { RecordRow } from "../components/room/RecordRow";
import { RoomManagementRow } from "../components/room/RoomManagementRow";
import { RoomDangerActions } from "../components/room/RoomDangerActions";
import { RoundDetailPanel } from "../components/room/RoundDetailPanel";
import { RoundSettlementPanel } from "../components/room/RoundSettlementPanel";
import { FinishedRoomView } from "../components/room/FinishedRoomView";
import { PlayingRoomView } from "../components/room/PlayingRoomView";
import { WaitingRoomView } from "../components/room/WaitingRoomView";
import { WaitingPlayerRow } from "../components/room/WaitingPlayerRow";
import { Button } from "../components/ui/Button";
import { Disclosure } from "../components/ui/Disclosure";
import { Notice } from "../components/ui/Notice";
import { Section } from "../components/ui/Section";
import { useRoomSync } from "../hooks/useRoomSync";
import { defaultAvatarId } from "../utils/avatars";
import {
  readPlayerIdentity,
  savePlayerIdentity,
  type StoredPlayerIdentity,
} from "../utils/playerIdentity";

interface RoomPageProps {
  readonly roomId: string;
}

type QuickScoreMode = "SELF_DRAW" | "DISCARD_WIN" | "KONG" | "DRAW_GAME";
type RoundViewMode = "round_active" | "round_settlement";

const fixedEventOptions: readonly {
  readonly emphasis?: "default" | "primary" | "muted";
  readonly eventType: EntryEventType;
  readonly icon: ReactNode;
  readonly kongType?: KongType;
  readonly label: string;
  readonly mode: QuickScoreMode;
}[] = [
  {
    eventType: "DISCARD_KONG",
    icon: <ArrowRightLeft className="h-4 w-4" />,
    kongType: "DISCARD_KONG",
    label: "直杠",
    mode: "KONG",
  },
  {
    eventType: "SUPPLEMENT_KONG",
    icon: <Plus className="h-4 w-4" />,
    kongType: "SUPPLEMENT_KONG",
    label: "补杠",
    mode: "KONG",
  },
  {
    eventType: "CONCEALED_KONG",
    icon: <EyeOff className="h-4 w-4" />,
    kongType: "CONCEALED_KONG",
    label: "暗杠",
    mode: "KONG",
  },
  {
    emphasis: "primary",
    eventType: "DISCARD_WIN",
    icon: <Crosshair className="h-5 w-5" />,
    label: "点炮",
    mode: "DISCARD_WIN",
  },
  {
    emphasis: "primary",
    eventType: "SELF_DRAW",
    icon: <Hand className="h-5 w-5" />,
    label: "自摸",
    mode: "SELF_DRAW",
  },
  {
    emphasis: "muted",
    eventType: "DRAW_GAME",
    icon: <CircleSlash className="h-4 w-4" />,
    label: "流局",
    mode: "DRAW_GAME",
  },
];

const scoreFans: readonly ScoreFan[] = [1, 2, 3, 4];

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.left = "-9999px";
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

function getPayloadString(payload: RoomEvent["payload"], key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPlayerNickname(players: readonly RoomPlayer[], playerId: string | undefined): string {
  if (playerId === undefined) {
    return "未知玩家";
  }

  return players.find((player) => player.id === playerId)?.nickname ?? "未知玩家";
}

function getScoreFlowLabel(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function formatScoreFlowSummary(
  flows: readonly { readonly nickname: string; readonly delta: number }[],
): string {
  if (flows.length === 0) {
    return "无分数变化";
  }

  return flows.map((flow) => `${flow.nickname} ${getScoreFlowLabel(flow.delta)}`).join("，");
}

function formatScoreHistorySummary(item: {
  readonly detail: string;
  readonly flows: readonly { readonly nickname: string; readonly delta: number }[];
}): string {
  return item.flows.length === 0 ? item.detail : formatScoreFlowSummary(item.flows);
}

function needsFan(mode: QuickScoreMode): boolean {
  return mode === "DISCARD_WIN" || mode === "SELF_DRAW";
}

function getRoundFinishWinnerCount(playerCount: number): number {
  return Math.max(playerCount - 1, 1);
}

function getChineseCountLabel(count: number): string {
  if (count === 1) {
    return "一";
  }

  if (count === 2) {
    return "两";
  }

  if (count === 3) {
    return "三";
  }

  return `${count}`;
}

function getRoundWinResultLabel(playerCount: number): string {
  return `${getChineseCountLabel(getRoundFinishWinnerCount(playerCount))}家胡牌`;
}

function createScoreRequestFromDraft(roomId: string, draft: EntrySubmitDraft): ScoreEventRequest {
  if (draft.action === "DRAW_GAME") {
    return {
      roomId,
      action: "DRAW_GAME",
      operator: "room",
    };
  }

  if (draft.action === "SELF_DRAW") {
    return {
      roomId,
      action: "SELF_DRAW",
      operator: "room",
      winnerId: draft.winnerId,
      fan: draft.fan,
    };
  }

  if (draft.action === "DISCARD_WIN") {
    return {
      roomId,
      action: "DISCARD_WIN",
      operator: "room",
      winnerId: draft.winnerId,
      discarderId: draft.discarderId,
      fan: draft.fan,
    };
  }

  if (draft.kongType === "DISCARD_KONG") {
    return {
      roomId,
      action: "KONG",
      operator: "room",
      playerId: draft.playerId,
      kongType: "DISCARD_KONG",
      fromPlayerId: draft.fromPlayerId,
    };
  }

  return {
    roomId,
    action: "KONG",
    operator: "room",
    playerId: draft.playerId,
    kongType: draft.kongType,
  };
}

export function RoomPage({ roomId }: RoomPageProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isScoring, setIsScoring] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [removePlayerTarget, setRemovePlayerTarget] = useState<
    { readonly playerId: string; readonly nickname: string } | undefined
  >();
  const [avatarInput, setAvatarInput] = useState(defaultAvatarId);
  const [drawFlowerPigPlayerIds, setDrawFlowerPigPlayerIds] = useState<readonly string[]>([]);
  const [drawNotReadyPlayerIds, setDrawNotReadyPlayerIds] = useState<readonly string[]>([]);
  const [drawReadyFans, setDrawReadyFans] = useState<Readonly<Record<string, ScoreFan>>>({});
  const [nicknameInput, setNicknameInput] = useState("");
  const [storedPlayerIdentity, setStoredPlayerIdentity] = useState<
    StoredPlayerIdentity | undefined
  >();
  const [shareMessage, setShareMessage] = useState<string | undefined>();
  const [settlementCopyMessage, setSettlementCopyMessage] = useState<string | undefined>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [entryState, setEntryState] = useState<EntryState>({ type: "idle" });
  const [expandedHistoryRoundNumbers, setExpandedHistoryRoundNumbers] = useState<readonly number[]>(
    [],
  );
  const [isPlayerLedgerExpanded, setIsPlayerLedgerExpanded] = useState(false);
  const { events, isLoading, loadRoom, room, roomVersion, syncStatus } = useRoomSync(
    roomId,
    setErrorMessage,
  );

  function resetDrawGameSettlement() {
    setDrawFlowerPigPlayerIds([]);
    setDrawNotReadyPlayerIds([]);
    setDrawReadyFans({});
  }

  function resetQuickScoreSelection() {
    setEntryState({ type: "idle" });
    resetDrawGameSettlement();
  }

  function togglePlayerId(playerIds: readonly string[], playerId: string): readonly string[] {
    return playerIds.includes(playerId)
      ? playerIds.filter((currentPlayerId) => currentPlayerId !== playerId)
      : [...playerIds, playerId];
  }

  function toggleHistoryRound(roundNumber: number) {
    setExpandedHistoryRoundNumbers((currentValue) =>
      currentValue.includes(roundNumber)
        ? currentValue.filter((item) => item !== roundNumber)
        : [...currentValue, roundNumber],
    );
  }

  const inviteUrl = new URL(`/?roomId=${roomId}`, window.location.origin).toString();

  useEffect(() => {
    setStoredPlayerIdentity(readPlayerIdentity(roomId));
  }, [roomId]);

  useEffect(() => {
    let isActive = true;

    void QRCode.toDataURL(inviteUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 192,
    })
      .then((dataUrl) => {
        if (isActive) {
          setQrCodeDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isActive) {
          setQrCodeDataUrl(undefined);
        }
      });

    return () => {
      isActive = false;
    };
  }, [inviteUrl]);

  async function handleRenamePlayer(playerId: string) {
    if (currentPlayer?.id !== playerId) {
      setErrorMessage("只能修改自己的昵称。");
      return;
    }

    setErrorMessage(undefined);

    try {
      const response = await renamePlayer({
        avatarId: avatarInput,
        roomId,
        playerId,
        nickname: nicknameInput,
        requesterPlayerId: currentPlayer.id,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      const nextPlayerIdentity = {
        avatarId: avatarInput,
        roomId,
        playerId,
        nickname: nicknameInput.trim(),
      };

      savePlayerIdentity(nextPlayerIdentity);
      setStoredPlayerIdentity(nextPlayerIdentity);
      setEditingPlayerId(undefined);
      setAvatarInput(defaultAvatarId);
      setNicknameInput("");
      await loadRoom();
    } catch {
      setErrorMessage("修改昵称失败，请稍后再试。");
    }
  }

  function openRemovePlayerConfirm(playerId: string, nickname: string) {
    if (currentPlayer?.id !== ownerPlayerId) {
      setErrorMessage("只有房主可以删除玩家。");
      return;
    }

    setErrorMessage(undefined);
    setRemovePlayerTarget({ playerId, nickname });
  }

  function cancelRemovePlayer() {
    setRemovePlayerTarget(undefined);
  }

  async function confirmRemovePlayer() {
    if (removePlayerTarget === undefined) {
      return;
    }

    const requesterPlayerId = currentPlayer?.id;

    if (requesterPlayerId === undefined || requesterPlayerId !== ownerPlayerId) {
      setErrorMessage("只有房主可以删除玩家。");
      return;
    }

    setErrorMessage(undefined);

    try {
      const response = await removePlayer({
        roomId,
        playerId: removePlayerTarget.playerId,
        requesterPlayerId,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      setRemovePlayerTarget(undefined);
      await loadRoom();
    } catch {
      setErrorMessage("删除玩家失败，请稍后再试。");
    }
  }

  async function handleStartRoom() {
    setIsStarting(true);
    setErrorMessage(undefined);

    try {
      const response = await startRoom({
        roomId,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      setEditingPlayerId(undefined);
      setNicknameInput("");
      await loadRoom();
    } catch {
      setErrorMessage("开始游戏失败，请稍后再试。");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCopyInviteLink() {
    setShareMessage(undefined);

    if (await copyTextToClipboard(inviteUrl)) {
      setShareMessage("房间链接已复制");
      return;
    }

    setShareMessage("复制失败，请手动复制链接");
  }

  async function handleShareInviteLink() {
    setShareMessage(undefined);

    if (!("share" in navigator)) {
      await handleCopyInviteLink();
      return;
    }

    try {
      await navigator.share({
        text: `加入 mah-score 房间 ${roomId}`,
        title: "mah-score 房间邀请",
        url: inviteUrl,
      });
      setShareMessage("已打开系统分享");
    } catch {
      setShareMessage("分享已取消");
    }
  }

  async function handleCopySettlementText(settlementText: string) {
    setSettlementCopyMessage(undefined);

    if (await copyTextToClipboard(settlementText)) {
      setSettlementCopyMessage("结算文本已复制");
      return;
    }

    setSettlementCopyMessage("复制失败，请手动复制结算文本");
  }

  function formatUndoTargetDescription(targetEventId?: string): string {
    const targetHistoryItem =
      targetEventId === undefined
        ? [...scoreHistory].find((item) => !item.isUndone)
        : scoreHistory.find((item) => item.event.id === targetEventId);

    if (targetHistoryItem === undefined) {
      return targetEventId === undefined ? "上一条计分记录" : "这条计分记录";
    }

    const targetPrefix = `第 ${targetHistoryItem.roundNumber} 局 · 第 ${targetHistoryItem.roundActionNumber} 笔`;

    if (targetHistoryItem.round.type === "DRAW_GAME") {
      return `${targetPrefix} · 流局`;
    }

    if (targetHistoryItem.round.type === "DISCARD_WIN") {
      const winnerName = getPlayerNickname(
        replayState?.players ?? [],
        getPayloadString(targetHistoryItem.event.payload, "winnerId"),
      );
      const discarderName = getPlayerNickname(
        replayState?.players ?? [],
        getPayloadString(targetHistoryItem.event.payload, "discarderId"),
      );

      return `${targetPrefix} · ${winnerName} 胡牌，${discarderName} 点炮`;
    }

    if (targetHistoryItem.round.type === "SELF_DRAW") {
      const winnerName = getPlayerNickname(
        replayState?.players ?? [],
        getPayloadString(targetHistoryItem.event.payload, "winnerId"),
      );

      return `${targetPrefix} · ${winnerName} 自摸`;
    }

    if (targetHistoryItem.round.type === "KONG") {
      const playerName = getPlayerNickname(
        replayState?.players ?? [],
        getPayloadString(targetHistoryItem.event.payload, "playerId"),
      );
      const kongType = getPayloadString(targetHistoryItem.event.payload, "kongType");

      if (kongType === "DISCARD_KONG") {
        const fromPlayerName = getPlayerNickname(
          replayState?.players ?? [],
          getPayloadString(targetHistoryItem.event.payload, "fromPlayerId"),
        );

        return `${targetPrefix} · ${playerName} 直杠，${fromPlayerName} 引杠`;
      }

      if (kongType === "SUPPLEMENT_KONG") {
        return `${targetPrefix} · ${playerName} 补杠`;
      }

      return `${targetPrefix} · ${playerName} 暗杠`;
    }

    return targetPrefix;
  }

  async function handleUndoRoomEvent(targetEventId?: string) {
    const shouldUndo = window.confirm(`确认撤销：${formatUndoTargetDescription(targetEventId)}？`);

    if (!shouldUndo) {
      return;
    }

    setIsUndoing(true);
    setErrorMessage(undefined);

    try {
      const response = await undoRoomEvent({
        roomId,
        operator: "room",
        targetEventId,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      await loadRoom();
    } catch {
      setErrorMessage("撤销失败，请稍后再试。");
    } finally {
      setIsUndoing(false);
    }
  }

  async function submitScoreRequest(scoreRequest: ScoreEventRequest) {
    setIsScoring(true);
    setErrorMessage(undefined);

    try {
      const response = await recordScoreEvent(scoreRequest);

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      await loadRoom();
    } catch {
      setErrorMessage("记录计分失败，请稍后再试。");
    } finally {
      setIsScoring(false);
    }
  }

  function canSelectScorePlayer(playerId: string): boolean {
    return (
      room?.status === "PLAYING" &&
      !isScoring &&
      !isCurrentRoundFinished &&
      !currentRoundWinnerIds.has(playerId)
    );
  }

  async function handleSelectPlayer(playerId: string) {
    if (
      entryState.type === "liuju_mode" ||
      (!isWaitingForCounterparty(entryState) && !canSelectScorePlayer(playerId))
    ) {
      return;
    }

    setErrorMessage(undefined);
    const transition = selectEntryPlayer(entryState, playerId, Array.from(currentRoundWinnerIds));
    await applyEntryTransition(transition.state, transition.submitDraft, transition.errorMessage);
  }

  async function applyEntryTransition(
    nextState: EntryState,
    submitDraft: EntrySubmitDraft | undefined,
    transitionErrorMessage?: string,
  ) {
    if (transitionErrorMessage !== undefined) {
      setErrorMessage(transitionErrorMessage);
      return;
    }

    setEntryState(nextState);

    if (submitDraft === undefined) {
      return;
    }

    await submitScoreRequest(createScoreRequestFromDraft(roomId, submitDraft));
  }

  async function handleSelectQuickScoreEvent(eventType: EntryEventType) {
    if (room?.status !== "PLAYING" || isScoring || isCurrentRoundFinished) {
      return;
    }

    setErrorMessage(undefined);

    const transition = selectEntryEvent(entryState, eventType);
    await applyEntryTransition(transition.state, transition.submitDraft, transition.errorMessage);
  }

  function handleToggleDrawFlowerPig(playerId: string) {
    setDrawFlowerPigPlayerIds((currentValue) => togglePlayerId(currentValue, playerId));
    setDrawNotReadyPlayerIds((currentValue) =>
      currentValue.filter((currentPlayerId) => currentPlayerId !== playerId),
    );
    setDrawReadyFans((currentValue) =>
      Object.fromEntries(
        Object.entries(currentValue).filter(([currentPlayerId]) => currentPlayerId !== playerId),
      ),
    );
  }

  function handleToggleDrawNotReady(playerId: string) {
    setDrawNotReadyPlayerIds((currentValue) => togglePlayerId(currentValue, playerId));
    setDrawReadyFans((currentValue) =>
      Object.fromEntries(
        Object.entries(currentValue).filter(([currentPlayerId]) => currentPlayerId !== playerId),
      ),
    );
  }

  function handleSelectDrawReadyFan(playerId: string, fan: ScoreFan) {
    setDrawNotReadyPlayerIds((currentValue) =>
      currentValue.filter((currentPlayerId) => currentPlayerId !== playerId),
    );
    setDrawReadyFans((currentValue) => ({
      ...currentValue,
      [playerId]: fan,
    }));
  }

  function getQuickScoreMissingMessage(): string {
    if (replayState?.currentRound.status === "FINISHED") {
      return "本局已结束，请先确认账单。";
    }

    if (entryState.type === "idle") {
      return "请选择玩家。";
    }

    if (entryState.type === "actor_selected") {
      return `已选择 ${getPlayerNickname(replayState?.players ?? [], entryState.actorId)}，请选择事件。`;
    }

    if (entryState.type === "selecting_fan" && entryState.eventType === "zimo") {
      return `${getPlayerNickname(replayState?.players ?? [], entryState.actorId)} 自摸，请选择番数。`;
    }

    if (entryState.type === "selecting_counterparty" && entryState.eventType === "dianpao") {
      return `${getPlayerNickname(replayState?.players ?? [], entryState.actorId)} 已胡牌，请选择点炮玩家。`;
    }

    if (entryState.type === "selecting_fan" && entryState.eventType === "dianpao") {
      return `${getPlayerNickname(
        replayState?.players ?? [],
        entryState.actorId,
      )} 胡牌，${getPlayerNickname(replayState?.players ?? [], entryState.counterpartyId)} 点炮，请选择番数。`;
    }

    if (entryState.type === "selecting_counterparty" && entryState.eventType === "zhigang") {
      return `${getPlayerNickname(replayState?.players ?? [], entryState.actorId)} 直杠，请选择引杠玩家。`;
    }

    return "";
  }

  function getQuickScoreStepMessage(): string {
    if (replayState?.currentRound.status === "FINISHED") {
      return "请先确认账单";
    }

    if (entryState.type === "idle") {
      return "请选择玩家";
    }

    if (entryState.type === "actor_selected") {
      return "请选择事件";
    }

    if (entryState.type === "selecting_fan") {
      return "请选择番数";
    }

    if (entryState.type === "selecting_counterparty" && entryState.eventType === "dianpao") {
      return "请选择点炮玩家";
    }

    if (entryState.type === "selecting_counterparty" && entryState.eventType === "zhigang") {
      return "请选择引杠玩家";
    }

    if (entryState.type === "liuju_mode") {
      return "请确认流局";
    }

    return "确认后记录本次事件";
  }

  function getQuickScoreSummary(): string | undefined {
    if (entryState.type === "liuju_mode") {
      return `确认第 ${currentRoundNumber} 局流局，确认后本局结束。`;
    }

    if (
      entryState.type === "selecting_fan" &&
      entryState.eventType === "zimo" &&
      entryState.fan !== undefined
    ) {
      return `${getPlayerNickname(
        replayState?.players ?? [],
        entryState.actorId,
      )} 自摸 · ${entryState.fan} 番，自摸加番后按 ${getSelfDrawScoreFan(entryState.fan)} 番结算`;
    }

    if (
      entryState.type === "selecting_fan" &&
      entryState.eventType === "dianpao" &&
      entryState.fan !== undefined
    ) {
      return `${getPlayerNickname(
        replayState?.players ?? [],
        entryState.actorId,
      )} 胡牌 · ${getPlayerNickname(
        replayState?.players ?? [],
        entryState.counterpartyId,
      )} 点炮 · ${entryState.fan} 番`;
    }

    if (
      entryState.type === "selecting_counterparty" &&
      entryState.eventType === "zhigang" &&
      entryState.counterpartyId !== undefined
    ) {
      return `${getPlayerNickname(
        replayState?.players ?? [],
        entryState.actorId,
      )} 直杠 · ${getPlayerNickname(replayState?.players ?? [], entryState.counterpartyId)} 引杠`;
    }

    return undefined;
  }

  async function handleSelectFan(fan: ScoreFan) {
    const transition = selectEntryFan(entryState, fan);
    await applyEntryTransition(transition.state, transition.submitDraft);
  }

  async function handleSubmitQuickScore() {
    const transition = confirmDrawGame(entryState);
    if (transition.submitDraft === undefined) {
      setErrorMessage(getQuickScoreMissingMessage());
      return;
    }

    const readyHands = Object.entries(drawReadyFans).map(([playerId, maxFan]) => ({
      playerId,
      maxFan,
    }));
    const kongTaxRefundPlayerIds = Array.from(
      new Set([...drawFlowerPigPlayerIds, ...drawNotReadyPlayerIds]),
    );

    setEntryState(transition.state);
    await submitScoreRequest({
      roomId,
      action: "DRAW_GAME",
      operator: "room",
      ...(drawFlowerPigPlayerIds.length === 0
        ? {}
        : { flowerPigPlayerIds: drawFlowerPigPlayerIds }),
      ...(drawNotReadyPlayerIds.length === 0 ? {} : { notReadyPlayerIds: drawNotReadyPlayerIds }),
      ...(readyHands.length === 0 ? {} : { readyHands }),
      ...(kongTaxRefundPlayerIds.length === 0 ? {} : { kongTaxRefundPlayerIds }),
    });
  }

  function openFinishConfirm() {
    setErrorMessage(undefined);
    setIsFinishConfirmOpen(true);
  }

  function cancelFinishRoom() {
    setIsFinishConfirmOpen(false);
  }

  async function confirmFinishRoom() {
    setIsFinishing(true);
    setErrorMessage(undefined);
    setIsFinishConfirmOpen(false);

    try {
      const response = await recordRoomEvent({
        roomId,
        type: "GAME_FINISHED",
        operator: "room",
        payload: {},
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      await loadRoom();
    } catch {
      setErrorMessage("结束游戏失败，请稍后再试。");
    } finally {
      setIsFinishing(false);
    }
  }

  function getFinishConfirmLines(): readonly string[] {
    const lines = [
      "确认结束游戏后：",
      "房间会进入已结束状态",
      "结束后不能继续计分",
      "会生成最终结算",
    ];

    if (
      replayState?.currentRound.status === "ACTIVE" &&
      currentRoundEntries.some((item) => !item.isUndone)
    ) {
      lines.push("当前局尚未流局");
      lines.push(`当前局尚未达到${getRoundWinResultLabel(replayState.players.length)}`);
      lines.push("当前局未确认账单");
    }

    return lines;
  }

  async function handleConfirmRound() {
    if (replayState?.currentRound.status !== "FINISHED" || isScoring || isFinishing) {
      return;
    }

    setIsScoring(true);
    setErrorMessage(undefined);

    try {
      const response = await recordRoomEvent({
        roomId,
        type: "ROUND_CONFIRMED",
        operator: "room",
        payload: {},
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      await loadRoom();
    } catch {
      setErrorMessage("确认本局失败，请稍后再试。");
    } finally {
      setIsScoring(false);
    }
  }

  const isWaiting = room?.status === "WAITING";
  const isPlaying = room?.status === "PLAYING";
  const isFinished = room?.status === "FINISHED";
  const canStart = isWaiting && room.players.length >= 2 && room.players.length <= 4;
  const replayState: RoomState | undefined = useMemo(
    () =>
      room === undefined
        ? undefined
        : replayRoomEvents(
            buildReplayEventsFromSnapshot(
              {
                roomId: room.roomId,
                players: room.players,
                status: room.status,
                createdAt: room.createdAt,
              },
              events,
            ),
          ),
    [events, room],
  );
  const currentRoundNumber = replayState?.currentRound.number ?? 0;
  const isCurrentRoundFinished = replayState?.currentRound.status === "FINISHED";
  const totalScoreByPlayerId = useMemo(
    () => new Map(replayState?.scores.map((score) => [score.playerId, score.total]) ?? []),
    [replayState],
  );
  const settlement = useMemo(
    () =>
      replayState === undefined
        ? undefined
        : createSettlement(
            replayState.roomId,
            replayState.players,
            replayState.scores,
            events,
            replayState.currentRound,
          ),
    [events, replayState],
  );

  const currentRoundWinnerIds = useMemo(
    () => new Set(replayState?.currentRound.winnerIds ?? []),
    [replayState],
  );
  const scoreHistory = useMemo(
    () => createScoreHistory(events, replayState?.players ?? []),
    [events, replayState],
  );
  const playerLedger = useMemo(
    () => createPlayerLedger(scoreHistory, replayState?.players ?? []),
    [replayState, scoreHistory],
  );
  const currentRoundEntries = useMemo(
    () =>
      replayState === undefined
        ? []
        : scoreHistory.filter((item) => item.roundNumber === replayState.currentRound.number),
    [replayState, scoreHistory],
  );
  const recentCurrentRoundEntries = currentRoundEntries.slice(0, 2);
  const currentRoundLedger = useMemo(
    () => createPlayerLedger(currentRoundEntries, replayState?.players ?? []),
    [currentRoundEntries, replayState],
  );
  const currentRoundTopScore = Math.max(...currentRoundLedger.map((player) => player.total), 0);
  const historyRoundLedgers = useMemo(
    () =>
      replayState === undefined
        ? []
        : createRoundLedgers(scoreHistory, replayState.players, replayState.currentRound.number),
    [replayState, scoreHistory],
  );
  const currentPlayer = useMemo(
    () =>
      storedPlayerIdentity === undefined
        ? undefined
        : replayState?.players.find((player) => player.id === storedPlayerIdentity.playerId),
    [replayState, storedPlayerIdentity],
  );
  const ownerPlayerId = useMemo(
    () =>
      replayState === undefined
        ? undefined
        : getRoomOwnerPlayerId(replayState.events, replayState.players),
    [replayState],
  );
  const isCurrentPlayerOwner = currentPlayer?.id === ownerPlayerId;
  const currentRoundSettlementPlayers = currentRoundLedger.map((player) => ({
    ...player,
    isCurrentPlayer: currentPlayer?.id === player.playerId,
    isTopPlayer: currentRoundTopScore > 0 && player.total === currentRoundTopScore,
  }));
  const drawGamePlayers =
    replayState?.players.filter((player) => !currentRoundWinnerIds.has(player.id)) ?? [];
  const roundViewMode: RoundViewMode = isCurrentRoundFinished ? "round_settlement" : "round_active";
  const canUndo = useMemo(() => scoreHistory.some((item) => !item.isUndone), [scoreHistory]);
  const quickScoreMissingMessage = getQuickScoreMissingMessage();
  const quickScoreStepMessage = getQuickScoreStepMessage();
  const quickScoreSummary = getQuickScoreSummary();
  const quickScoreMode = getEntryMode(entryState);
  const selectedKongType = getEntryKongType(entryState);
  const selectedPrimaryPlayerId = getEntryActorId(entryState);
  const selectedRelatedPlayerId = getEntryCounterpartyId(entryState);
  const selectedFan = getEntryFan(entryState);
  const expandedHistoryRoundNumberSet = useMemo(
    () => new Set(expandedHistoryRoundNumbers),
    [expandedHistoryRoundNumbers],
  );
  useEffect(() => {
    setExpandedHistoryRoundNumbers([]);
  }, [roomId, currentRoundNumber]);

  function renderCurrentRoundEntry(item: (typeof currentRoundEntries)[number]) {
    return (
      <RecordRow
        actionNumber={item.roundActionNumber}
        detail={item.detail}
        flows={item.flows}
        flowSummary={formatScoreHistorySummary(item)}
        isUndone={item.isUndone}
        isUndoDisabled={isUndoing || isScoring}
        key={item.event.id}
        onUndo={() => {
          void handleUndoRoomEvent(item.event.id);
        }}
        title={item.title}
      />
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-4 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col gap-3">
        {errorMessage !== undefined ? <Notice variant="danger">{errorMessage}</Notice> : null}
        {isLoading && room === undefined ? (
          <Section>
            <p className="text-base text-stone-600">读取中...</p>
          </Section>
        ) : null}

        {room !== undefined && isWaiting ? (
          <WaitingRoomView roomId={roomId}>
            <Section className="gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">{room.players.length} / 4</p>
                <p className="mt-1 text-sm text-stone-500">
                  {room.players.length < 2 ? "至少 2 名玩家才能开始游戏" : "可以开始游戏"}
                </p>
              </div>

              <div className="grid gap-2">
                {room.players.length === 0 ? (
                  <p className="rounded-md bg-stone-100 px-3 py-3 text-sm text-stone-600">
                    等待玩家加入
                  </p>
                ) : (
                  room.players.map((player) => (
                    <WaitingPlayerRow
                      isCurrentPlayer={currentPlayer?.id === player.id}
                      isOwner={ownerPlayerId === player.id}
                      key={player.id}
                      player={player}
                    />
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    void handleShareInviteLink();
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  分享邀请
                </Button>
                <Button
                  disabled={!canStart || isStarting}
                  onClick={() => {
                    void handleStartRoom();
                  }}
                  variant="primary"
                >
                  {isStarting ? "开始中..." : "开始游戏"}
                </Button>
              </div>
              {shareMessage !== undefined ? (
                <p className="text-sm font-medium text-stone-500">{shareMessage}</p>
              ) : null}
            </Section>

            <Disclosure summary="房间管理">
              <div className="grid gap-3">
                {room.players.map((player) =>
                  editingPlayerId === player.id ? (
                    <div className="grid gap-3 rounded-md bg-stone-50 p-3" key={player.id}>
                      <input
                        className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                        autoComplete="name"
                        id={`rename-nickname-${player.id}`}
                        maxLength={12}
                        name={`renameNickname-${player.id}`}
                        onChange={(event) => {
                          setNicknameInput(event.target.value);
                        }}
                        value={nicknameInput}
                      />
                      <AvatarSelector
                        onChange={(avatarId) => {
                          setAvatarInput(avatarId);
                        }}
                        value={avatarInput}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => {
                            void handleRenamePlayer(player.id);
                          }}
                          variant="primary"
                        >
                          保存
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingPlayerId(undefined);
                            setAvatarInput(defaultAvatarId);
                            setNicknameInput("");
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <RoomManagementRow
                      canRemove={isWaiting && isCurrentPlayerOwner}
                      canRename={currentPlayer?.id === player.id}
                      key={player.id}
                      onRemove={() => {
                        openRemovePlayerConfirm(player.id, player.nickname);
                      }}
                      onRename={() => {
                        setEditingPlayerId(player.id);
                        setAvatarInput(player.avatarId ?? defaultAvatarId);
                        setNicknameInput(player.nickname);
                      }}
                      player={player}
                    />
                  ),
                )}
              </div>
            </Disclosure>

            {removePlayerTarget !== undefined ? (
              <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">
                  确认删除玩家「{removePlayerTarget.nickname}」？
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button disabled={isStarting} onClick={cancelRemovePlayer}>
                    取消
                  </Button>
                  <Button
                    disabled={isStarting}
                    onClick={() => {
                      void confirmRemovePlayer();
                    }}
                    variant="danger"
                  >
                    确认删除
                  </Button>
                </div>
              </section>
            ) : null}
          </WaitingRoomView>
        ) : null}

        {room !== undefined && isPlaying ? (
          <PlayingRoomView
            currentPlayerId={currentPlayer?.id}
            onMoreClick={() => {
              document.getElementById("room-more-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            players={room.players}
            roomId={roomId}
            roundNumber={currentRoundNumber}
            scores={totalScoreByPlayerId}
            syncStatus={syncStatus}
            version={room.version ?? roomVersion}
          >
            {roundViewMode === "round_settlement" ? (
              <>
                <RoundSettlementPanel
                  isConfirmDisabled={isScoring || isFinishing}
                  isConfirming={isScoring}
                  onConfirm={() => {
                    void handleConfirmRound();
                  }}
                  players={currentRoundSettlementPlayers}
                  roundNumber={currentRoundNumber}
                />

                <Disclosure summary={`查看事件明细（${currentRoundEntries.length} 笔）`}>
                  <div className="grid gap-3">
                    {currentRoundEntries.length === 0 ? (
                      <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
                        暂无本局明细。
                      </p>
                    ) : (
                      <div>{currentRoundEntries.map((item) => renderCurrentRoundEntry(item))}</div>
                    )}

                    <Button
                      className="justify-self-start bg-transparent text-red-700 active:bg-red-50"
                      disabled={!canUndo || isUndoing || isScoring}
                      onClick={() => {
                        void handleUndoRoomEvent();
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      {isUndoing ? "撤销中..." : "撤销上一条"}
                    </Button>
                  </div>
                </Disclosure>
              </>
            ) : (
              <>
                <Section className="gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-1">
                      <h2 className="text-lg font-semibold tracking-normal">高频记录</h2>
                      <p
                        aria-live="polite"
                        className="min-w-0 truncate text-xs font-semibold text-emerald-800"
                      >
                        当前：{quickScoreStepMessage}
                      </p>
                    </div>
                    {entryState.type !== "idle" ? (
                      <Button
                        aria-label="取消当前录入"
                        className="h-9 w-9 shrink-0 px-0 text-stone-500"
                        disabled={isScoring}
                        onClick={resetQuickScoreSelection}
                        size="sm"
                        title="取消当前录入"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <p className="text-sm font-semibold text-stone-700">玩家</p>
                      <div className="grid grid-cols-2 gap-2">
                        {room.players.map((player) => {
                          const hasWon = currentRoundWinnerIds.has(player.id);
                          const isCounterpartyStep = isWaitingForCounterparty(entryState);
                          const isEntryLocked =
                            isSelectingFan(entryState) || entryState.type === "liuju_mode";
                          const isActor = selectedPrimaryPlayerId === player.id;
                          const isCounterparty = selectedRelatedPlayerId === player.id;
                          const disabled =
                            hasWon ||
                            isScoring ||
                            isEntryLocked ||
                            (isCounterpartyStep &&
                              (selectedPrimaryPlayerId === undefined || isActor));
                          const roleLabel = isCounterparty
                            ? quickScoreMode === "KONG"
                              ? "引杠玩家"
                              : "点炮玩家"
                            : isActor
                              ? quickScoreMode === "KONG"
                                ? "杠牌玩家"
                                : quickScoreMode === "DISCARD_WIN"
                                  ? "胡牌者"
                                  : quickScoreMode === "SELF_DRAW"
                                    ? "自摸玩家"
                                    : "已选玩家"
                              : undefined;
                          const visualState = hasWon
                            ? "disabled"
                            : isCounterparty
                              ? "counterparty"
                              : isActor
                                ? "actor"
                                : disabled
                                  ? "disabled"
                                  : "default";

                          return (
                            <PlayerTile
                              avatarId={player.avatarId}
                              disabled={disabled}
                              key={player.id}
                              nickname={player.nickname}
                              onClick={() => {
                                void handleSelectPlayer(player.id);
                              }}
                              roleLabel={roleLabel}
                              visualState={visualState}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <p className="text-sm font-semibold text-stone-700">事件</p>
                      <div className="grid grid-cols-3 gap-2">
                        {fixedEventOptions.map((option) => {
                          const isSelected =
                            quickScoreMode === option.mode &&
                            (option.mode !== "KONG" || selectedKongType === option.kongType);

                          return (
                            <EventAction
                              disabled={isScoring}
                              emphasis={option.emphasis}
                              icon={option.icon}
                              isSelected={isSelected}
                              key={`${option.mode}-${option.kongType ?? option.label}`}
                              onClick={() => {
                                void handleSelectQuickScoreEvent(option.eventType);
                              }}
                            >
                              {option.label}
                            </EventAction>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <p className="text-sm font-semibold text-stone-700">番数</p>
                      <FanSelector
                        disabled={
                          isScoring ||
                          !(
                            isSelectingFan(entryState) &&
                            quickScoreMode !== undefined &&
                            needsFan(quickScoreMode)
                          )
                        }
                        fans={scoreFans}
                        onSelectFan={(fan) => {
                          void handleSelectFan(fan);
                        }}
                        selectedFan={selectedFan}
                      />
                    </div>

                    {entryState.type === "liuju_mode" ? (
                      <div className="grid gap-3 rounded-md bg-stone-50 p-3">
                        <EntryStatus title="流局确认" variant="warning">
                          {quickScoreSummary ?? quickScoreMissingMessage}
                        </EntryStatus>
                        <div className="grid gap-2">
                          {drawGamePlayers.map((player) => {
                            const isFlowerPig = drawFlowerPigPlayerIds.includes(player.id);
                            const isNotReady = drawNotReadyPlayerIds.includes(player.id);
                            const readyFan = drawReadyFans[player.id];

                            return (
                              <div
                                className="grid gap-2 rounded-md bg-white px-3 py-3 ring-1 ring-stone-200"
                                key={player.id}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate text-sm font-semibold text-stone-900">
                                    {player.nickname}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      className={`h-8 rounded-md px-2 text-xs font-semibold ${
                                        isFlowerPig
                                          ? "bg-red-100 text-red-700"
                                          : "bg-stone-100 text-stone-600"
                                      }`}
                                      onClick={() => {
                                        handleToggleDrawFlowerPig(player.id);
                                      }}
                                      type="button"
                                    >
                                      花猪
                                    </button>
                                    <button
                                      className={`h-8 rounded-md px-2 text-xs font-semibold ${
                                        isNotReady
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-stone-100 text-stone-600"
                                      }`}
                                      disabled={isFlowerPig}
                                      onClick={() => {
                                        handleToggleDrawNotReady(player.id);
                                      }}
                                      type="button"
                                    >
                                      未叫
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {scoreFans.map((fan) => (
                                    <button
                                      className={`h-8 rounded-md text-xs font-semibold ${
                                        readyFan === fan
                                          ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                                          : "bg-stone-100 text-stone-500"
                                      }`}
                                      disabled={isFlowerPig || isNotReady}
                                      key={fan}
                                      onClick={() => {
                                        handleSelectDrawReadyFan(player.id, fan);
                                      }}
                                      type="button"
                                    >
                                      听 {fan} 番
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Button disabled={isScoring} onClick={resetQuickScoreSelection}>
                            取消
                          </Button>
                          <Button
                            disabled={isScoring || quickScoreSummary === undefined}
                            onClick={() => {
                              void handleSubmitQuickScore();
                            }}
                            variant="primary"
                          >
                            {isScoring ? "记录中..." : "确认流局"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Section>

                <Section>
                  <div>
                    <h2 className="text-base font-semibold tracking-normal">最近记录</h2>
                    <p className="mt-1 text-sm text-stone-500">最多显示最近两条。</p>
                  </div>

                  {recentCurrentRoundEntries.length === 0 ? (
                    <div className="rounded-md border border-dashed border-stone-200 px-3 py-3">
                      <p className="text-sm font-semibold text-stone-700">尚无本局记录</p>
                      <p className="mt-1 text-xs text-stone-500">
                        完成一次记分后会显示在这里。
                      </p>
                    </div>
                  ) : (
                    <div className="grid">
                      {recentCurrentRoundEntries.map((item, index) => (
                        <RecentEventRow
                          detail={item.detail}
                          flows={item.flows}
                          flowSummary={formatScoreHistorySummary(item)}
                          isLatest={index === 0}
                          isUndone={item.isUndone}
                          isUndoDisabled={isUndoing || isScoring}
                          key={item.event.id}
                          onUndo={() => {
                            void handleUndoRoomEvent(item.event.id);
                          }}
                          title={`${item.roundActionNumber}. ${item.title}`}
                        />
                      ))}
                    </div>
                  )}
                </Section>

                <Disclosure summary="本局详情">
                  <RoundDetailPanel
                    currentPlayerId={currentPlayer?.id}
                    entries={currentRoundEntries.map((item) => renderCurrentRoundEntry(item))}
                    players={currentRoundLedger}
                  />
                </Disclosure>
              </>
            )}

            <Disclosure
              className={
                roundViewMode === "round_settlement"
                  ? "bg-transparent p-1 shadow-none ring-0"
                  : undefined
              }
              id="room-more-section"
              summary="更多"
            >
              <div className="grid gap-4">
                <InvitePanel
                  inviteUrl={inviteUrl}
                  message={shareMessage}
                  onCopy={() => {
                    void handleCopyInviteLink();
                  }}
                  onShare={() => {
                    void handleShareInviteLink();
                  }}
                  qrCodeDataUrl={qrCodeDataUrl}
                  roomId={roomId}
                />

                <HistoryRoundsPanel
                  onToggleRound={toggleHistoryRound}
                  rounds={historyRoundLedgers.map((roundLedger) => ({
                    entries: roundLedger.entries.map((item) => renderCurrentRoundEntry(item)),
                    entryCount: roundLedger.entries.length,
                    isExpanded: expandedHistoryRoundNumberSet.has(roundLedger.roundNumber),
                    roundNumber: roundLedger.roundNumber,
                  }))}
                />

                <PlayerLedgerPanel
                  currentPlayerId={currentPlayer?.id}
                  isExpanded={isPlayerLedgerExpanded}
                  onToggle={() => {
                    setIsPlayerLedgerExpanded((currentValue) => !currentValue);
                  }}
                  players={playerLedger}
                />

                <RoomDangerActions
                  canUndo={canUndo}
                  isFinishing={isFinishing}
                  isScoring={isScoring}
                  isUndoing={isUndoing}
                  onFinish={openFinishConfirm}
                  onUndo={() => {
                    void handleUndoRoomEvent();
                  }}
                  showUndo={roundViewMode === "round_active"}
                />
              </div>
            </Disclosure>

            {isFinishConfirmOpen ? (
              <FinishRoomConfirmPanel
                isFinishing={isFinishing}
                lines={getFinishConfirmLines()}
                onCancel={cancelFinishRoom}
                onConfirm={() => {
                  void confirmFinishRoom();
                }}
              />
            ) : null}
          </PlayingRoomView>
        ) : null}

        {isFinished && settlement !== undefined ? (
          <FinishedRoomView roomId={roomId} totalRounds={settlement.totalRounds}>
            <FinalSettlementPanel
              copyMessage={settlementCopyMessage}
              onBackHome={() => {
                window.location.assign("/");
              }}
              onCopy={() => {
                void handleCopySettlementText(settlement.text);
              }}
              players={settlement.players}
            />
          </FinishedRoomView>
        ) : null}
      </section>
    </main>
  );
}
