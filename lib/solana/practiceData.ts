import { GhostTapeAccount, TapeMove } from "./codec";

export interface PracticeGhostSpec extends GhostTapeAccount {
  isPracticeTape: true;
}

export interface LocalSprintRecord {
  id: string;
  mode: "onchain" | "practice";
  ghostId: number;
  ghostCallsign: string;
  ghostTargetBps: number;
  ghostMoves: TapeMove[];
  stakeLamports: number;
  entryPrices: [number, number, number];
  exitPrices: [number, number, number];
  finalPnlBps: number;
  challengerWon: boolean;
  cards: [number, number, number];
  cardsUsed: [boolean, boolean, boolean];
  moves: TapeMove[];
  curve: Array<{ sec: number; userBps: number; ghostBps: number }>;
  erReceipts: Array<{
    action: string;
    ms: number;
    sig: string;
    cluster: "er" | "devnet" | "local";
    ts: number;
  }>;
  entrySig?: string;
  vrfSig?: string;
  settleSig?: string;
  finalizeSig?: string;
  vrfSeedHex: string;
  sprintPda?: string;
  completedAt: number;
}

const LOCAL_REPLAY_KEY = "tapeduel:replays:v1";

/**
 * Practice Ghost Tapes used strictly for Live-Price Practice runs (paired with real MagicBlock ER Pyth Lazer prices)
 * or while the Devnet program awaits initial funding/seeding. Always badged explicitly in the UI.
 */
export const PRACTICE_GHOSTS: PracticeGhostSpec[] = [
  {
    address: "practice-ghost-1",
    ghostId: 1,
    creator: "2r8KJSJSQj3NPszmUnKXoHPxhympYVH9BPVuyURMbxUU",
    callsign: "SOL-SURGE-04",
    stakeLamports: 100_000_000,
    targetReturnBps: 142,
    regime: 0,
    wins: 0,
    losses: 0,
    bountyEarnedLamports: 0,
    unclaimedBountyLamports: 0,
    entryPrices: [BigInt(68_0000_0000), BigInt(59300_0000_0000), BigInt(1660_0000_0000)],
    exitPrices: [BigInt(68_9656_0000), BigInt(59560_0000_0000), BigInt(1655_0000_0000)],
    moves: [
      { elapsedSecs: 0, solW: 60, btcW: 20, ethW: 0, cardId: 0 },
      { elapsedSecs: 24, solW: 80, btcW: 0, ethW: 20, cardId: 1 },
      { elapsedSecs: 58, solW: 40, btcW: 20, ethW: 0, cardId: 2 },
      { elapsedSecs: 76, solW: 20, btcW: 0, ethW: 0, cardId: 0 },
    ],
    tapeHashHex: "4c92e8f17a60d1b3c584e29a7f310b4c62d8e5f9a1034b72e9c4158d2f6a3b10",
    sourceSprintId: 0,
    active: true,
    createdTs: 1764088800,
    bump: 255,
    isPracticeTape: true,
  },
  {
    address: "practice-ghost-2",
    ghostId: 2,
    creator: "2r8KJSJSQj3NPszmUnKXoHPxhympYVH9BPVuyURMbxUU",
    callsign: "DELTA-HEDGE-11",
    stakeLamports: 250_000_000,
    targetReturnBps: 88,
    regime: 1,
    wins: 0,
    losses: 0,
    bountyEarnedLamports: 0,
    unclaimedBountyLamports: 0,
    entryPrices: [BigInt(68_0000_0000), BigInt(59300_0000_0000), BigInt(1660_0000_0000)],
    exitPrices: [BigInt(68_5984_0000), BigInt(59050_0000_0000), BigInt(1668_0000_0000)],
    moves: [
      { elapsedSecs: 0, solW: 50, btcW: -40, ethW: 10, cardId: 0 },
      { elapsedSecs: 31, solW: 35, btcW: -35, ethW: 20, cardId: 2 },
      { elapsedSecs: 62, solW: -35, btcW: 35, ethW: -20, cardId: 3 },
    ],
    tapeHashHex: "9a17c3e45b82f01d6e29a48c7b35d1e8f2409c6a3b7d5e18a204f9c6b3d8e172",
    sourceSprintId: 0,
    active: true,
    createdTs: 1764088820,
    bump: 254,
    isPracticeTape: true,
  },
  {
    address: "practice-ghost-3",
    ghostId: 3,
    creator: "2r8KJSJSQj3NPszmUnKXoHPxhympYVH9BPVuyURMbxUU",
    callsign: "WHIPSAW-09",
    stakeLamports: 50_000_000,
    targetReturnBps: 196,
    regime: 2,
    wins: 0,
    losses: 0,
    bountyEarnedLamports: 0,
    unclaimedBountyLamports: 0,
    entryPrices: [BigInt(68_0000_0000), BigInt(59300_0000_0000), BigInt(1660_0000_0000)],
    exitPrices: [BigInt(69_3328_0000), BigInt(59610_0000_0000), BigInt(1674_0000_0000)],
    moves: [
      { elapsedSecs: 0, solW: -50, btcW: -20, ethW: 30, cardId: 0 },
      { elapsedSecs: 20, solW: 50, btcW: 20, ethW: -30, cardId: 3 },
      { elapsedSecs: 45, solW: 70, btcW: 0, ethW: 30, cardId: 1 },
      { elapsedSecs: 72, solW: 0, btcW: 0, ethW: 0, cardId: 2 },
    ],
    tapeHashHex: "e3b5a7d91c48f206a9d3e7b1c5f842a6d0e9b3c7f1a485d2e6b9c0f3a7d1e482",
    sourceSprintId: 0,
    active: true,
    createdTs: 1764088840,
    bump: 253,
    isPracticeTape: true,
  },
];

