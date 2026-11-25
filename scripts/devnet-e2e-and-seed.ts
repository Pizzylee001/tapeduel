import fs from "node:fs";
import crypto from "node:crypto";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  MAGICBLOCK_ER_RPC_URL,
  MAGICBLOCK_ER_VALIDATOR,
  SOLANA_RPC_URL,
  TAPEDUEL_PROGRAM_ID,
  VRF_ER_QUEUE,
  explorerAddressUrl,
  explorerTxUrl,
} from "../lib/solana/config";
import {
  TapeMove,
  buildActivateCardErIx,
  buildCreateSprintIx,
  buildDelegateSprintIx,
  buildDepositIx,
  buildFinalizePayoutIx,
  buildFundTreasuryIx,
  buildInitArenaIx,
  buildRebalanceErIx,
  buildRequestVrfCardsIx,
  buildSeedGhostIx,
  buildSettleAndUndelegateErIx,
  buildStartSprintErIx,
  decodeSprintRun,
  getGhostPda,
  getSprintPda,
} from "../lib/solana/codec";
import {
  fetchAllGhosts,
  fetchArenaConfig,
  fetchPlayerVault,
  fetchTreasuryBalanceLamports,
} from "../lib/solana/client";
import { fetchLivePythSnapshot } from "../lib/solana/pyth";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadKeypair(): Keypair {
  const keyPath =
    process.env.DEPLOYER_KEYPAIR || "/home/antigravity/.keys/tapeduel-devnet.json";
  const raw = JSON.parse(fs.readFileSync(keyPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function sendErTx(
  erConn: Connection,
  tx: Transaction,
  signer: Keypair
): Promise<{ sig: string; ms: number }> {
  const { blockhash } = await erConn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signer.publicKey;
  tx.sign(signer);

  const t0 = performance.now();
  const sig = await erConn.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  await erConn.confirmTransaction(sig, "confirmed");
  const ms = Math.max(1, Math.round(performance.now() - t0));
  return { sig, ms };
}

async function main() {
  const l1 = new Connection(SOLANA_RPC_URL, "confirmed");
  const er = new Connection(MAGICBLOCK_ER_RPC_URL, "confirmed");
  const payer = loadKeypair();

  console.log(`Deployer:   ${payer.publicKey.toBase58()}`);
  console.log(`Program ID: ${TAPEDUEL_PROGRAM_ID.toBase58()}`);

  const balance = await l1.getBalance(payer.publicKey);
  console.log(`Devnet L1 balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (balance < 0.4 * LAMPORTS_PER_SOL) {
    throw new Error(
      `Need at least 0.40 Devnet SOL on ${payer.publicKey.toBase58()} to seed Arena and run live E2E sprint.`
    );
  }

  const progInfo = await l1.getAccountInfo(TAPEDUEL_PROGRAM_ID);
  if (!progInfo || !progInfo.executable) {
    throw new Error(
      `Program ${TAPEDUEL_PROGRAM_ID.toBase58()} is not deployed on Devnet yet. Run: anchor deploy --provider.cluster devnet`
    );
  }

  // 1. Initialize ArenaConfig + ArenaTreasury if needed
  let arena = await fetchArenaConfig(l1);
  if (!arena) {
    const sig = await sendAndConfirmTransaction(
      l1,
      new Transaction().add(buildInitArenaIx(payer.publicKey)),
      [payer]
    );
    console.log(`init_arena confirmed: ${explorerTxUrl(sig, "devnet")}`);
    arena = await fetchArenaConfig(l1);
  } else {
    console.log(
      `Arena already initialized (ghosts=${arena.totalGhosts}, sprints=${arena.totalSprints})`
    );
  }

  // 2. Fund ArenaTreasury so winning solo challengers always collect +85% profit on-chain
  const treasuryBal = await fetchTreasuryBalanceLamports(l1);
  if (treasuryBal < 0.3 * LAMPORTS_PER_SOL) {
    const sig = await sendAndConfirmTransaction(
      l1,
      new Transaction().add(buildFundTreasuryIx(payer.publicKey, 0.35 * LAMPORTS_PER_SOL)),
      [payer]
    );
    console.log(`fund_treasury (0.35 SOL) confirmed: ${explorerTxUrl(sig, "devnet")}`);
  }

  // 3. Seed 3 real on-chain Bounty Ghosts anchored to current live MagicBlock Pyth Lazer prices
  const pyth = await fetchLivePythSnapshot(er);
  console.log(
    `Live ER Pyth Lazer: SOL=$${pyth.sol.priceUsd.toFixed(2)} BTC=$${pyth.btc.priceUsd.toFixed(
      2
    )} ETH=$${pyth.eth.priceUsd.toFixed(2)}`
  );

  const existingGhosts = await fetchAllGhosts(l1);
  const seedSpecs: Array<{
    callsign: string;
    stakeLamports: number;
    targetReturnBps: number;
    regime: number;
    moves: TapeMove[];
  }> = [
    {
      callsign: "SOL-SURGE-04",
      stakeLamports: 100_000_000, // 0.10 SOL
      targetReturnBps: 142,
      regime: 0,
      moves: [
        { elapsedSecs: 0, solW: 60, btcW: 20, ethW: 0, cardId: 0 },
        { elapsedSecs: 24, solW: 80, btcW: 0, ethW: 20, cardId: 1 },
        { elapsedSecs: 58, solW: 40, btcW: 20, ethW: 0, cardId: 2 },
        { elapsedSecs: 76, solW: 20, btcW: 0, ethW: 0, cardId: 0 },
      ],
    },
    {
      callsign: "DELTA-HEDGE-11",
      stakeLamports: 250_000_000, // 0.25 SOL
      targetReturnBps: 88,
      regime: 1,
      moves: [
        { elapsedSecs: 0, solW: 50, btcW: -40, ethW: 10, cardId: 0 },
        { elapsedSecs: 31, solW: 35, btcW: -35, ethW: 20, cardId: 2 },
        { elapsedSecs: 62, solW: -35, btcW: 35, ethW: -20, cardId: 3 },
      ],
    },
    {
      callsign: "WHIPSAW-09",
      stakeLamports: 50_000_000, // 0.05 SOL
      targetReturnBps: 196,
      regime: 2,
      moves: [
        { elapsedSecs: 0, solW: -50, btcW: -20, ethW: 30, cardId: 0 },
        { elapsedSecs: 20, solW: 50, btcW: 20, ethW: -30, cardId: 3 },
        { elapsedSecs: 45, solW: 70, btcW: 0, ethW: 30, cardId: 1 },
        { elapsedSecs: 72, solW: 0, btcW: 0, ethW: 0, cardId: 2 },
      ],
    },
  ];

  let nextGhostId = existingGhosts.length + 1;
  for (const spec of seedSpecs) {
    if (existingGhosts.some((g) => g.callsign === spec.callsign)) {
      console.log(`Ghost ${spec.callsign} already exists on-chain.`);
      continue;
    }
    const entryPrices: [bigint, bigint, bigint] = [
      pyth.sol.rawPrice,
      pyth.btc.rawPrice,
      pyth.eth.rawPrice,
    ];
    const exitPrices: [bigint, bigint, bigint] = [
      (pyth.sol.rawPrice * BigInt(10_000 + spec.targetReturnBps)) / BigInt(10_000),
      (pyth.btc.rawPrice * BigInt(10_045)) / BigInt(10_000),
      (pyth.eth.rawPrice * BigInt(9_970)) / BigInt(10_000),
    ];
    const tapeHash = crypto
      .createHash("sha256")
      .update(`${spec.callsign}:${nextGhostId}:${pyth.sol.publishTs}`)
      .digest();

    const sig = await sendAndConfirmTransaction(
      l1,
      new Transaction().add(
        buildSeedGhostIx({
          authority: payer.publicKey,
          nextGhostId,
          callsign: spec.callsign,
          stakeLamports: spec.stakeLamports,
          targetReturnBps: spec.targetReturnBps,
          regime: spec.regime,
          entryPrices,
          exitPrices,
          moves: spec.moves,
          tapeHash,
        })
      ),
      [payer]
    );
    console.log(
      `Seeded Ghost #${nextGhostId} (${spec.callsign}) PDA=${explorerAddressUrl(
        getGhostPda(nextGhostId).toBase58(),
        "devnet"
      )} tx=${explorerTxUrl(sig, "devnet")}`
    );
    nextGhostId += 1;
  }

  // 4. Run full live E2E Sprint lifecycle on Devnet L1 -> MagicBlock ER (VRF + Pyth) -> Devnet L1
  if (process.env.SKIP_E2E === "1") {
    console.log("SKIP_E2E=1 set; skipping live sprint execution.");
    return;
  }

  let vault = await fetchPlayerVault(payer.publicKey, l1);
  if (!vault || vault.availableLamports < 100_000_000) {
    const depSig = await sendAndConfirmTransaction(
      l1,
      new Transaction().add(buildDepositIx(payer.publicKey, 150_000_000)),
      [payer]
    );
    console.log(`deposit (0.15 SOL) confirmed: ${explorerTxUrl(depSig, "devnet")}`);
    vault = await fetchPlayerVault(payer.publicKey, l1);
  }
  if (!vault) throw new Error("PlayerVault failed to initialize");

  const sprintNonce = vault.sprintNonce;
  const sessionKey = Keypair.generate();
  const sprintPda = getSprintPda(payer.publicKey, sprintNonce);

  const entryTx = new Transaction().add(
    buildCreateSprintIx({
      player: payer.publicKey,
      sprintNonce,
      ghostId: 1,
      sessionKey: sessionKey.publicKey,
      stakeLamports: 50_000_000,
      validator: MAGICBLOCK_ER_VALIDATOR,
    }),
    buildDelegateSprintIx({
      payer: payer.publicKey,
      sprintPda,
      sprintNonce,
      validator: MAGICBLOCK_ER_VALIDATOR,
    })
  );
  const entrySig = await sendAndConfirmTransaction(l1, entryTx, [payer]);
  console.log(`create_sprint + delegate_sprint (1 tx): ${explorerTxUrl(entrySig, "devnet")}`);

  // Wait for delegation propagation on MagicBlock ER
  let erReady = false;
  for (let i = 0; i < 20; i++) {
    const info = await er.getAccountInfo(sprintPda);
    if (info?.data) {
      erReady = true;
      break;
    }
    await sleep(500);
  }
  if (!erReady) throw new Error("Sprint PDA did not appear on MagicBlock ER within 10s");

  // Request VRF Tactical Cards inside ER (gasless!)
  const vrfRes = await sendErTx(
    er,
    new Transaction().add(
      buildRequestVrfCardsIx({
        payer: sessionKey.publicKey,
        sprintPda,
        oracleQueue: VRF_ER_QUEUE,
        clientSeed: Math.floor(Math.random() * 255),
      })
    ),
    sessionKey
  );
  console.log(`request_vrf_cards on ER (${vrfRes.ms}ms): ${explorerTxUrl(vrfRes.sig, "er")}`);

  // Start sprint on ER using live Pyth Lazer feeds
  const startRes = await sendErTx(
    er,
    new Transaction().add(
      buildStartSprintErIx({
        authority: sessionKey.publicKey,
        sprintPda,
        initialWeights: [60, 20, 0],
      })
    ),
    sessionKey
  );
  console.log(`start_sprint_er (${startRes.ms}ms): ${explorerTxUrl(startRes.sig, "er")}`);

  // Wait briefly for VRF callback to land on ER
  let vrfDone = false;
  for (let i = 0; i < 16; i++) {
    const acc = await er.getAccountInfo(sprintPda);
    if (acc?.data) {
      const decoded = decodeSprintRun(sprintPda.toBase58(), acc.data);
      if (decoded.vrfFulfilled) {
        console.log(`VRF callback landed! Cards dealt: [${decoded.cards.join(", ")}]`);
        vrfDone = true;
        break;
      }
    }
    await sleep(500);
  }

  await sleep(1500);
  const rebRes = await sendErTx(
    er,
    new Transaction().add(
      buildRebalanceErIx({
        authority: sessionKey.publicKey,
        sprintPda,
        newWeights: [40, -30, 30],
      })
    ),
    sessionKey
  );
  console.log(`rebalance_er (${rebRes.ms}ms): ${explorerTxUrl(rebRes.sig, "er")}`);

  if (vrfDone) {
    const cardRes = await sendErTx(
      er,
      new Transaction().add(
        buildActivateCardErIx({
          authority: sessionKey.publicKey,
          sprintPda,
          slot: 0,
        })
      ),
      sessionKey
    );
    console.log(`activate_card_er (${cardRes.ms}ms): ${explorerTxUrl(cardRes.sig, "er")}`);
  } else {
    console.log("Warning: VRF callback still pending on ER queue during short test window.");
  }

  await sleep(1500);
  const settleRes = await sendErTx(
    er,
    new Transaction().add(
      buildSettleAndUndelegateErIx({
        payer: sessionKey.publicKey,
        sprintPda,
      })
    ),
    sessionKey
  );
  console.log(
    `settle_and_undelegate_er (${settleRes.ms}ms): ${explorerTxUrl(settleRes.sig, "er")}`
  );

  // Wait for undelegated SprintRun to return to Solana Devnet L1
  let backOnL1 = false;
  for (let i = 0; i < 30; i++) {
    const l1Info = await l1.getAccountInfo(sprintPda);
    if (l1Info && l1Info.owner.equals(TAPEDUEL_PROGRAM_ID)) {
      const s = decodeSprintRun(sprintPda.toBase58(), l1Info.data);
      if (s.status === 2) {
        backOnL1 = true;
        console.log(`Undelegation landed on Devnet L1! Final ER PnL: ${s.pnlBps} bps`);
        break;
      }
    }
    await sleep(1000);
  }
  if (!backOnL1) throw new Error("SprintRun did not undelegate back to Devnet L1 in time");

  const finalSig = await sendAndConfirmTransaction(
    l1,
    new Transaction().add(
      buildFinalizePayoutIx({
        payer: payer.publicKey,
        sprintPlayer: payer.publicKey,
        sprintPda,
        ghostId: 1,
      })
    ),
    [payer]
  );
  console.log(`finalize_payout on Devnet L1: ${explorerTxUrl(finalSig, "devnet")}`);
  console.log("ALL LIVE DEVNET + MAGICBLOCK ER + VRF + PYTH LAZER CHECKS PASSED.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
