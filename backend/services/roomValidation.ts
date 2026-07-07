export function isValidRoomId(roomId: string): boolean {
  return /^\d{3}$/u.test(roomId);
}

export function isValidNickname(nickname: string): boolean {
  return nickname.length > 0 && nickname.length <= 12;
}

export function isExpectedPlayerEditError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "ROOM_NOT_FOUND" ||
      error.message === "ROOM_BUSY" ||
      error.message === "ROOM_NOT_EDITABLE" ||
      error.message === "ROOM_NOT_STARTABLE" ||
      error.message === "PLAYER_NOT_FOUND" ||
      error.message === "PLAYER_NICKNAME_EXISTS")
  );
}
