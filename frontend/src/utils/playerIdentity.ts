export interface StoredPlayerIdentity {
  readonly avatarId?: string;
  readonly roomId: string;
  readonly playerId: string;
  readonly nickname: string;
}

const storageKeyPrefix = "mah-score:room-player:";

function getStorageKey(roomId: string): string {
  return `${storageKeyPrefix}${roomId}`;
}

function parseStoredPlayerIdentity(value: string | null): StoredPlayerIdentity | undefined {
  if (value === null) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      !("roomId" in parsedValue) ||
      !("playerId" in parsedValue) ||
      !("nickname" in parsedValue) ||
      typeof parsedValue.roomId !== "string" ||
      typeof parsedValue.playerId !== "string" ||
      typeof parsedValue.nickname !== "string"
    ) {
      return undefined;
    }

    return {
      ...("avatarId" in parsedValue && typeof parsedValue.avatarId === "string"
        ? { avatarId: parsedValue.avatarId }
        : {}),
      roomId: parsedValue.roomId,
      playerId: parsedValue.playerId,
      nickname: parsedValue.nickname,
    };
  } catch {
    return undefined;
  }
}

export function savePlayerIdentity(identity: StoredPlayerIdentity): void {
  try {
    window.localStorage.setItem(getStorageKey(identity.roomId), JSON.stringify(identity));
  } catch {
    // 本地身份只是客户端辅助信息，写入失败不应阻断创建或加入房间。
  }
}

export function readPlayerIdentity(roomId: string): StoredPlayerIdentity | undefined {
  let value: string | null;

  try {
    value = window.localStorage.getItem(getStorageKey(roomId));
  } catch {
    return undefined;
  }

  const identity = parseStoredPlayerIdentity(value);

  if (identity?.roomId !== roomId) {
    return undefined;
  }

  return identity;
}
