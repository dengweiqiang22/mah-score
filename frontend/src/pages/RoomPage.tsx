import type {
  KongType,
  RoomEvent,
  RoomPlayer,
  RoomRecord,
  RoomState,
  ScoreFan,
  ScoreEventRequest,
} from "@mah-score/shared";

import { useEffect, useState } from "react";
import {
  buildReplayEventsFromSnapshot,
  createPlayerLedger,
  createScoreHistory,
  createSettlement,
  replayRoomEvents,
} from "@mah-score/shared";
import QRCode from "qrcode";

import {
  getRoom,
  getRoomEvents,
  recordScoreEvent,
  recordRoomEvent,
  removePlayer,
  renamePlayer,
  startRoom,
  syncRoomEvents,
  undoRoomEvent,
} from "../api/roomApi";
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

function getHistoryFlowLabel(delta: number): string {
  return delta > 0 ? `收入 +${delta}` : `支出 ${delta}`;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isScoring, setIsScoring] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [removePlayerTarget, setRemovePlayerTarget] = useState<
    { readonly playerId: string; readonly nickname: string } | undefined
  >();
  const [nicknameInput, setNicknameInput] = useState("");
  const [events, setEvents] = useState<readonly RoomEvent[]>([]);
  const [storedPlayerIdentity, setStoredPlayerIdentity] = useState<
    StoredPlayerIdentity | undefined
  >();
  const [room, setRoom] = useState<RoomRecord | undefined>();
  const [roomVersion, setRoomVersion] = useState(0);
  const [shareMessage, setShareMessage] = useState<string | undefined>();
  const [settlementCopyMessage, setSettlementCopyMessage] = useState<string | undefined>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [quickScoreMode, setQuickScoreMode] = useState<QuickScoreMode | undefined>();
  const [selectedPrimaryPlayerId, setSelectedPrimaryPlayerId] = useState<string | undefined>();
  const [selectedRelatedPlayerId, setSelectedRelatedPlayerId] = useState<string | undefined>();
  const [selectedFan, setSelectedFan] = useState<ScoreFan | undefined>();
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");

  function resetQuickScoreSelection() {
    setSelectedPrimaryPlayerId(undefined);
    setSelectedRelatedPlayerId(undefined);
    setSelectedFan(undefined);
    setQuickScoreMode(undefined);
  }

  const inviteUrl = new URL(`/?roomId=${roomId}`, window.location.origin).toString();

  async function loadRoom() {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const [roomResponse, eventsResponse] = await Promise.all([
        getRoom(roomId),
        getRoomEvents(roomId),
      ]);

      if (!roomResponse.success) {
        setErrorMessage(roomResponse.message);
        return;
      }

      if (!eventsResponse.success) {
        setErrorMessage(eventsResponse.message);
        return;
      }

      setRoom(roomResponse.data.room);
      setRoomVersion(roomResponse.data.room.version);
      setEvents(eventsResponse.data.events);
    } catch {
      setErrorMessage("读取房间失败，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setStoredPlayerIdentity(readPlayerIdentity(roomId));
    void loadRoom();
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setEvents((currentEvents) => {
        const currentEventVersion = currentEvents.reduce(
          (version, event) => Math.max(version, event.version),
          0,
        );
        const currentVersion = Math.max(roomVersion, currentEventVersion);

        void syncRoomEvents(roomId, currentVersion)
          .then((response) => {
            if (!response.success) {
              setSyncStatus("error");
              return;
            }

            if (response.data.version !== currentVersion) {
              void loadRoom();
              setSyncStatus("idle");
              return;
            }

            if (response.data.events.length === 0) {
              setSyncStatus("idle");
              return;
            }
            setSyncStatus("idle");
          })
          .catch(() => {
            setSyncStatus("error");
          });

        setSyncStatus("syncing");
        return currentEvents;
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomId, roomVersion]);

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

    if (targetHistoryItem.round.type === "DRAW_GAME") {
      return `第 ${targetHistoryItem.roundNumber} 局 流局`;
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

      return `第 ${targetHistoryItem.roundNumber} 局 ${winnerName} 胡牌，${discarderName} 点炮`;
    }

    if (targetHistoryItem.round.type === "SELF_DRAW") {
      const winnerName = getPlayerNickname(
        replayState?.players ?? [],
        getPayloadString(targetHistoryItem.event.payload, "winnerId"),
      );

      return `第 ${targetHistoryItem.roundNumber} 局 ${winnerName} 自摸`;
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

        return `第 ${targetHistoryItem.roundNumber} 局 ${playerName} 直杠，${fromPlayerName} 引杠`;
      }

      if (kongType === "SUPPLEMENT_KONG") {
        return `第 ${targetHistoryItem.roundNumber} 局 ${playerName} 补杠`;
      }

      return `第 ${targetHistoryItem.roundNumber} 局 ${playerName} 暗杠`;
    }

    return `第 ${targetHistoryItem.roundNumber} 局`;
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
  const replayState: RoomState | undefined =
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
        );
  const currentRoundNumber = replayState?.currentRound.number ?? 0;
  const currentRoundWinnerCount = replayState?.currentRound.winnerIds.length ?? 0;
  const isCurrentRoundFinished = replayState?.currentRound.status === "FINISHED";
  const currentRoundResult = replayState?.currentRound.result;
  const settlement =
    replayState === undefined
      ? undefined
      : createSettlement(
          replayState.roomId,
          replayState.players,
          replayState.scores,
          events,
          replayState.currentRound,
        );

  function getPlayerScore(playerId: string): number {
    return replayState?.scores.find((score) => score.playerId === playerId)?.total ?? 0;
  }

  const currentRoundWinnerIds = new Set(replayState?.currentRound.winnerIds ?? []);
  const scoreHistory = createScoreHistory(events, replayState?.players ?? []);
  const playerLedger = createPlayerLedger(scoreHistory, replayState?.players ?? []);
  const currentRoundEntries =
    replayState === undefined
      ? []
      : scoreHistory.filter((item) => item.roundNumber === replayState.currentRound.number);
  const currentRoundLedger = createPlayerLedger(currentRoundEntries, replayState?.players ?? []);
  const currentPlayer =
    storedPlayerIdentity === undefined
      ? undefined
      : replayState?.players.find((player) => player.id === storedPlayerIdentity.playerId);
  const canUndo = scoreHistory.some((item) => !item.isUndone);
  const quickScoreMissingMessage = getQuickScoreMissingMessage();
  const selectedPrimaryPlayerName = getPlayerNickname(
    replayState?.players ?? [],
    selectedPrimaryPlayerId,
  );

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-8">
        <div className="pt-8">
          <p className="text-sm font-semibold text-emerald-700">房间</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">{roomId}</h1>
          <p className="mt-3 text-sm font-medium text-stone-500">
            {room === undefined
              ? "读取中"
              : room.status === "WAITING"
                ? "等待开始"
                : room.status === "PLAYING"
                  ? "游戏中"
                  : "已结束"}
          </p>
          <p className="mt-2 text-xs font-medium text-stone-400">
            {syncStatus === "syncing"
              ? "同步中"
              : syncStatus === "error"
                ? "同步失败"
                : `已同步 · v${room?.version ?? roomVersion}`}
          </p>
          <p className="mt-2 text-xs font-medium text-stone-500">
            {currentPlayer === undefined ? "公共视图" : `当前玩家 · ${currentPlayer.nickname}`}
          </p>
        </div>

        {errorMessage !== undefined ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {room !== undefined ? (
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">玩家</p>
              <p className="mt-2 text-xl font-semibold">{room.players.length}/4</p>
            </div>
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">当前局</p>
              <p className="mt-2 text-xl font-semibold">第 {currentRoundNumber} 局</p>
            </div>
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">本局状态</p>
              <p className="mt-2 text-xl font-semibold">
                {replayState === undefined
                  ? "读取中"
                  : replayState.currentRound.status === "WAITING"
                    ? "未开始"
                    : replayState.currentRound.status === "ACTIVE"
                      ? "进行中"
                      : "待确认"}
              </p>
              <p className="mt-1 text-xs font-medium text-stone-400">
                胡牌 {currentRoundWinnerCount}/3
              </p>
            </div>
          </section>
        ) : null}

        {room !== undefined ? (
          <section className="grid gap-4 rounded-md border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-xl font-semibold tracking-normal">
                  {isWaiting ? "玩家" : "快速录入"}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {isWaiting
                    ? `${room.players.length}/4 人 · 等待开始`
                    : selectedPrimaryPlayerId === undefined
                      ? "先选玩家"
                      : quickScoreMode === undefined
                        ? `已选 ${selectedPrimaryPlayerName} · 选择操作`
                        : quickScoreMissingMessage === ""
                          ? "正在记录"
                          : quickScoreMissingMessage}
                </p>
              </div>
              <button
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900"
                onClick={() => {
                  void loadRoom();
                }}
                type="button"
              >
                刷新
              </button>
            </div>

            {isLoading ? <p className="text-base text-stone-600">读取中...</p> : null}

            {!isLoading && room.players.length === 0 ? (
              <p className="rounded-md border border-stone-200 bg-stone-50 p-4 text-base text-stone-600">
                等待玩家加入
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              {room.players.map((player) => (
                currentRoundWinnerIds.has(player.id) ? (
                  <button
                    className="min-h-16 rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-left text-stone-400 disabled:cursor-not-allowed"
                    disabled
                    key={player.id}
                    type="button"
                  >
                    <span className="block truncate text-base font-semibold">{player.nickname}</span>
                    <span className="mt-1 block text-sm font-medium text-stone-400">
                      已胡牌 · {getPlayerScore(player.id)} 分
                    </span>
                  </button>
                ) : (
                  <button
                    className={`min-h-16 rounded-md border px-3 py-2 text-left ${
                      selectedPrimaryPlayerId === player.id
                        ? "border-emerald-600 bg-emerald-50"
                        : selectedRelatedPlayerId === player.id
                          ? "border-red-300 bg-red-50"
                          : "border-stone-200 bg-stone-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={!isPlaying || isCurrentRoundFinished || isScoring}
                    key={player.id}
                    onClick={() => {
                      void handleSelectPlayerCard(player.id);
                    }}
                    type="button"
                  >
                    <span className="block truncate text-base font-semibold">{player.nickname}</span>
                    <span
                      className={`mt-1 block text-sm font-medium ${
                        selectedPrimaryPlayerId === player.id
                          ? "text-emerald-700"
                          : selectedRelatedPlayerId === player.id
                            ? "text-red-700"
                            : "text-stone-500"
                      }`}
                    >
                      {selectedPrimaryPlayerId === player.id
                        ? "当前玩家"
                        : selectedRelatedPlayerId === player.id
                          ? getModeRelatedPlayerLabel(quickScoreMode ?? "DISCARD_WIN")
                          : `${getPlayerScore(player.id)} 分`}
                    </span>
                  </button>
                )
              ))}
            </div>

            {isWaiting && room.players.length < 2 ? (
              <p className="text-sm leading-6 text-stone-500">至少 2 名玩家才能开始游戏</p>
            ) : null}

            {isWaiting ? (
              <div className="grid gap-3">
                {room.players.map((player) =>
                  editingPlayerId === player.id ? (
                    <div
                      className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-3"
                      key={player.id}
                    >
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
                        <button
                          className="h-11 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white"
                          onClick={() => {
                            void handleRenamePlayer(player.id);
                          }}
                          type="button"
                        >
                          保存
                        </button>
                        <button
                          className="h-11 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900"
                          onClick={() => {
                            setEditingPlayerId(undefined);
                            setNicknameInput("");
                          }}
                          type="button"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3" key={player.id}>
                      <button
                        className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900"
                        onClick={() => {
                          setEditingPlayerId(player.id);
                          setNicknameInput(player.nickname);
                        }}
                        type="button"
                      >
                        {player.nickname} 改名
                      </button>
                      <button
                        className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700"
                        disabled={!isWaiting}
                        onClick={() => {
                          openRemovePlayerConfirm(player.id, player.nickname);
                        }}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  ),
                )}
                <button
                  className="h-14 rounded-md bg-emerald-700 px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canStart || isStarting}
                  onClick={() => {
                    void handleStartRoom();
                  }}
                  type="button"
                >
                  {isStarting ? "开始中..." : "开始游戏"}
                </button>
              </div>
            ) : null}

            {removePlayerTarget !== undefined ? (
              <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="grid gap-1">
                  <h3 className="text-base font-semibold text-amber-900">
                    确认删除玩家「{removePlayerTarget.nickname}」？
                  </h3>
                  <p className="text-sm leading-6 text-amber-800">
                    删除只允许在房间等待开始阶段进行，确认后该玩家会从房间中移除。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="h-11 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isStarting}
                    onClick={() => {
                      cancelRemovePlayer();
                    }}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className="h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isStarting}
                    onClick={() => {
                      void confirmRemovePlayer();
                    }}
                    type="button"
                  >
                    确认删除
                  </button>
                </div>
              </section>
            ) : null}

            {isPlaying ? (
              <div className="grid gap-3">
                {isCurrentRoundFinished ? (
                  <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-amber-900">本局已结束</h3>
                        <p className="mt-1 text-sm leading-6 text-amber-800">
                          {currentRoundResult === "DRAW"
                            ? "本局流局，确认账单后进入下一局。"
                            : "本局已有 3 家胡牌，确认账单后进入下一局。"}
                        </p>
                      </div>
                      <button
                        className="h-10 shrink-0 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isScoring || isFinishing}
                        onClick={() => {
                          void handleConfirmRound();
                        }}
                        type="button"
                      >
                        {isScoring ? "确认中..." : "确认账单"}
                      </button>
                    </div>

                    <div className="grid gap-2">
                      {currentRoundLedger.some((player) => player.entries.length > 0) ? (
                        currentRoundLedger
                          .filter((player) => player.entries.length > 0)
                          .map((player) => (
                            <div
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-white px-3 py-2"
                              key={player.playerId}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-stone-700">
                                  {player.nickname}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">
                                  收入 {player.income} · 支出 {player.expense}
                                </p>
                              </div>
                              <p
                                className={`shrink-0 text-sm font-semibold tabular-nums ${
                                  player.total >= 0 ? "text-emerald-700" : "text-red-700"
                                }`}
                              >
                                {player.total >= 0 ? `+${player.total}` : player.total}
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="rounded-md bg-white px-3 py-2 text-sm text-stone-600">
                          本局流局，无收支变化。
                        </p>
                      )}
                    </div>
                  </section>
                ) : null}

                <div className="grid grid-cols-3 gap-2">
                  {quickScoreModes.map((option) => (
                    <button
                      className={`h-11 rounded-md border px-2 text-sm font-semibold ${
                        quickScoreMode === option.mode
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-stone-300 bg-white text-stone-900"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={isScoring || isCurrentRoundFinished}
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

                {quickScoreMode !== undefined &&
                needsFan(quickScoreMode) &&
                selectedPrimaryPlayerId !== undefined ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold text-stone-700">番数</p>
                    <div className="grid grid-cols-4 gap-2">
                      {scoreFans.map((fan) => (
                        <button
                          className={`h-11 rounded-md border px-2 text-sm font-semibold ${
                            selectedFan === fan
                              ? "border-stone-900 bg-stone-900 text-white"
                              : "border-stone-300 bg-white text-stone-900"
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

                <section className="grid gap-3 rounded-md border border-stone-200 bg-stone-50 p-4">
                  <div>
                    <h3 className="text-base font-semibold text-stone-900">本局事件</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {currentRoundEntries.length === 0
                        ? "本局还没有计分事件"
                        : "最新事件在上方"}
                    </p>
                  </div>

                  {currentRoundEntries.length === 0 ? (
                    <p className="rounded-md bg-white px-3 py-2 text-sm text-stone-600">
                      录入点炮、自摸、杠牌或流局后会显示在这里。
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {currentRoundEntries.map((item) => (
                        <article
                          className={`grid gap-2 rounded-md border bg-white p-3 ${
                            item.isUndone ? "border-stone-200 opacity-70" : "border-stone-200"
                          }`}
                          key={item.event.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-stone-500">
                                第 {item.roundNumber} 局 · 第 {item.roundActionNumber} 笔
                              </p>
                              <h4 className="mt-1 truncate text-base font-semibold text-stone-900">
                                {item.title}
                              </h4>
                            </div>
                            {item.isUndone ? (
                              <span className="shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-500">
                                已撤销
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                有效
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-6 text-stone-600">{item.detail}</p>
                          <p
                            className={`text-sm font-semibold ${
                              item.isUndone ? "text-stone-500" : "text-stone-900"
                            }`}
                          >
                            {formatScoreFlowSummary(item.flows)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="h-12 rounded-md border border-red-200 bg-red-50 px-4 text-base font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canUndo || isUndoing || isScoring}
                    onClick={() => {
                      void handleUndoRoomEvent();
                    }}
                    type="button"
                  >
                    {isUndoing ? "撤销中..." : "撤销上一条"}
                  </button>
                  <button
                    className="h-12 rounded-md border border-stone-300 bg-white px-4 text-base font-semibold text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isScoring || isFinishing}
                    onClick={() => {
                      openFinishConfirm();
                    }}
                    type="button"
                  >
                    结束游戏
                  </button>
                </div>

                {isFinishConfirmOpen ? (
                  <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                    <div className="grid gap-2">
                      {getFinishConfirmLines().map((line) => (
                        <p className="text-sm leading-6 text-amber-950" key={line}>
                          {line}
                        </p>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className="h-11 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isFinishing}
                        onClick={() => {
                          cancelFinishRoom();
                        }}
                        type="button"
                      >
                        取消
                      </button>
                      <button
                        className="h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isFinishing}
                        onClick={() => {
                          void confirmFinishRoom();
                        }}
                        type="button"
                      >
                        {isFinishing ? "结束中..." : "确认结束"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 rounded-md border border-stone-200 bg-white p-4">
          <button
            className="flex items-center justify-between gap-3 text-left"
            onClick={() => {
              setIsHistoryExpanded((currentValue) => !currentValue);
            }}
            type="button"
          >
            <div>
              <h2 className="text-xl font-semibold tracking-normal">历史记录</h2>
              <p className="mt-1 text-sm text-stone-500">
                {playerLedger.length === 0
                  ? "暂无玩家收支"
                  : "按玩家查看收入与支出"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium text-stone-400">
              {isHistoryExpanded ? "收起" : "展开"}
            </p>
          </button>

          {isHistoryExpanded ? (
            playerLedger.length === 0 ? (
              <p className="rounded-md border border-stone-200 bg-stone-50 p-4 text-base text-stone-600">
                游戏开始后，玩家收支会显示在这里
              </p>
            ) : (
              <div className="grid gap-3">
                {playerLedger.map((player) => (
                  <div
                    className="grid gap-3 rounded-md border border-stone-200 bg-white p-4"
                    key={player.playerId}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{player.nickname}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          收入 {player.income} · 支出 {player.expense}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-2xl font-semibold tabular-nums ${
                          player.total >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {player.total >= 0 ? `+${player.total}` : player.total}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {player.entries.length === 0 ? (
                        <p className="text-sm font-medium text-stone-500">暂无收支记录</p>
                      ) : (
                        player.entries.slice(0, 4).map((entry) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2"
                            key={`${player.playerId}-${entry.eventId}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-stone-700">
                                第 {entry.roundNumber} 局 · {entry.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-stone-500">{entry.detail}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <p
                                className={`text-sm font-semibold tabular-nums ${
                                  entry.delta > 0 ? "text-emerald-700" : "text-red-700"
                                }`}
                              >
                                {getHistoryFlowLabel(entry.delta)}
                              </p>
                              {entry.isUndoable ? (
                                <button
                                  className="h-8 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isUndoing || isScoring}
                                  onClick={() => {
                                    void handleUndoRoomEvent(entry.eventId);
                                  }}
                                  type="button"
                                >
                                  撤销
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </section>

        {room !== undefined ? (
          <details className="rounded-md border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-base font-semibold tracking-normal text-stone-900">
              邀请加入
            </summary>
            <div className="mt-4 grid gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-500">房间号 {roomId}</p>
                  <p className="mt-2 break-all rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
                    {inviteUrl}
                  </p>
                </div>
                {qrCodeDataUrl !== undefined ? (
                  <img
                    alt={`房间 ${roomId} 邀请二维码`}
                    className="h-24 w-24 shrink-0 rounded-md border border-stone-200"
                    src={qrCodeDataUrl}
                  />
                ) : (
                  <div className="grid h-24 w-24 shrink-0 place-items-center rounded-md border border-stone-200 text-xs font-medium text-stone-400">
                    生成中
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="h-11 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white"
                  onClick={() => {
                    void handleShareInviteLink();
                  }}
                  type="button"
                >
                  分享房间
                </button>
                <button
                  className="h-11 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900"
                  onClick={() => {
                    void handleCopyInviteLink();
                  }}
                  type="button"
                >
                  复制链接
                </button>
              </div>
              {shareMessage !== undefined ? (
                <p className="text-sm font-medium text-stone-500">{shareMessage}</p>
              ) : null}
            </div>
          </details>
        ) : null}

        {isFinished && settlement !== undefined ? (
          <section className="grid gap-4">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-xl font-semibold tracking-normal">结算</h2>
                <p className="mt-1 text-sm text-stone-500">共 {settlement.totalRounds} 局</p>
              </div>
              <button
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900"
                onClick={() => {
                  void handleCopySettlementText(settlement.text);
                }}
                type="button"
              >
                复制
              </button>
            </div>

            <div className="grid gap-3">
              {settlement.players.map((player) => (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-stone-200 bg-white p-4"
                  key={player.playerId}
                >
                  <p className="grid h-9 w-9 place-items-center rounded-md bg-stone-100 text-sm font-semibold text-stone-700">
                    {player.rank}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{player.nickname}</p>
                    <p className="mt-1 text-xs font-medium text-stone-500">
                      胡 {player.winCount} · 点炮 {player.discardCount} · 杠 {player.kongCount}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">{player.total}</p>
                </div>
              ))}
            </div>

            <pre className="whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-700">
              {settlement.text}
            </pre>

            {settlementCopyMessage !== undefined ? (
              <p className="text-sm font-medium text-stone-500">{settlementCopyMessage}</p>
            ) : null}
          </section>
        ) : null}

        {isFinished ? (
          <p className="pb-3 text-sm leading-6 text-stone-500">本房间已经结束</p>
        ) : null}
      </section>
    </main>
  );
}
