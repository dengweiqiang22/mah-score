const roomIdRange = 1000;

export function createCandidateRoomId(): string {
  return Math.floor(Math.random() * roomIdRange).toString().padStart(3, "0");
}
