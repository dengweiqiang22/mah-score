import type {
  KongType,
  RoomEvent,
  RoomPlayer,
  RoomRecord,
  RoomState,
  RoundState,
  ScoreFan,
  ScoreEventRequest,
} from "@mah-score/shared";

import { useEffect, useState } from "react";
import { createSettlement, replayRoomEvents } from "@mah-score/shared";
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

interface RoomPageProps {
  readonly roomId: string;
}

type QuickScoreMode =
  "DISCARD_WIN" | "SELF_DRAW" | "DISCARD_KONG" | "SUPPLEMENT_KONG" | "CONCEALED_KONG" | "DRAW_GAME";

interface QuickScoreModeOption {
  readonly mode: QuickScoreMode;
  readonly label: string;
}

interface ScoreHistoryItem {
  readonly event: RoomEvent;
  readonly round: RoundState;
  readonly roundNumber: number;
  readonly isUndone: boolean;
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

function getPayloadString(payload: RoomEvent["payload"], key: string): string | undefined {
  const value = payload[key];

  return typeof value === "string" ? value : undefined;
}

function getPayloadNumber(payload: RoomEvent["payload"], key: string): number | undefined {
  const value = payload[key];

  return typeof value === "number" ? value : undefined;
}

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

function getUndoTargetEventId(event: RoomEvent): string | undefined {
  return getPayloadString(event.payload, "targetEventId");
}

function isScoreHistoryEvent(event: RoomEvent): boolean {
  return (
    event.type === "DISCARD_WIN" ||
    event.type === "SELF_DRAW" ||
    event.type === "KONG" ||
    event.type === "DRAW_GAME"
  );
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

function getPlayerNickname(players: readonly RoomPlayer[], playerId: string | undefined): string {
  if (playerId === undefined) {
    return "未知玩家";
  }

  return players.find((player) => player.id === playerId)?.nickname ?? "未知玩家";
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

function createRoundFromEvent(event: RoomEvent): RoundState {
  return {
    eventId: event.id,
    type: event.type,
    version: event.version,
    payload: event.payload,
  };
}

function createScoreHistory(events: readonly RoomEvent[]): readonly ScoreHistoryItem[] {
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

  return [...events]
    .sort((left, right) => left.version - right.version)
    .flatMap((event) => {
      if (!isScoreHistoryEvent(event)) {
        return [];
      }

      const historyItem: ScoreHistoryItem = {
        event,
        round: createRoundFromEvent(event),
        roundNumber,
        isUndone: undoneEventIds.has(event.id),
      };

      if (!historyItem.isUndone) {
        if (event.type === "DISCARD_WIN" || event.type === "SELF_DRAW") {
          const winnerId = getPayloadString(event.payload, "winnerId");

          if (winnerId !== undefined && !winnerIds.has(winnerId)) {
            winnerIds.add(winnerId);
          }

          if (winnerIds.size >= 3) {
            roundNumber += 1;
            winnerIds.clear();
          }
        }

        if (event.type === "DRAW_GAME") {
          roundNumber += 1;
          winnerIds.clear();
        }
      }

      return [historyItem];
    })
    .sort((left, right) => right.event.version - left.event.version);
}

export function RoomPage({ roomId }: RoomPageProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isScoring, setIsScoring] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [events, setEvents] = useState<readonly RoomEvent[]>([]);
  const [room, setRoom] = useState<RoomRecord | undefined>();
  const [roomVersion, setRoomVersion] = useState(0);
  const [shareMessage, setShareMessage] = useState<string | undefined>();
  const [settlementCopyMessage, setSettlementCopyMessage] = useState<string | undefined>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [quickScoreMode, setQuickScoreMode] = useState<QuickScoreMode>("DISCARD_WIN");
  const [selectedPrimaryPlayerId, setSelectedPrimaryPlayerId] = useState<string | undefined>();
  const [selectedRelatedPlayerId, setSelectedRelatedPlayerId] = useState<string | undefined>();
  const [selectedFan, setSelectedFan] = useState<ScoreFan>(1);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");

  function resetQuickScoreSelection() {
    setSelectedPrimaryPlayerId(undefined);
    setSelectedRelatedPlayerId(undefined);
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

  async function handleRemovePlayer(playerId: string) {
    setErrorMessage(undefined);

    try {
      const response = await removePlayer({
        roomId,
        playerId,
      });

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      resetQuickScoreSelection();
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

  async function handleUndoRoomEvent(targetEventId?: string) {
    const shouldUndo = window.confirm(
      targetEventId === undefined ? "确认撤销上一条计分记录？" : "确认撤销这条计分记录？",
    );

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

  function handleSelectQuickScorePlayer(playerId: string) {
    if (room?.status !== "PLAYING" || isScoring || isCurrentRoundFinished) {
      return;
    }

    setErrorMessage(undefined);

    if (quickScoreMode === "DRAW_GAME") {
      return;
    }

    if (selectedPrimaryPlayerId === undefined) {
      setSelectedPrimaryPlayerId(playerId);
      return;
    }

    if (selectedPrimaryPlayerId === playerId) {
      resetQuickScoreSelection();
      return;
    }

    if (!needsRelatedPlayer(quickScoreMode)) {
      setSelectedPrimaryPlayerId(playerId);
      setSelectedRelatedPlayerId(undefined);
      return;
    }

    if (selectedRelatedPlayerId === playerId) {
      setSelectedRelatedPlayerId(undefined);
      return;
    }

    setSelectedRelatedPlayerId(playerId);
  }

  function getQuickScoreRequest(): ScoreEventRequest | undefined {
    if (quickScoreMode === "DRAW_GAME") {
      return {
        roomId,
        action: "DRAW_GAME",
        operator: "room",
      };
    }

    if (selectedPrimaryPlayerId === undefined) {
      return undefined;
    }

    if (quickScoreMode === "SELF_DRAW") {
      return {
        roomId,
        action: "SELF_DRAW",
        operator: "room",
        winnerId: selectedPrimaryPlayerId,
        fan: selectedFan,
      };
    }

    if (quickScoreMode === "DISCARD_WIN") {
      if (selectedRelatedPlayerId === undefined) {
        return undefined;
      }

      return {
        roomId,
        action: "DISCARD_WIN",
        operator: "room",
        winnerId: selectedPrimaryPlayerId,
        discarderId: selectedRelatedPlayerId,
        fan: selectedFan,
      };
    }

    const kongType = getKongType(quickScoreMode);

    if (kongType === undefined) {
      return undefined;
    }

    if (kongType === "DISCARD_KONG") {
      if (selectedRelatedPlayerId === undefined) {
        return undefined;
      }

      return {
        roomId,
        action: "KONG",
        operator: "room",
        playerId: selectedPrimaryPlayerId,
        kongType,
        fromPlayerId: selectedRelatedPlayerId,
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

  function getQuickScoreMissingMessage(): string {
    if (quickScoreMode === "DRAW_GAME") {
      return "";
    }

    if (selectedPrimaryPlayerId === undefined) {
      return `请选择${getModePrimaryPlayerLabel(quickScoreMode)}。`;
    }

    if (needsRelatedPlayer(quickScoreMode) && selectedRelatedPlayerId === undefined) {
      return `请选择${getModeRelatedPlayerLabel(quickScoreMode)}。`;
    }

    return "";
  }

  async function handleRecordQuickScore() {
    const scoreRequest = getQuickScoreRequest();

    if (scoreRequest === undefined) {
      setErrorMessage(getQuickScoreMissingMessage());
      return;
    }

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

  async function handleFinishRoom() {
    setIsFinishing(true);
    setErrorMessage(undefined);

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

  const isWaiting = room?.status === "WAITING";
  const isPlaying = room?.status === "PLAYING";
  const isFinished = room?.status === "FINISHED";
  const canStart = isWaiting && room.players.length >= 2 && room.players.length <= 4;
  const replayState: RoomState | undefined =
    room === undefined
      ? undefined
      : replayRoomEvents([
          ...room.players.map((player) => ({
            id: `room_${room.roomId}_player_${player.id}`,
            roomId,
            type: "PLAYER_JOINED" as const,
            version: 0,
            operator: "room",
            timestamp: room.createdAt,
            payload: {
              playerId: player.id,
              nickname: player.nickname,
            },
          })),
          ...events,
        ]);
  const currentRoundNumber = replayState?.currentRound.number ?? 0;
  const currentRoundWinnerCount = replayState?.currentRound.winnerIds.length ?? 0;
  const isCurrentRoundFinished = currentRoundWinnerCount >= 3;
  const settlement =
    replayState === undefined
      ? undefined
      : createSettlement(
          replayState.roomId,
          replayState.players,
          replayState.scores,
          replayState.rounds,
        );

  function getPlayerScore(playerId: string): number {
    return replayState?.scores.find((score) => score.playerId === playerId)?.total ?? 0;
  }

  const scoreHistory = createScoreHistory(events);
  const canUndo = scoreHistory.some((item) => !item.isUndone);
  const canRecordQuickScore =
    isPlaying && !isCurrentRoundFinished && getQuickScoreRequest() !== undefined && !isScoring;
  const quickScoreMissingMessage = getQuickScoreMissingMessage();
  const selectedPrimaryPlayerName = getPlayerNickname(
    replayState?.players ?? [],
    selectedPrimaryPlayerId,
  );
  const selectedRelatedPlayerName = getPlayerNickname(
    replayState?.players ?? [],
    selectedRelatedPlayerId,
  );
  const visibleScoreHistory = scoreHistory.slice(0, 20);

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
              <p className="text-xs font-medium text-stone-500">本局胡牌</p>
              <p className="mt-2 text-xl font-semibold">{currentRoundWinnerCount}/3</p>
            </div>
          </section>
        ) : null}

        {room !== undefined ? (
          <section className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-normal">邀请加入</h2>
                <p className="mt-1 text-sm font-medium text-stone-500">房间号 {roomId}</p>
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
            <p className="break-all rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
              {inviteUrl}
            </p>
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
          </section>
        ) : null}

        <section className="grid gap-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">玩家</h2>
              <p className="mt-1 text-sm text-stone-500">
                {room === undefined
                  ? "读取中"
                  : `${room.players.length}/4 人 · 第 ${currentRoundNumber} 局`}
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

          {!isLoading && room !== undefined && room.players.length === 0 ? (
            <p className="rounded-md border border-stone-200 bg-white p-4 text-base text-stone-600">
              等待玩家加入
            </p>
          ) : null}

          {room?.players.map((player) => (
            <div
              className={`grid gap-3 rounded-md border p-4 ${
                selectedPrimaryPlayerId === player.id
                  ? "border-emerald-600 bg-emerald-50"
                  : selectedRelatedPlayerId === player.id
                    ? "border-red-300 bg-red-50"
                    : "border-stone-200 bg-white"
              } ${isPlaying && !isCurrentRoundFinished && quickScoreMode !== "DRAW_GAME" ? "cursor-pointer" : ""}`}
              key={player.id}
              onClick={() => {
                handleSelectQuickScorePlayer(player.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectQuickScorePlayer(player.id);
                }
              }}
              role={
                isPlaying && !isCurrentRoundFinished && quickScoreMode !== "DRAW_GAME"
                  ? "button"
                  : undefined
              }
              tabIndex={
                isPlaying && !isCurrentRoundFinished && quickScoreMode !== "DRAW_GAME"
                  ? 0
                  : undefined
              }
            >
              {editingPlayerId === player.id ? (
                <div className="grid gap-3">
                  <input
                    className="h-12 rounded-md border border-stone-300 px-3 text-base outline-none focus:border-emerald-700"
                    maxLength={12}
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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{player.nickname}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {selectedPrimaryPlayerId === player.id
                        ? getModePrimaryPlayerLabel(quickScoreMode)
                        : selectedRelatedPlayerId === player.id
                          ? getModeRelatedPlayerLabel(quickScoreMode)
                          : isWaiting
                            ? "等待开始"
                            : "累计分数"}
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tabular-nums">
                    {getPlayerScore(player.id)}
                  </p>
                  {isWaiting ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingPlayerId(player.id);
                          setNicknameInput(player.nickname);
                        }}
                        type="button"
                      >
                        改名
                      </button>
                      <button
                        className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRemovePlayer(player.id);
                        }}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="grid gap-4">
          <div className="border-b border-stone-200 pb-3">
            <h2 className="text-xl font-semibold tracking-normal">历史记录</h2>
            <p className="mt-1 text-sm text-stone-500">
              {visibleScoreHistory.length === 0
                ? "暂无计分事件"
                : `显示最近 ${visibleScoreHistory.length} 条计分事件`}
            </p>
          </div>

          {visibleScoreHistory.length === 0 ? (
            <p className="rounded-md border border-stone-200 bg-white p-4 text-base text-stone-600">
              游戏开始后，计分事件会显示在这里
            </p>
          ) : (
            <div className="grid gap-3">
              {visibleScoreHistory.map((item) => (
                <div
                  className={`grid gap-3 rounded-md border p-4 ${
                    item.isUndone
                      ? "border-stone-200 bg-stone-100 text-stone-500"
                      : "border-stone-200 bg-white"
                  }`}
                  key={item.event.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        第 {item.roundNumber} 局 ·{" "}
                        {formatRoundTitle(item.round, replayState?.players ?? [])}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        {formatRoundDetail(item.round, replayState?.players ?? [])}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-stone-400">
                      #{item.event.version}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-stone-400">
                      {item.isUndone ? "已撤销" : "有效记录"}
                    </p>
                    {!item.isUndone && isPlaying ? (
                      <button
                        className="h-9 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUndoing || isScoring}
                        onClick={() => {
                          void handleUndoRoomEvent(item.event.id);
                        }}
                        type="button"
                      >
                        撤销
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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

        {room !== undefined ? (
          <div className="mt-auto grid gap-3 pb-3">
            <div className="border-b border-stone-200 pb-3">
              <h2 className="text-xl font-semibold tracking-normal">操作</h2>
            </div>
            {isWaiting && room.players.length < 2 ? (
              <p className="text-sm leading-6 text-stone-500">至少 2 名玩家才能开始游戏</p>
            ) : null}
            {room.status === "WAITING" ? (
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
            ) : null}
            {room.status === "PLAYING" ? (
              <div className="grid gap-3">
                {isCurrentRoundFinished ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800">
                    本局已有 3 家胡牌，当前局已结束。
                  </p>
                ) : null}
                <div className="grid grid-cols-3 gap-2">
                  {quickScoreModes.map((option) => (
                    <button
                      className={`h-11 rounded-md border px-2 text-sm font-semibold ${
                        quickScoreMode === option.mode
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-stone-300 bg-white text-stone-900"
                      }`}
                      key={option.mode}
                      onClick={() => {
                        setQuickScoreMode(option.mode);
                        resetQuickScoreSelection();
                        setErrorMessage(undefined);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {needsFan(quickScoreMode) ? (
                  <div className="grid grid-cols-4 gap-2">
                    {scoreFans.map((fan) => (
                      <button
                        className={`h-11 rounded-md border px-2 text-sm font-semibold ${
                          selectedFan === fan
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-300 bg-white text-stone-900"
                        }`}
                        key={fan}
                        onClick={() => {
                          setSelectedFan(fan);
                        }}
                        type="button"
                      >
                        {fan} 番
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-md border border-stone-200 bg-white p-3">
                  <p className="text-sm font-semibold text-stone-900">
                    {quickScoreMode === "DRAW_GAME"
                      ? "流局"
                      : `${getModePrimaryPlayerLabel(quickScoreMode)}：${selectedPrimaryPlayerId === undefined ? "未选择" : selectedPrimaryPlayerName}`}
                  </p>
                  {needsRelatedPlayer(quickScoreMode) ? (
                    <p className="mt-1 text-sm font-medium text-stone-500">
                      {getModeRelatedPlayerLabel(quickScoreMode)}：
                      {selectedRelatedPlayerId === undefined ? "未选择" : selectedRelatedPlayerName}
                    </p>
                  ) : null}
                  {needsFan(quickScoreMode) ? (
                    <p className="mt-1 text-sm font-medium text-stone-500">
                      番数：{selectedFan} 番 · {getFanScore(selectedFan)} 分
                    </p>
                  ) : null}
                  {quickScoreMissingMessage !== "" ? (
                    <p className="mt-2 text-xs font-medium text-stone-400">
                      {quickScoreMissingMessage}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="h-14 rounded-md bg-emerald-700 px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canRecordQuickScore}
                    onClick={() => {
                      void handleRecordQuickScore();
                    }}
                    type="button"
                  >
                    {isScoring ? "记录中..." : "确认记录"}
                  </button>
                  <button
                    className="h-14 rounded-md border border-red-200 bg-red-50 px-4 text-base font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canUndo || isUndoing || isScoring}
                    onClick={() => {
                      void handleUndoRoomEvent();
                    }}
                    type="button"
                  >
                    {isUndoing ? "撤销中..." : "撤销上一条"}
                  </button>
                </div>
                <button
                  className="h-12 rounded-md border border-stone-300 bg-white px-4 text-base font-semibold text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isScoring || isFinishing}
                  onClick={() => {
                    void handleFinishRoom();
                  }}
                  type="button"
                >
                  {isFinishing ? "结束中..." : "结束游戏"}
                </button>
              </div>
            ) : null}
            {isFinished ? <p className="text-sm leading-6 text-stone-500">本房间已经结束</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
