import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";

const locks = new Map();

async function withRoomLock(roomId, operation) {
  const token = randomUUID();

  if (locks.has(roomId)) {
    throw new Error("ROOM_BUSY");
  }

  locks.set(roomId, token);

  try {
    return await operation();
  } finally {
    if (locks.get(roomId) === token) {
      locks.delete(roomId);
    }
  }
}

async function expectRoomBusy(promise) {
  try {
    await promise;
    assert.fail("expected ROOM_BUSY");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "ROOM_BUSY");
  }
}

async function main() {
  let firstOperationStarted = false;
  let releaseFirstOperation;
  const firstOperationFinished = new Promise((resolve) => {
    releaseFirstOperation = resolve;
  });

  const firstRun = withRoomLock("123", async () => {
    firstOperationStarted = true;
    await firstOperationFinished;
    return "ok";
  });

  while (!firstOperationStarted) {
    await Promise.resolve();
  }

  await expectRoomBusy(withRoomLock("123", async () => "should not run"));

  releaseFirstOperation();
  assert.equal(await firstRun, "ok");

  let thrown = false;

  await withRoomLock("456", async () => {
    thrown = true;
    throw new Error("boom");
  }).catch((error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "boom");
  });

  assert.equal(thrown, true);

  const retryResult = await withRoomLock("456", async () => "retry ok");
  assert.equal(retryResult, "retry ok");

  process.stdout.write("Room lock acceptance checks passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
