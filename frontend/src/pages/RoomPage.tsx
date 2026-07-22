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
  isSelectingFan,
  isWaitingForCounterparty,
  replayRoomEvents,
  selectEntryEvent,
  selectEntryFan,
  selectEntryPlayer,
} from "@mah-score/shared";
import { ArrowRightLeft, Crosshair, Layers3, Plus, RotateCcw, Share2, Sparkles, Undo2 } from "lucide-react";
import QRCode from "qrcode";

import {
  recordScoreEvent,
  recordRoomEvent,
  removePlayer,
  renamePlayer,
  startRoom,
  undoRoomEvent,
} from "../api/roomApi";
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
import { RoomDangerActions } from "../components/room/RoomDangerActions";
import { RoundDetailPanel } from "../components/room/RoundDetailPanel";
import { RoundSettlementPanel } from "../components/room/RoundSettlementPanel";
import { ScoreValue } from "../components/room/ScoreValue";
import { FinishedRoomView } from "../components/room/FinishedRoomView";
import { PlayingRoomView } from "../components/room/PlayingRoomView";
import { WaitingRoomView } from "../components/room/WaitingRoomView";
import { Button } from "../components/ui/Button";
import { Disclosure } from "../components/ui/Disclosure";
import { Notice } from "../components/ui/Notice";
import { Section } from "../components/ui/Section";
import { useRoomSync } from "../hooks/useRoomSync";
import { readPlayerIdentity, type StoredPlayerIdentity } from "../utils/playerIdentity";

interface RoomPageProps {
  readonly roomId: string;
}

type QuickScoreMode = "SELF_DRAW" | "DISCARD_WIN" | "KONG" | "DRAW_GAME";
type RoundViewMode = "round_active" | "round_settlement";

