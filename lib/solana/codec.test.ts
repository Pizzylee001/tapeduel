import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import {
  ACC_DISC,
  IX_DISC,
  buildActivateCardErIx,
  buildCreateSprintIx,
  buildDelegateSprintIx,
  buildRebalanceErIx,
  buildRequestVrfCardsIx,
  buildSettleAndUndelegateErIx,
  decodeArenaConfig,
  decodePlayerVault,
  getArenaPda,
  getGhostPda,
  getSprintPda,
  getVaultPda,
} from "./codec";
import { MAGICBLOCK_ER_VALIDATOR, VRF_ER_QUEUE } from "./config";
import { fetchLivePythSnapshot, parsePythLazerAccount } from "./pyth";
import idl from "../../idl/tapeduel.json";

test("all instruction discriminators match generated Anchor IDL byte-for-byte", () => {
  for (const [name, disc] of Object.entries(IX_DISC)) {
    const idlIx = idl.instructions.find((ix) => ix.name === name);
    assert.ok(idlIx, `Missing instruction ${name} in idl/tapeduel.json`);
    assert.deepEqual(Array.from(disc), idlIx.discriminator, `Mismatch for ${name}`);
  }
});

test("all account discriminators match generated Anchor IDL byte-for-byte", () => {
  for (const [name, disc] of Object.entries(ACC_DISC)) {
    const idlAcc = idl.accounts.find((a) => a.name === name);
    assert.ok(idlAcc, `Missing account ${name} in idl/tapeduel.json`);
    assert.deepEqual(Array.from(disc), idlAcc.discriminator, `Mismatch for ${name}`);
  }
});

test("instruction account counts match generated Anchor IDL", () => {
  const player = Keypair.generate().publicKey;
  const session = Keypair.generate().publicKey;
  const sprintPda = getSprintPda(player, 0);

  const createIx = buildCreateSprintIx({
    player,
    sprintNonce: 0,
    ghostId: 1,
    sessionKey: session,
    stakeLamports: 100_000_000,
    validator: MAGICBLOCK_ER_VALIDATOR,
  });
  assert.equal(createIx.keys.length, 6);

  const delegateIx = buildDelegateSprintIx({
    payer: player,
    sprintPda,
    sprintNonce: 0,
    validator: MAGICBLOCK_ER_VALIDATOR,
  });
  // 8 base accounts + 1 remaining account (validator)
  assert.equal(delegateIx.keys.length, 9);
  assert.equal(delegateIx.keys[0].isWritable, true);

  const vrfIx = buildRequestVrfCardsIx({
    payer: session,
    sprintPda,
    oracleQueue: VRF_ER_QUEUE,
    clientSeed: 42,
  });
  assert.equal(vrfIx.keys.length, 7);

  const rebIx = buildRebalanceErIx({
    authority: session,
    sprintPda,
    newWeights: [50, -30, 20],
  });
  assert.equal(rebIx.keys.length, 5);
  assert.equal(rebIx.data.length, 11); // 8 disc + 3 signed i8

  const cardIx = buildActivateCardErIx({
    authority: session,
    sprintPda,
    slot: 1,
  });
  assert.equal(cardIx.keys.length, 5);

  const settleIx = buildSettleAndUndelegateErIx({
    payer: session,
    sprintPda,
  });
  assert.equal(settleIx.keys.length, 7);
});

test("decodeArenaConfig and decodePlayerVault round-trip correctly", () => {
  const auth = Keypair.generate().publicKey;
  const buf = new Uint8Array(8 + 57);
  buf.set(ACC_DISC.ArenaConfig, 0);
  buf.set(auth.toBytes(), 8);
  const v = new DataView(buf.buffer);
  v.setBigUint64(40, BigInt(12), true);
  v.setBigUint64(48, BigInt(3), true);
  v.setBigUint64(56, BigInt(1_500_000_000), true);
  buf[64] = 254;

  const arena = decodeArenaConfig(getArenaPda().toBase58(), buf);
  assert.equal(arena.authority, auth.toBase58());
  assert.equal(arena.totalSprints, 12);
  assert.equal(arena.totalGhosts, 3);
  assert.equal(arena.totalVolumeLamports, 1_500_000_000);
  assert.equal(arena.bump, 254);

  const vBuf = new Uint8Array(8 + 65);
  vBuf.set(ACC_DISC.PlayerVault, 0);
  vBuf.set(auth.toBytes(), 8);
  const vv = new DataView(vBuf.buffer);
  vv.setBigUint64(40, BigInt(500_000_000), true);
  vv.setBigUint64(48, BigInt(100_000_000), true);
  vv.setUint32(56, 4, true);
  vv.setUint32(60, 2, true);
  vv.setBigUint64(64, BigInt(6), true);
  vBuf[72] = 251;

  const vault = decodePlayerVault(getVaultPda(auth).toBase58(), vBuf);
  assert.equal(vault.availableLamports, 500_000_000);
  assert.equal(vault.lockedLamports, 100_000_000);
  assert.equal(vault.totalWins, 4);
  assert.equal(vault.totalLosses, 2);
  assert.equal(vault.sprintNonce, 6);
  assert.ok(getGhostPda(1).toBase58().length > 30);
});

test("parsePythLazerAccount decodes verified 134-byte format and live ER feed returns valid prices", async () => {
  const synthetic = new Uint8Array(134);
  const dv = new DataView(synthetic.buffer);
  dv.setBigInt64(73, BigInt(6_738_359_875), true);
  dv.setInt32(89, 8, true);
  dv.setBigInt64(93, BigInt(1_764_088_700), true);
  dv.setBigUint64(125, BigInt(420_000_000), true);

  const parsed = parsePythLazerAccount("SOL", synthetic);
  assert.ok(Math.abs(parsed.priceUsd - 67.38359875) < 1e-6);

  // Live probe against MagicBlock devnet-eu Pyth Lazer feeds
  const live = await fetchLivePythSnapshot();
  assert.ok(live.sol.priceUsd > 5 && live.sol.priceUsd < 5000, `Unexpected SOL price: ${live.sol.priceUsd}`);
  assert.ok(live.btc.priceUsd > 5000 && live.btc.priceUsd < 500000, `Unexpected BTC price: ${live.btc.priceUsd}`);
  assert.ok(live.eth.priceUsd > 100 && live.eth.priceUsd < 50000, `Unexpected ETH price: ${live.eth.priceUsd}`);
  console.log(
    `Live MagicBlock ER Pyth Lazer (${live.latencyMs}ms): SOL=$${live.sol.priceUsd.toFixed(
      2
    )} BTC=$${live.btc.priceUsd.toFixed(2)} ETH=$${live.eth.priceUsd.toFixed(2)}`
  );
});
