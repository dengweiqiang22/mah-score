import assert from "node:assert/strict";

import {
  confirmDrawGame,
  getEntryActorId,
  getEntryCounterpartyId,
  getEntryFan,
  isSelectingFan,
  isWaitingForCounterparty,
  selectEntryEvent,
  selectEntryFan,
  selectEntryPlayer,
} from "../dist/index.js";

const idle = { type: "idle" };

const selectedPlayer = selectEntryPlayer(idle, "player_1", []);
assert.deepEqual(selectedPlayer, {
  state: { actorId: "player_1", type: "player_selected" },
});
assert.equal(getEntryActorId(selectedPlayer.state), "player_1");

const toggledPlayer = selectEntryPlayer(selectedPlayer.state, "player_1", []);
assert.deepEqual(toggledPlayer, { state: { type: "idle" } });

const selfDraw = selectEntryEvent(selectedPlayer.state, "SELF_DRAW");
assert.deepEqual(selfDraw, {
  state: { actorId: "player_1", type: "waiting_for_self_draw_fan" },
});
assert.equal(isSelectingFan(selfDraw.state), true);

const selfDrawSubmitted = selectEntryFan(selfDraw.state, 3);
assert.deepEqual(selfDrawSubmitted, {
  state: { actorId: "player_1", fan: 3, type: "self_draw_ready" },
  submitDraft: {
    action: "SELF_DRAW",
    fan: 3,
    winnerId: "player_1",
  },
});

const discardWin = selectEntryEvent(selectedPlayer.state, "DISCARD_WIN");
assert.deepEqual(discardWin, {
  state: { actorId: "player_1", type: "waiting_for_discard_win_counterparty" },
});
assert.equal(isWaitingForCounterparty(discardWin.state), true);

const invalidDiscarder = selectEntryPlayer(discardWin.state, "player_1", []);
assert.deepEqual(invalidDiscarder, {
  errorMessage: "点炮玩家不能和胡牌玩家相同。",
  state: discardWin.state,
});

const discardWinCounterparty = selectEntryPlayer(discardWin.state, "player_2", []);
assert.deepEqual(discardWinCounterparty, {
  state: {
    actorId: "player_1",
    counterpartyId: "player_2",
    type: "waiting_for_discard_win_fan",
  },
});
assert.equal(getEntryCounterpartyId(discardWinCounterparty.state), "player_2");
assert.equal(isSelectingFan(discardWinCounterparty.state), true);

const discardWinSubmitted = selectEntryFan(discardWinCounterparty.state, 2);
assert.deepEqual(discardWinSubmitted, {
  state: {
    actorId: "player_1",
    counterpartyId: "player_2",
    fan: 2,
    type: "discard_win_ready",
  },
  submitDraft: {
    action: "DISCARD_WIN",
    discarderId: "player_2",
    fan: 2,
    winnerId: "player_1",
  },
});
assert.equal(getEntryFan(discardWinSubmitted.state), 2);

const supplementKong = selectEntryEvent(selectedPlayer.state, "SUPPLEMENT_KONG");
assert.deepEqual(supplementKong, {
  state: {
    actorId: "player_1",
    kongType: "SUPPLEMENT_KONG",
    type: "shared_kong_ready",
  },
  submitDraft: {
    action: "KONG",
    kongType: "SUPPLEMENT_KONG",
    playerId: "player_1",
  },
});

const discardKong = selectEntryEvent(selectedPlayer.state, "DISCARD_KONG");
assert.deepEqual(discardKong, {
  state: { actorId: "player_1", type: "waiting_for_discard_kong_counterparty" },
});
assert.equal(isWaitingForCounterparty(discardKong.state), true);

const invalidKongCounterparty = selectEntryPlayer(discardKong.state, "player_1", []);
assert.deepEqual(invalidKongCounterparty, {
  errorMessage: "引杠玩家不能和杠牌玩家相同。",
  state: discardKong.state,
});

const discardKongSubmitted = selectEntryPlayer(discardKong.state, "player_3", []);
assert.deepEqual(discardKongSubmitted, {
  state: {
    actorId: "player_1",
    counterpartyId: "player_3",
    type: "discard_kong_ready",
  },
  submitDraft: {
    action: "KONG",
    fromPlayerId: "player_3",
    kongType: "DISCARD_KONG",
    playerId: "player_1",
  },
});

const eventWithoutActor = selectEntryEvent(idle, "SELF_DRAW");
assert.deepEqual(eventWithoutActor, {
  errorMessage: "请先选择玩家。",
  state: idle,
});

const blockedPlayer = selectEntryPlayer(idle, "player_4", ["player_4"]);
assert.deepEqual(blockedPlayer, { state: idle });

const drawConfirm = selectEntryEvent(idle, "DRAW_GAME");
assert.deepEqual(drawConfirm, { state: { type: "draw_confirm" } });
assert.deepEqual(confirmDrawGame(drawConfirm.state), {
  state: { type: "draw_confirm" },
  submitDraft: { action: "DRAW_GAME" },
});

const noFanBeforeEvent = selectEntryFan(selectedPlayer.state, 4);
assert.deepEqual(noFanBeforeEvent, { state: selectedPlayer.state });
