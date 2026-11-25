import { Connection, PublicKey } from "@solana/web3.js";
import {
  MAGICBLOCK_ER_RPC_URL,
  SOLANA_RPC_URL,
  TAPEDUEL_PROGRAM_ID,
} from "./config";
import {
  ACC_DISC,
  ArenaConfigAccount,
  GhostTapeAccount,
  PlayerVaultAccount,
  SprintRunAccount,
  decodeArenaConfig,
  decodeGhostTape,
  decodePlayerVault,
  decodeSprintRun,
  getArenaPda,
  getGhostPda,
  getTreasuryPda,
  getVaultPda,
} from "./codec";

let l1Conn: Connection | null = null;
let erConn: Connection | null = null;

export function getL1Connection(): Connection {
  if (!l1Conn) {
    l1Conn = new Connection(SOLANA_RPC_URL, "confirmed");
  }
  return l1Conn;
}

export function getErConnection(): Connection {
  if (!erConn) {
    erConn = new Connection(MAGICBLOCK_ER_RPC_URL, "confirmed");
  }
  return erConn;
}

export async function fetchArenaConfig(conn = getL1Connection()): Promise<ArenaConfigAccount | null> {
  const pda = getArenaPda();
  const info = await conn.getAccountInfo(pda);
  if (!info?.data) return null;
  return decodeArenaConfig(pda.toBase58(), info.data);
}

export async function fetchTreasuryBalanceLamports(conn = getL1Connection()): Promise<number> {
  const pda = getTreasuryPda();
  return conn.getBalance(pda);
}

export async function fetchPlayerVault(
  player: PublicKey,
  conn = getL1Connection()
): Promise<PlayerVaultAccount | null> {
  const pda = getVaultPda(player);
  const info = await conn.getAccountInfo(pda);
  if (!info?.data) return null;
  return decodePlayerVault(pda.toBase58(), info.data);
}

export async function fetchAllGhosts(conn = getL1Connection()): Promise<GhostTapeAccount[]> {
  const arena = await fetchArenaConfig(conn);
  if (!arena || arena.totalGhosts === 0) return [];

  const pdas: PublicKey[] = [];
  for (let id = 1; id <= arena.totalGhosts; id++) {
    pdas.push(getGhostPda(id));
  }
  const infos = await conn.getMultipleAccountsInfo(pdas);
  const ghosts: GhostTapeAccount[] = [];
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    if (info?.data) {
      try {
        ghosts.push(decodeGhostTape(pdas[i].toBase58(), info.data));
      } catch {
        // skip malformed accounts
      }
    }
  }
  return ghosts.sort((a, b) => a.ghostId - b.ghostId);
}

export async function fetchGhostById(
  ghostId: number,
  conn = getL1Connection()
): Promise<GhostTapeAccount | null> {
  const pda = getGhostPda(ghostId);
  const info = await conn.getAccountInfo(pda);
  if (!info?.data) return null;
  return decodeGhostTape(pda.toBase58(), info.data);
}

export async function fetchSprintAccount(
  sprintAddress: string,
  preferEr = false
): Promise<{ sprint: SprintRunAccount; source: "er" | "l1" } | null> {
  const pubkey = new PublicKey(sprintAddress);
  const order: Array<{ conn: Connection; source: "er" | "l1" }> = preferEr
    ? [
        { conn: getErConnection(), source: "er" },
        { conn: getL1Connection(), source: "l1" },
      ]
    : [
        { conn: getL1Connection(), source: "l1" },
        { conn: getErConnection(), source: "er" },
      ];

  for (const item of order) {
    try {
      const info = await item.conn.getAccountInfo(pubkey);
      if (info?.data && info.data.length >= 8) {
        return {
          sprint: decodeSprintRun(sprintAddress, info.data),
          source: item.source,
        };
      }
    } catch {
      // try next connection
    }
  }
  return null;
}

export async function fetchPlayerSprints(
  player: PublicKey,
  conn = getL1Connection()
): Promise<SprintRunAccount[]> {
  // Filter SprintRun accounts by discriminator + player pubkey at byte offset 16 (8 disc + 8 sprint_id)
  const accounts = await conn.getProgramAccounts(TAPEDUEL_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: Buffer.from(ACC_DISC.SprintRun).toString("base64"), encoding: "base64" } },
      { memcmp: { offset: 16, bytes: player.toBase58() } },
    ],
  });
  const sprints: SprintRunAccount[] = [];
  for (const acc of accounts) {
    try {
      sprints.push(decodeSprintRun(acc.pubkey.toBase58(), acc.account.data));
    } catch {
      // skip
    }
  }
  return sprints.sort((a, b) => b.sprintId - a.sprintId);
}