const fixedEventOptions: readonly {
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
    icon: <Layers3 className="h-4 w-4" />,
    kongType: "CONCEALED_KONG",
    label: "暗杠",
    mode: "KONG",
  },
  {
    eventType: "DISCARD_WIN",
    icon: <Crosshair className="h-4 w-4" />,
    label: "点炮",
    mode: "DISCARD_WIN",
  },
  {
    eventType: "SELF_DRAW",
    icon: <Sparkles className="h-4 w-4" />,
    label: "自摸",
    mode: "SELF_DRAW",
  },
  {
    eventType: "DRAW_GAME",
    icon: <RotateCcw className="h-4 w-4" />,
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

function needsFan(mode: QuickScoreMode): boolean {
  return mode === "DISCARD_WIN" || mode === "SELF_DRAW";
}

function getKongTypeLabel(kongType: KongType | undefined): string {
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
  const [nicknameInput, setNicknameInput] = useState("");
  const [storedPlayerIdentity, setStoredPlayerIdentity] = useState<
    StoredPlayerIdentity | undefined
  >();
  const [shareMessage, setShareMessage] = useState<string | undefined>();
  const [settlementCopyMessage, setSettlementCopyMessage] = useState<string | undefined>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [entryState, setEntryState] = useState<EntryState>({ type: "idle" });
  const [scoreFeedbackMessage, setScoreFeedbackMessage] = useState<string | undefined>();
  const [expandedHistoryRoundNumbers, setExpandedHistoryRoundNumbers] = useState<readonly number[]>(
    [],
  );
  const [isPlayerLedgerExpanded, setIsPlayerLedgerExpanded] = useState(false);
  const { events, isLoading, loadRoom, room, roomVersion, syncStatus } = useRoomSync(
    roomId,
    setErrorMessage,
  );

  function resetQuickScoreSelection() {
    setEntryState({ type: "idle" });
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
    setErrorMessage(undefined);

    try {
      const response = await renamePlayer({
        roomId,
        playerId,
        nickname: nicknameInput,
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
      setErrorMessage("修改昵称失败，请稍后再试。");
    }
  }

  function openRemovePlayerConfirm(playerId: string, nickname: string) {
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

    setErrorMessage(undefined);

    try {
      const response = await removePlayer({
        roomId,
        playerId: removePlayerTarget.playerId,
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

  async function submitScoreRequest(scoreRequest: ScoreEventRequest, feedbackSummary = "已记录") {
    setIsScoring(true);
    setErrorMessage(undefined);
    setScoreFeedbackMessage(undefined);

    try {
      const response = await recordScoreEvent(scoreRequest);

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
      setScoreFeedbackMessage(`已记录：${feedbackSummary}`);
      await loadRoom();
    } catch {
      setErrorMessage("记录计分失败，请稍后再试。");
    } finally {
      setIsScoring(false);
    }
  }

  useEffect(() => {
    if (scoreFeedbackMessage === undefined) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setScoreFeedbackMessage(undefined);
    }, 2000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [scoreFeedbackMessage]);

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
    const feedbackSummary =
      transition.submitDraft?.action === "KONG" &&
      transition.submitDraft.kongType === "DISCARD_KONG"
        ? `${getPlayerNickname(
            replayState?.players ?? [],
            transition.submitDraft.playerId,
          )} 直杠 · ${getPlayerNickname(replayState?.players ?? [], transition.submitDraft.fromPlayerId)} 引杠`
        : undefined;

    await applyEntryTransition(
      transition.state,
      transition.submitDraft,
      feedbackSummary,
      transition.errorMessage,
    );
  }

  async function applyEntryTransition(
    nextState: EntryState,
    submitDraft: EntrySubmitDraft | undefined,
    feedbackSummary: string | undefined,
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

    await submitScoreRequest(createScoreRequestFromDraft(roomId, submitDraft), feedbackSummary);
  }

  async function handleSelectQuickScoreEvent(eventType: EntryEventType) {
    if (room?.status !== "PLAYING" || isScoring || isCurrentRoundFinished) {
      return;
    }

    setErrorMessage(undefined);
    setScoreFeedbackMessage(undefined);

    const transition = selectEntryEvent(entryState, eventType);
    const feedbackSummary =
      transition.submitDraft?.action === "KONG" &&
      transition.submitDraft.kongType !== "DISCARD_KONG"
        ? `${getPlayerNickname(
            replayState?.players ?? [],
            transition.submitDraft.playerId,
          )} ${getKongTypeLabel(transition.submitDraft.kongType)}`
        : undefined;

    await applyEntryTransition(
      transition.state,
      transition.submitDraft,
      feedbackSummary,
      transition.errorMessage,
    );
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

  function getQuickScoreSummary(): string | undefined {
    if (entryState.type === "liuju_mode") {
      return `确认第 ${currentRoundNumber} 局流局，确认后本局结束。`;
    }

    if (
      entryState.type === "selecting_fan" &&
      entryState.eventType === "zimo" &&
      entryState.fan !== undefined
    ) {
      return `${getPlayerNickname(replayState?.players ?? [], entryState.actorId)} 自摸 · ${entryState.fan} 番`;
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
    const feedbackSummary =
      transition.submitDraft?.action === "SELF_DRAW"
        ? `${getPlayerNickname(replayState?.players ?? [], transition.submitDraft.winnerId)} 自摸 · ${fan} 番`
        : transition.submitDraft?.action === "DISCARD_WIN"
          ? `${getPlayerNickname(
              replayState?.players ?? [],
              transition.submitDraft.winnerId,
            )} 胡牌 · ${getPlayerNickname(
              replayState?.players ?? [],
              transition.submitDraft.discarderId,
            )} 点炮 · ${fan} 番`
          : undefined;

    await applyEntryTransition(transition.state, transition.submitDraft, feedbackSummary);
  }

  async function handleSubmitQuickScore() {
    const transition = confirmDrawGame(entryState);
    if (transition.submitDraft === undefined) {
      setErrorMessage(getQuickScoreMissingMessage());
      return;
    }

    await applyEntryTransition(transition.state, transition.submitDraft, quickScoreSummary);
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
  const currentRoundResult = replayState?.currentRound.result;
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

  function getPlayerScore(playerId: string): number {
    return totalScoreByPlayerId.get(playerId) ?? 0;
  }

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
  const currentRoundTopPlayers = currentRoundLedger.filter(
    (player) => currentRoundTopScore > 0 && player.total === currentRoundTopScore,
  );
  const currentRoundResultLabel =
    currentRoundResult === "DRAW" ? "流局" : getRoundWinResultLabel(room?.players.length ?? 0);
  const currentRoundTopScoreLabel =
    currentRoundTopPlayers.length > 0
      ? `${currentRoundTopPlayers.map((player) => player.nickname).join("、")} +${currentRoundTopScore}`
      : "无";
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
  const currentRoundSettlementPlayers = currentRoundLedger.map((player) => ({
    ...player,
    isCurrentPlayer: currentPlayer?.id === player.playerId,
    isTopPlayer: currentRoundTopScore > 0 && player.total === currentRoundTopScore,
  }));
  const roundViewMode: RoundViewMode = isCurrentRoundFinished ? "round_settlement" : "round_active";
  const canUndo = useMemo(() => scoreHistory.some((item) => !item.isUndone), [scoreHistory]);
  const quickScoreMissingMessage = getQuickScoreMissingMessage();
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
        flowSummary={formatScoreFlowSummary(item.flows)}
        isUndone={item.isUndone}
        isUndoDisabled={isUndoing || isScoring}
        key={item.event.id}
        onUndo={() => {
          void handleUndoRoomEvent(item.event.id);
        }}
        title={`${item.roundActionNumber}. ${item.title}`}
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
                    <div
                      className="flex items-center justify-between gap-3 rounded-md bg-stone-100 px-3 py-3"
                      key={player.id}
                    >
                      <p className="truncate text-base font-semibold">{player.nickname}</p>
                      <span className="text-xs font-medium text-stone-400">玩家</span>
                    </div>
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
                            setNicknameInput("");
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3" key={player.id}>
                      <Button
                        onClick={() => {
                          setEditingPlayerId(player.id);
                          setNicknameInput(player.nickname);
                        }}
                      >
                        {player.nickname} 改名
                      </Button>
                      <Button
                        disabled={!isWaiting}
                        onClick={() => {
                          openRemovePlayerConfirm(player.id, player.nickname);
                        }}
                        variant="danger"
                      >
                        删除
                      </Button>
                    </div>
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
                  eventCount={currentRoundEntries.length}
                  isConfirmDisabled={isScoring || isFinishing}
                  isConfirming={isScoring}
                  onConfirm={() => {
                    void handleConfirmRound();
                  }}
                  players={currentRoundSettlementPlayers}
                  resultLabel={currentRoundResultLabel}
                  roundNumber={currentRoundNumber}
                  topScoreLabel={currentRoundTopScoreLabel}
                />

                <Disclosure summary={`查看事件明细（${currentRoundEntries.length} 笔）`}>
                  <div className="grid gap-3">
                    {currentRoundEntries.length === 0 ? (
                      <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
                        暂无本局明细。
                      </p>
                    ) : (
                      <div className="grid gap-1">
                        {currentRoundEntries.map((item) => (
                          <article
                            className="grid gap-1 border-l border-stone-200 py-2 pl-3"
                            key={item.event.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate text-sm font-semibold text-stone-900">
                                {item.roundActionNumber}. {item.title}
                              </p>
                              {item.isUndone ? (
                                <span className="shrink-0 text-xs font-semibold text-stone-400">
                                  已撤销
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-xs font-medium text-stone-500">
                              {item.detail}
                            </p>
                            <p className="truncate text-xs font-semibold text-stone-700">
                              {formatScoreFlowSummary(item.flows)}
                            </p>
                          </article>
                        ))}
                      </div>
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
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-normal">高频记录</h2>
                    </div>
                    <Button
                      className={
                        entryState.type === "idle"
                          ? "invisible shrink-0 whitespace-nowrap"
                          : "shrink-0 whitespace-nowrap"
                      }
                      disabled={isScoring || entryState.type === "idle"}
                      onClick={resetQuickScoreSelection}
                      size="sm"
                      variant="ghost"
                    >
                      取消当前录入
                    </Button>
                  </div>

                  <EntryStatus>
                    {quickScoreMissingMessage === "" ? "确认后记录本次事件。" : quickScoreMissingMessage}
                  </EntryStatus>

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
                              meta={
                                hasWon
                                  ? "本局已胡牌"
                                  : isCounterpartyStep && isActor
                                    ? "不能选择同一玩家"
                                    : isCounterparty
                                      ? quickScoreMode === "KONG"
                                        ? "引杠玩家"
                                        : "点炮玩家"
                                      : isActor
                                        ? (
                                            <span className="flex items-center gap-1">
                                              <ScoreValue score={getPlayerScore(player.id)} size="sm" />
                                              <span>· 已选</span>
                                            </span>
                                          )
                                        : isEntryLocked
                                          ? "等待完成当前录入"
                                          : <ScoreValue score={getPlayerScore(player.id)} size="sm" />
                              }
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

                    <div className="grid min-h-24 gap-3 rounded-md bg-stone-50 p-3">
                      {entryState.type === "liuju_mode" ? (
                        <>
                          <EntryStatus title="流局确认" variant="warning">
                            {quickScoreSummary ?? quickScoreMissingMessage}
                          </EntryStatus>
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
                        </>
                      ) : quickScoreMode !== undefined ? (
                        <>
                          <EntryStatus title="当前录入">
                            {quickScoreSummary ?? quickScoreMissingMessage}
                          </EntryStatus>
                          <Button
                            className="justify-self-start"
                            disabled={isScoring}
                            onClick={resetQuickScoreSelection}
                          >
                            取消
                          </Button>
                        </>
                      ) : scoreFeedbackMessage !== undefined ? (
                        <EntryStatus
                          action={
                            <Button
                              className="shrink-0"
                              disabled={!canUndo || isUndoing || isScoring}
                              onClick={() => {
                                void handleUndoRoomEvent();
                              }}
                              size="sm"
                              variant="danger"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              撤销
                            </Button>
                          }
                          title="记录成功"
                          variant="success"
                        >
                          <span className="min-w-0 text-sm font-semibold text-emerald-700">
                            {scoreFeedbackMessage}
                          </span>
                        </EntryStatus>
                      ) : (
                        <p className="self-center text-sm text-stone-500">最近记录会显示在下方。</p>
                      )}
                    </div>
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
                          flowSummary={formatScoreFlowSummary(item.flows)}
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
