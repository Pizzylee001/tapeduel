import { PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const MAGICBLOCK_ER_RPC_URL =
  process.env.NEXT_PUBLIC_MAGICBLOCK_ER_RPC_URL || "https://devnet-eu.magicblock.app";

export const MAGICBLOCK_ER_WS_URL =
  process.env.NEXT_PUBLIC_MAGICBLOCK_ER_WS_URL || "wss://devnet-eu.magicblock.app";

export const MAGICBLOCK_ER_VALIDATOR = new PublicKey(
  process.env.NEXT_PUBLIC_MAGICBLOCK_ER_VALIDATOR ||
    "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e"
);

export const TAPEDUEL_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TAPEDUEL_PROGRAM_ID ||
    "BdVNbT73iebJ3w396FeWiu3cvcQbe4fG1EZ138d1QpXi"
);

export const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);

export const MAGIC_PROGRAM_ID = new PublicKey(
  "Magic11111111111111111111111111111111111111"
);

export const MAGIC_CONTEXT_ID = new PublicKey(
  "MagicContext1111111111111111111111111111111"
);

export const VRF_PROGRAM_ID = new PublicKey(
  "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
);

export const VRF_BASE_QUEUE = new PublicKey(
  "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
);

export const VRF_ER_QUEUE = new PublicKey(
  "5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc"
);

export const SLOT_HASHES_SYSVAR = new PublicKey(
  "SysvarS1otHashes111111111111111111111111111"
);

// Verified MagicBlock Pyth Lazer Real-Time Price Feeds (Devnet ER)
export const PYTH_LAZER_PROGRAM_ID = new PublicKey(
  "PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd"
);

export const PYTH_FEEDS = {
  SOL: new PublicKey("ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu"),
  BTC: new PublicKey("71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr"),
  ETH: new PublicKey("5vaYr1hpv8yrSpu8w3K95x22byYxUJCCNCSYJtqVWPvG"),
} as const;

export const ARENA_SEED = Buffer.from("arena");
export const TREASURY_SEED = Buffer.from("treasury");
export const VAULT_SEED = Buffer.from("vault");
export const GHOST_SEED = Buffer.from("ghost");
export const SPRINT_SEED = Buffer.from("sprint");

export const LAMPORTS_PER_SOL_NUM = 1_000_000_000;
export const SPRINT_DURATION_SECS = 90;
export const MAX_MOVES = 16;

export const CARD_META = {
  1: {
    id: 1,
    name: "2x Boost",
    shortCode: "BST-2X",
    windowSecs: 15,
    summary: "Doubles portfolio PnL velocity for 15 seconds on live Pyth ticks.",
    accent: "gold",
  },
  2: {
    id: 2,
    name: "Drawdown Shield",
    shortCode: "SHD-00",
    windowSecs: 12,
    summary: "Absorbs negative mark-to-market ticks for 12 seconds while keeping upside.",
    accent: "long",
  },
  3: {
    id: 3,
    name: "Polarity Flip",
    shortCode: "FLP-180",
    windowSecs: 0,
    summary: "Instantly inverts every active Long and Short allocation across SOL, BTC, and ETH.",
    accent: "vrf",
  },
} as const;

export const REGIME_LABELS = ["Momentum", "Hedged", "Mean Reversion"] as const;

export function explorerTxUrl(signature: string, cluster: "devnet" | "er" = "devnet"): string {
  if (cluster === "er") {
    return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(
      MAGICBLOCK_ER_RPC_URL
    )}`;
  }
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: string, cluster: "devnet" | "er" = "devnet"): string {
  if (cluster === "er") {
    return `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${encodeURIComponent(
      MAGICBLOCK_ER_RPC_URL
    )}`;
  }
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
