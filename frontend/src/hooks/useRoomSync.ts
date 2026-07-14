import type { Dispatch, SetStateAction } from "react";
import type { RoomEvent, RoomRecord } from "@mah-score/shared";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildReplayEventsFromSnapshot, replayRoomEvents } from "@mah-score/shared";

import { getRoomDetail, syncRoomEvents } from "../api/roomApi";
import { takeInitialRoomDetail } from "../utils/initialRoomDetail";

type SyncStatus = "idle" | "syncing" | "error";

interface UseRoomSyncResult {
  readonly events: readonly RoomEvent[];
  readonly isLoading: boolean;
  readonly loadRoom: () => Promise<void>;
  readonly room: RoomRecord | undefined;
  readonly roomVersion: number;
  readonly syncStatus: SyncStatus;
}

function getHighestEventVersion(events: readonly RoomEvent[]): number {
  return events.reduce((version, event) => Math.max(version, event.version), 0);
}

function mergeRoomEvents(
  currentEvents: readonly RoomEvent[],
  incomingEvents: readonly RoomEvent[],
): readonly RoomEvent[] {
  if (incomingEvents.length === 0) {
    return currentEvents;
  }

  const currentEventIds = new Set(currentEvents.map((event) => event.id));
  const currentVersion = getHighestEventVersion(currentEvents);
  const newEvents = incomingEvents
    .filter((event) => event.version > currentVersion && !currentEventIds.has(event.id))
    .sort((leftEvent, rightEvent) => leftEvent.version - rightEvent.version);

  if (newEvents.length === 0) {
    return currentEvents;
  }

  return [...currentEvents, ...newEvents];
}

function replayRoomRecord(
  room: RoomRecord,
  events: readonly RoomEvent[],
  version: number,
): RoomRecord {
  const replayState = replayRoomEvents(
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

  return {
    ...room,
    version,
    players: replayState.players,
    status: replayState.status,
  };
}

export function useRoomSync(
  roomId: string,
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
): UseRoomSyncResult {
  const [events, setEvents] = useState<readonly RoomEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState<RoomRecord | undefined>();
  const [roomVersion, setRoomVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const eventsRef = useRef<readonly RoomEvent[]>([]);
  const roomRef = useRef<RoomRecord | undefined>(undefined);
  const roomVersionRef = useRef(0);
  const isSyncingRef = useRef(false);
  const syncStatusRef = useRef<SyncStatus>("idle");

  const updateSyncStatus = useCallback((nextSyncStatus: SyncStatus) => {
    if (syncStatusRef.current === nextSyncStatus) {
      return;
    }

    syncStatusRef.current = nextSyncStatus;
    setSyncStatus(nextSyncStatus);
  }, []);

  const loadRoom = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const initialRoomDetail = takeInitialRoomDetail(roomId);

      if (initialRoomDetail !== undefined) {
        setRoom(initialRoomDetail.room);
        setRoomVersion(initialRoomDetail.room.version);
        setEvents(initialRoomDetail.events);
        roomRef.current = initialRoomDetail.room;
        roomVersionRef.current = initialRoomDetail.room.version;
        eventsRef.current = initialRoomDetail.events;
        return;
      }

      const roomDetailResponse = await getRoomDetail(roomId);

      if (!roomDetailResponse.success) {
        setErrorMessage(roomDetailResponse.message);
        return;
      }

      setRoom(roomDetailResponse.data.room);
      setRoomVersion(roomDetailResponse.data.room.version);
      setEvents(roomDetailResponse.data.events);
      roomRef.current = roomDetailResponse.data.room;
      roomVersionRef.current = roomDetailResponse.data.room.version;
      eventsRef.current = roomDetailResponse.data.events;
    } catch {
      setErrorMessage("读取房间失败，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }, [roomId, setErrorMessage]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isSyncingRef.current) {
        return;
      }

      const currentVersion = Math.max(
        roomVersionRef.current,
        getHighestEventVersion(eventsRef.current),
      );

      isSyncingRef.current = true;

      void syncRoomEvents(roomId, currentVersion)
        .then((response) => {
          if (!response.success) {
            updateSyncStatus("error");
            return;
          }

          const latestVersion = Math.max(
            roomVersionRef.current,
            getHighestEventVersion(eventsRef.current),
          );

          if (response.data.version < latestVersion) {
            updateSyncStatus("idle");
            return;
          }

          if (response.data.events.length === 0) {
            roomVersionRef.current = response.data.version;
            updateSyncStatus("idle");
            return;
          }

          const mergedEvents = mergeRoomEvents(eventsRef.current, response.data.events);
          eventsRef.current = mergedEvents;
          setEvents(mergedEvents);

          const currentRoom = roomRef.current;

          if (currentRoom !== undefined) {
            const nextRoom = replayRoomRecord(currentRoom, mergedEvents, response.data.version);

            roomRef.current = nextRoom;
            setRoom(nextRoom);
          }

          roomVersionRef.current = response.data.version;
          setRoomVersion(response.data.version);
          updateSyncStatus("idle");
        })
        .catch(() => {
          updateSyncStatus("error");
        })
        .finally(() => {
          isSyncingRef.current = false;
        });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomId, updateSyncStatus]);

  return {
    events,
    isLoading,
    loadRoom,
    room,
    roomVersion,
    syncStatus,
  };
}
