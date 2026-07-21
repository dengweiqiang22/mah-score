import type {
  KongType,
  RoomEvent,
  RoomPlayer,
  RoomState,
  ScoreFan,
  ScoreEventRequest,
} from "@mah-score/shared";

import { useEffect, useMemo, useState } from "react";
import {
  buildReplayEventsFromSnapshot,
  createPlayerLedger,
  createRoundLedgers,
  createScoreHistory,
  createSettlement,
  replayRoomEvents,
} from "@mah-score/shared";
import { Copy, Share2, Undo2 } from "lucide-react";
import QRCode from "qrcode";

import {
  recordScoreEvent,
  recordRoomEvent,
  removePlayer,
  renamePlayer,
  startRoom,
  undoRoomEvent,
} from "../api/roomApi";
import { LedgerRow } from "../components/room/LedgerRow";
import { PlayerTile } from "../components/room/PlayerTile";
import { RecordRow } from "../components/room/RecordRow";
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

type QuickScoreMode =
  "DISCARD_WIN" | "SELF_DRAW" | "DISCARD_KONG" | "SUPPLEMENT_KONG" | "CONCEALED_KONG" | "DRAW_GAME";

interface QuickScoreModeOption {
  readonly mode: QuickScoreMode;
  readonly label: string;
}

