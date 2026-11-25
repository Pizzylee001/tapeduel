import { Connection } from "@solana/web3.js";
import { MAGICBLOCK_ER_RPC_URL, PYTH_FEEDS } from "./config";

export interface PythAssetPrice {
  symbol: "SOL" | "BTC" | "ETH";
  rawPrice: bigint;
  priceUsd: number;
  exponent: number;
  publishTs: number;
  publishSlot: bigint;
}

export interface PythSnapshot {
  sol: PythAssetPrice;
  btc: PythAssetPrice;
  eth: PythAssetPrice;
  fetchedAtMs: number;
  latencyMs: number;
}

const PYTH_MIN_LEN = 134;
const PRICE_OFFSET = 73;
const EXP_OFFSET = 89;
const TS_OFFSET = 93;
const SLOT_OFFSET = 125;

/**
 * Decodes live MagicBlock Pyth Lazer 134-byte price accounts (verified on devnet-eu.magicblock.app).
 */
export function parsePythLazerAccount(
  symbol: "SOL" | "BTC" | "ETH",
  data: Uint8Array
): PythAssetPrice {
  if (data.byteLength < PYTH_MIN_LEN) {
    throw new Error(`Invalid Pyth Lazer account length for ${symbol}: ${data.byteLength}`);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const rawPrice = view.getBigInt64(PRICE_OFFSET, true);
  const expMagnitude = view.getInt32(EXP_OFFSET, true);
  const publishTs = Number(view.getBigInt64(TS_OFFSET, true));
  const publishSlot = view.getBigUint64(SLOT_OFFSET, true);

  const scale = Math.pow(10, Math.abs(expMagnitude || 8));
  const priceUsd = Number(rawPrice) / scale;

  return {
    symbol,
    rawPrice,
    priceUsd,
    exponent: -Math.abs(expMagnitude || 8),
    publishTs,
    publishSlot,
  };
}

let cachedErConnection: Connection | null = null;

function getErReadConnection(): Connection {
  if (!cachedErConnection) {
    cachedErConnection = new Connection(MAGICBLOCK_ER_RPC_URL, "confirmed");
  }
  return cachedErConnection;
}

/**
 * Fetches live SOL/USD, BTC/USD, and ETH/USD prices in a single batched RPC call to MagicBlock ER.
 */
export async function fetchLivePythSnapshot(connection?: Connection): Promise<PythSnapshot> {
  const conn = connection ?? getErReadConnection();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const accounts = await conn.getMultipleAccountsInfo([
    PYTH_FEEDS.SOL,
    PYTH_FEEDS.BTC,
    PYTH_FEEDS.ETH,
  ]);
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (!accounts[0]?.data || !accounts[1]?.data || !accounts[2]?.data) {
    throw new Error("MagicBlock Pyth Lazer price feeds returned empty account data");
  }

  return {
    sol: parsePythLazerAccount("SOL", accounts[0].data),
    btc: parsePythLazerAccount("BTC", accounts[1].data),
    eth: parsePythLazerAccount("ETH", accounts[2].data),
    fetchedAtMs: Date.now(),
    latencyMs: Math.max(1, Math.round(t1 - t0)),
  };
}
