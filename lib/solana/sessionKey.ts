import { Keypair } from "@solana/web3.js";

const STORAGE_PREFIX = "tapeduel:session:";

/**
 * Stores a sprint-scoped ephemeral Ed25519 session key in sessionStorage.
 * This key can ONLY sign gasless MagicBlock ER gameplay moves; L1 vault withdrawals strictly reject it.
 */
export function createAndStoreSprintSessionKey(sprintPda: string): Keypair {
  const kp = Keypair.generate();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        `${STORAGE_PREFIX}${sprintPda}`,
        JSON.stringify(Array.from(kp.secretKey))
      );
    } catch {
      // sessionStorage unavailable in restricted contexts; key stays in memory
    }
  }
  return kp;
}

export function loadSprintSessionKey(sprintPda: string): Keypair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${sprintPda}`);
    if (!raw) return null;
    const arr = JSON.parse(raw) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) return null;
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    return null;
  }
}

export function clearSprintSessionKey(sprintPda: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${sprintPda}`);
  } catch {
    // ignore
  }
}