const quickScoreModes: readonly QuickScoreModeOption[] = [
  {
    mode: "DISCARD_WIN",
    label: "点炮",
  },
  {
    mode: "SELF_DRAW",
    label: "自摸",
  },
  {
    mode: "DISCARD_KONG",
    label: "直杠",
  },
  {
    mode: "SUPPLEMENT_KONG",
    label: "补杠",
  },
  {
    mode: "CONCEALED_KONG",
    label: "暗杠",
  },
  {
    mode: "DRAW_GAME",
    label: "流局",
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

function formatScoreFlowSummary(flows: readonly { readonly nickname: string; readonly delta: number }[]): string {
  if (flows.length === 0) {
    return "无分数变化";
  }

  return flows.map((flow) => `${flow.nickname} ${getScoreFlowLabel(flow.delta)}`).join("，");
}

function needsRelatedPlayer(mode: QuickScoreMode): boolean {
  return mode === "DISCARD_WIN" || mode === "DISCARD_KONG";
}

function needsFan(mode: QuickScoreMode): boolean {
  return mode === "DISCARD_WIN" || mode === "SELF_DRAW";
}

function getModePrimaryPlayerLabel(mode: QuickScoreMode): string {
  if (mode === "DISCARD_KONG" || mode === "SUPPLEMENT_KONG" || mode === "CONCEALED_KONG") {
    return "杠牌玩家";
  }

  if (mode === "DRAW_GAME") {
    return "无需选择玩家";
  }

  return "胡牌玩家";
}

function getModeRelatedPlayerLabel(mode: QuickScoreMode): string {
  if (mode === "DISCARD_KONG") {
    return "引杠玩家";
  }

  return "点炮玩家";
}

function getKongType(mode: QuickScoreMode): KongType | undefined {
  if (mode === "DISCARD_KONG") {
    return "DISCARD_KONG";
  }

  if (mode === "SUPPLEMENT_KONG") {
    return "SUPPLEMENT_KONG";
  }

  if (mode === "CONCEALED_KONG") {
    return "CONCEALED_KONG";
  }

  return undefined;
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
  const [quickScoreMode, setQuickScoreMode] = useState<QuickScoreMode | undefined>();
  const [selectedPrimaryPlayerId, setSelectedPrimaryPlayerId] = useState<string | undefined>();
  const [selectedRelatedPlayerId, setSelectedRelatedPlayerId] = useState<string | undefined>();
  const [selectedFan, setSelectedFan] = useState<ScoreFan | undefined>();
  const [expandedHistoryRoundNumbers, setExpandedHistoryRoundNumbers] = useState<readonly number[]>(
    [],
  );
  const [isPlayerLedgerExpanded, setIsPlayerLedgerExpanded] = useState(false);
  const { events, isLoading, loadRoom, room, roomVersion, syncStatus } = useRoomSync(
    roomId,
    setErrorMessage,
  );

  function resetQuickScoreSelection() {
    setSelectedPrimaryPlayerId(undefined);
    setSelectedRelatedPlayerId(undefined);
    setSelectedFan(undefined);
    setQuickScoreMode(undefined);
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

  function handleSelectPrimaryPlayer(playerId: string) {
    if (
      room?.status !== "PLAYING" ||
      isScoring ||
      isCurrentRoundFinished ||
      currentRoundWinnerIds.has(playerId)
    ) {
      return;
    }

    setErrorMessage(undefined);
    setSelectedPrimaryPlayerId(playerId);
    setSelectedRelatedPlayerId(undefined);
    setSelectedFan(undefined);
  }

  async function handleSelectPlayerCard(playerId: string) {
    if (
      quickScoreMode !== undefined &&
      needsRelatedPlayer(quickScoreMode) &&
      selectedPrimaryPlayerId !== undefined &&
      selectedPrimaryPlayerId !== playerId
    ) {
      await handleSelectRelatedPlayer(playerId);
      return;
    }

    handleSelectPrimaryPlayer(playerId);
  }

  function getQuickScoreRequest(input?: {
    readonly mode?: QuickScoreMode;
    readonly fan?: ScoreFan;
    readonly relatedPlayerId?: string;
  }): ScoreEventRequest | undefined {
    const mode = input?.mode ?? quickScoreMode;
    const fan = input?.fan ?? selectedFan;
    const relatedPlayerId = input?.relatedPlayerId ?? selectedRelatedPlayerId;

    if (mode === undefined) {
      return undefined;
    }

    if (mode === "DRAW_GAME") {
      return {
        roomId,
        action: "DRAW_GAME",
        operator: "room",
      };
    }

    if (selectedPrimaryPlayerId === undefined) {
      return undefined;
    }

    if (mode === "SELF_DRAW") {
      if (fan === undefined) {
        return undefined;
      }

      return {
        roomId,
        action: "SELF_DRAW",
        operator: "room",
        winnerId: selectedPrimaryPlayerId,
        fan,
      };
    }

    if (mode === "DISCARD_WIN") {
      if (relatedPlayerId === undefined || fan === undefined) {
        return undefined;
      }

      return {
        roomId,
        action: "DISCARD_WIN",
        operator: "room",
        winnerId: selectedPrimaryPlayerId,
        discarderId: relatedPlayerId,
        fan,
      };
    }

    const kongType = getKongType(mode);

    if (kongType === undefined) {
      return undefined;
    }

    if (kongType === "DISCARD_KONG") {
      if (relatedPlayerId === undefined) {
        return undefined;
      }

      return {
        roomId,
        action: "KONG",
        operator: "room",
        playerId: selectedPrimaryPlayerId,
        kongType,
        fromPlayerId: relatedPlayerId,
      };
    }

    return {
      roomId,
      action: "KONG",
      operator: "room",
      playerId: selectedPrimaryPlayerId,
      kongType,
    };
  }

  async function handleSelectQuickScoreMode(mode: QuickScoreMode) {
    if (room?.status !== "PLAYING" || isScoring || isCurrentRoundFinished) {
      return;
    }

    setErrorMessage(undefined);
    setQuickScoreMode(mode);
    setSelectedRelatedPlayerId(undefined);
    setSelectedFan(undefined);

    const scoreRequest = getQuickScoreRequest({
      mode,
      fan: undefined,
      relatedPlayerId: undefined,
    });

    if (scoreRequest !== undefined) {
      await submitScoreRequest(scoreRequest);
      return;
    }

    if (mode !== "DRAW_GAME" && selectedPrimaryPlayerId === undefined) {
      setErrorMessage("请先选择玩家。");
    }
  }

  async function handleSelectRelatedPlayer(playerId: string) {
    if (quickScoreMode === undefined || !needsRelatedPlayer(quickScoreMode)) {
      return;
    }

    if (selectedPrimaryPlayerId === undefined) {
      setErrorMessage("请先选择玩家。");
      return;
    }

    if (selectedPrimaryPlayerId === playerId) {
      setErrorMessage("相关玩家不能和主玩家相同。");
      return;
    }

    if (currentRoundWinnerIds.has(playerId)) {
      setErrorMessage("已胡牌玩家不能继续作为操作对象。");
      return;
    }

    setSelectedRelatedPlayerId(playerId);

    const scoreRequest = getQuickScoreRequest({
      relatedPlayerId: playerId,
    });

    if (scoreRequest !== undefined) {
      await submitScoreRequest(scoreRequest);
    }
  }

  function getQuickScoreMissingMessage(): string {
    if (replayState?.currentRound.status === "FINISHED") {
      return "本局已结束，请先确认账单。";
    }

    if (quickScoreMode === undefined) {
      return selectedPrimaryPlayerId === undefined ? "请选择玩家。" : "请选择操作。";
    }

    if (quickScoreMode === "DRAW_GAME") {
      return "";
    }

    if (selectedPrimaryPlayerId === undefined) {
      return `请选择${getModePrimaryPlayerLabel(quickScoreMode)}。`;
    }

    if (needsRelatedPlayer(quickScoreMode) && selectedRelatedPlayerId === undefined) {
      return `请选择${getModeRelatedPlayerLabel(quickScoreMode)}。`;
    }

    if (needsFan(quickScoreMode) && selectedFan === undefined) {
      return "请选择番数。";
    }

    return "";
  }

  async function handleSelectFan(fan: ScoreFan) {
    setSelectedFan(fan);

    const scoreRequest = getQuickScoreRequest({
      fan,
    });

    if (scoreRequest === undefined) {
      return;
    }

    await submitScoreRequest(scoreRequest);
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
    const lines = ["确认结束游戏后：", "房间会进入已结束状态", "结束后不能继续计分", "会生成最终结算"];

    if (
      replayState?.currentRound.status === "ACTIVE" &&
      currentRoundEntries.some((item) => !item.isUndone)
    ) {
      lines.push("当前局尚未流局");
      lines.push("当前局尚未达到三家胡牌");
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
    return replayState?.scores.find((score) => score.playerId === playerId)?.total ?? 0;
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
  const canUndo = useMemo(() => scoreHistory.some((item) => !item.isUndone), [scoreHistory]);
  const quickScoreMissingMessage = getQuickScoreMissingMessage();
  const selectedPrimaryPlayerName = useMemo(
    () => getPlayerNickname(replayState?.players ?? [], selectedPrimaryPlayerId),
    [replayState, selectedPrimaryPlayerId],
  );
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
        <div className="flex items-center justify-between gap-3 px-1 text-xs font-medium text-stone-500">
          <span>
            {syncStatus === "syncing"
              ? "同步中"
              : syncStatus === "error"
                ? "同步失败"
                : `已同步 v${room?.version ?? roomVersion}`}
          </span>
          <span>{currentPlayer === undefined ? "公共视图" : currentPlayer.nickname}</span>
        </div>

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
          <PlayingRoomView roomId={roomId} roundNumber={currentRoundNumber}>
            <Section>
              <div>
                <h2 className="text-base font-semibold tracking-normal">当前比分</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {selectedPrimaryPlayerId === undefined
                    ? "先选玩家，再记录本次事件。"
                    : quickScoreMode === undefined
                      ? `已选 ${selectedPrimaryPlayerName}，请选择事件。`
                      : quickScoreMissingMessage === ""
                        ? "正在记录。"
                        : quickScoreMissingMessage}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {room.players.map((player) => {
                  const hasWon = currentRoundWinnerIds.has(player.id);

                  return (
                    <PlayerTile
                      disabled={hasWon || isCurrentRoundFinished || isScoring}
                      isRelated={selectedRelatedPlayerId === player.id}
                      isSelected={selectedPrimaryPlayerId === player.id}
                      key={player.id}
                      meta={
                        hasWon
                          ? `已胡牌 · ${getPlayerScore(player.id)}`
                          : selectedPrimaryPlayerId === player.id
                            ? `${getPlayerScore(player.id)} · 已选`
                            : selectedRelatedPlayerId === player.id
                              ? getModeRelatedPlayerLabel(quickScoreMode ?? "DISCARD_WIN")
                              : `${getPlayerScore(player.id)}`
                      }
                      nickname={player.nickname}
                      onClick={() => {
                        void handleSelectPlayerCard(player.id);
                      }}
                      tone={hasWon ? "muted" : "default"}
                    />
                  );
                })}
              </div>
            </Section>

            <Section>
              <div>
                <h2 className="text-lg font-semibold tracking-normal">发生了什么？</h2>
                <p className="mt-1 text-sm text-stone-500">记录后会自动计算分数。</p>
              </div>

              {isCurrentRoundFinished ? (
                <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm leading-6 text-amber-900">
                    {currentRoundResult === "DRAW"
                      ? "本局流局，确认后进入下一局。"
                      : "本局只剩 1 名玩家未胡牌，确认后进入下一局。"}
                  </p>
                  <Button
                    disabled={isScoring || isFinishing}
                    onClick={() => {
                      void handleConfirmRound();
                    }}
                    variant="primary"
                  >
                    {isScoring ? "确认中..." : "确认本局，开始下一局"}
                  </Button>
                </section>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {quickScoreModes.map((option) => (
                    <button
                      className={`h-12 rounded-md px-2 text-sm font-semibold ${
                        quickScoreMode === option.mode
                          ? "bg-emerald-700 text-white"
                          : "bg-stone-100 text-stone-900"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={isScoring}
                      key={option.mode}
                      onClick={() => {
                        void handleSelectQuickScoreMode(option.mode);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {quickScoreMode !== undefined &&
              needsFan(quickScoreMode) &&
              selectedPrimaryPlayerId !== undefined ? (
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-stone-700">番数</p>
                  <div className="grid grid-cols-4 gap-2">
                    {scoreFans.map((fan) => (
                      <button
                        className={`h-11 rounded-md px-2 text-sm font-semibold ${
                          selectedFan === fan
                            ? "bg-stone-900 text-white"
                            : "bg-stone-100 text-stone-900"
                        }`}
                        disabled={isScoring}
                        key={fan}
                        onClick={() => {
                          void handleSelectFan(fan);
                        }}
                        type="button"
                      >
                        {fan} 番
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </Section>

            <Section>
              <div>
                <h2 className="text-base font-semibold tracking-normal">最近记录</h2>
                <p className="mt-1 text-sm text-stone-500">最多显示最近两条。</p>
              </div>

              {recentCurrentRoundEntries.length === 0 ? (
                <p className="rounded-md bg-stone-100 px-3 py-3 text-sm text-stone-600">
                  本局还没有计分事件。
                </p>
              ) : (
                <div className="grid gap-2">
                  {recentCurrentRoundEntries.map((item) => renderCurrentRoundEntry(item))}
                </div>
              )}
            </Section>

            <Disclosure summary="本局详情">
              <div className="grid gap-3">
                <div className="grid gap-2">
                  {currentRoundLedger.map((player) => (
                    <LedgerRow
                      expense={player.expense}
                      income={player.income}
                      isCurrentPlayer={currentPlayer?.id === player.playerId}
                      key={player.playerId}
                      nickname={player.nickname}
                      total={player.total}
                    />
                  ))}
                </div>
                {currentRoundEntries.length === 0 ? (
                  <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
                    暂无本局明细。
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {currentRoundEntries.map((item) => renderCurrentRoundEntry(item))}
                  </div>
                )}
              </div>
            </Disclosure>

            <Disclosure summary="更多">
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <p className="text-sm font-semibold text-stone-700">邀请加入</p>
                  <div className="flex items-start justify-between gap-4">
                    <p className="min-w-0 break-all rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
                      {inviteUrl}
                    </p>
                    {qrCodeDataUrl !== undefined ? (
                      <img
                        alt={`房间 ${roomId} 邀请二维码`}
                        className="h-20 w-20 shrink-0 rounded-md border border-stone-200"
                        src={qrCodeDataUrl}
                      />
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => {
                        void handleShareInviteLink();
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                      分享
                    </Button>
                    <Button
                      onClick={() => {
                        void handleCopyInviteLink();
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      复制
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-stone-700">历史局</p>
                  {historyRoundLedgers.length === 0 ? (
                    <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
                      暂无历史局。
                    </p>
                  ) : (
                    historyRoundLedgers.map((roundLedger) => {
                      const isRoundExpanded = expandedHistoryRoundNumberSet.has(
                        roundLedger.roundNumber,
                      );

                      return (
                        <article className="grid gap-2 rounded-md bg-stone-50 p-3" key={roundLedger.roundNumber}>
                          <button
                            className="flex items-center justify-between gap-3 text-left"
                            onClick={() => {
                              toggleHistoryRound(roundLedger.roundNumber);
                            }}
                            type="button"
                          >
                            <span className="text-sm font-semibold text-stone-900">
                              第 {roundLedger.roundNumber} 局
                            </span>
                            <span className="text-xs font-medium text-stone-400">
                              {isRoundExpanded ? "收起" : `${roundLedger.entries.length} 笔`}
                            </span>
                          </button>
                          {isRoundExpanded ? (
                            <div className="grid gap-2">
                              {roundLedger.entries.map((item) => renderCurrentRoundEntry(item))}
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>

                <button
                  className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-3 text-left"
                  onClick={() => {
                    setIsPlayerLedgerExpanded((currentValue) => !currentValue);
                  }}
                  type="button"
                >
                  <span className="text-sm font-semibold text-stone-900">玩家总账</span>
                  <span className="text-xs font-medium text-stone-400">
                    {isPlayerLedgerExpanded ? "收起" : "展开"}
                  </span>
                </button>
                {isPlayerLedgerExpanded ? (
                  <div className="grid gap-2">
                    {playerLedger.map((player) => (
                      <LedgerRow
                        expense={player.expense}
                        income={player.income}
                        isCurrentPlayer={currentPlayer?.id === player.playerId}
                        key={player.playerId}
                        nickname={player.nickname}
                        total={player.total}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    disabled={!canUndo || isUndoing || isScoring}
                    onClick={() => {
                      void handleUndoRoomEvent();
                    }}
                    variant="danger"
                  >
                    <Undo2 className="h-4 w-4" />
                    {isUndoing ? "撤销中..." : "撤销上一条"}
                  </Button>
                  <Button
                    disabled={isScoring || isFinishing}
                    onClick={() => {
                      openFinishConfirm();
                    }}
                  >
                    结束整场
                  </Button>
                </div>

                {shareMessage !== undefined ? (
                  <p className="text-sm font-medium text-stone-500">{shareMessage}</p>
                ) : null}
              </div>
            </Disclosure>

            {isFinishConfirmOpen ? (
              <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="grid gap-2">
                  {getFinishConfirmLines().map((line) => (
                    <p className="text-sm leading-6 text-amber-950" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button disabled={isFinishing} onClick={cancelFinishRoom}>
                    返回检查
                  </Button>
                  <Button
                    disabled={isFinishing}
                    onClick={() => {
                      void confirmFinishRoom();
                    }}
                    variant="danger"
                  >
                    {isFinishing ? "结束中..." : "确认结束"}
                  </Button>
                </div>
              </section>
            ) : null}
          </PlayingRoomView>
        ) : null}

        {isFinished && settlement !== undefined ? (
          <FinishedRoomView roomId={roomId} totalRounds={settlement.totalRounds}>
            <div className="grid gap-3">
              {settlement.players.map((player) => (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-white p-4 shadow-sm ring-1 ring-stone-200/80"
                  key={player.playerId}
                >
                  <p className="grid h-10 w-10 place-items-center rounded-md bg-stone-100 text-sm font-semibold text-stone-700">
                    {player.rank}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{player.nickname}</p>
                    <p className="mt-1 text-xs font-medium text-stone-500">
                      胡 {player.winCount} · 点炮 {player.discardCount} · 杠 {player.kongCount}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {player.total >= 0 ? `+${player.total}` : player.total}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => {
                  void handleCopySettlementText(settlement.text);
                }}
                variant="primary"
              >
                <Copy className="h-4 w-4" />
                复制战绩
              </Button>
              <Button
                onClick={() => {
                  window.location.assign("/");
                }}
              >
                返回首页
              </Button>
            </div>
            {settlementCopyMessage !== undefined ? (
              <p className="text-sm font-medium text-stone-500">{settlementCopyMessage}</p>
            ) : null}
          </FinishedRoomView>
        ) : null}
      </section>
    </main>
  );
}