/**
 * Generates the smooth sealed pace line of a Ghost's target return across 0..90s
 * without revealing the Ghost's individual SOL/BTC/ETH weights until Replay unmask.
 */
export function ghostPaceAtSecond(targetReturnBps: number, sec: number): number {
  const t = Math.max(0, Math.min(90, sec)) / 90;
  // Deterministic S-curve + mild mid-sprint cadence ending at exact targetReturnBps
  const base = targetReturnBps * (0.35 * t + 0.65 * t * t);
  const ripple = Math.sin(t * Math.PI * 2.5) * Math.min(18, Math.abs(targetReturnBps) * 0.12) * (1 - t);
  return Math.round(base + ripple);
}

/**
 * Exact client-side mirror of Rust compute_mark_to_market_delta_bps for live 250ms HUD preview.
 */
export function computeClientMarkDeltaBps(
  weights: [number, number, number],
  prevPrices: [number, number, number],
  nextPrices: [number, number, number],
  activeCard: number,
  activeCardUntilMs: number,
  nowMs: number
): number {
  let raw = 0;
  for (let i = 0; i < 3; i++) {
    const prev = prevPrices[i];
    const next = nextPrices[i];
    if (prev <= 0 || next <= 0 || weights[i] === 0) continue;
    const assetBps = ((next - prev) / prev) * 10_000;
    raw += (assetBps * weights[i]) / 100;
  }
  const live = nowMs <= activeCardUntilMs;
  if (live && activeCard === 1) raw *= 2;
  if (live && activeCard === 2 && raw < 0) raw = 0;
  return Math.max(-5000, Math.min(5000, raw));
}

export function saveLocalSprintRecord(record: LocalSprintRecord): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadLocalSprintRecords();
    const filtered = existing.filter((r) => r.id !== record.id);
    const next = [record, ...filtered].slice(0, 20);
    window.localStorage.setItem(LOCAL_REPLAY_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}

export function loadLocalSprintRecords(): LocalSprintRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_REPLAY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalSprintRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadLocalSprintById(id: string): LocalSprintRecord | null {
  return loadLocalSprintRecords().find((r) => r.id === id) ?? null;
}

export function formatSol(lamports: number, decimals = 2): string {
  return (lamports / 1_000_000_000).toFixed(decimals);
}

export function formatBps(bps: number): string {
  const pct = (bps / 100).toFixed(2);
  return `${bps >= 0 ? "+" : ""}${pct}%`;
}

export function shortKey(key: string): string {
  if (!key || key.length < 10) return key;
  return `${key.slice(0, 4)}..${key.slice(-4)}`;
}
