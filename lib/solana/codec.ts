import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ARENA_SEED,
  DELEGATION_PROGRAM_ID,
  GHOST_SEED,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  MAX_MOVES,
  PYTH_FEEDS,
  SLOT_HASHES_SYSVAR,
  SPRINT_SEED,
  TAPEDUEL_PROGRAM_ID,
  TREASURY_SEED,
  VAULT_SEED,
  VRF_PROGRAM_ID,
} from "./config";

export interface TapeMove {
  elapsedSecs: number;
  solW: number;
  btcW: number;
  ethW: number;
  cardId: number;
}

export interface ArenaConfigAccount {
  address: string;
  authority: string;
  totalSprints: number;
  totalGhosts: number;
  totalVolumeLamports: number;
  bump: number;
}

export interface PlayerVaultAccount {
  address: string;
  owner: string;
  availableLamports: number;
  lockedLamports: number;
  totalWins: number;
  totalLosses: number;
  sprintNonce: number;
  bump: number;
}

export interface GhostTapeAccount {
  address: string;
  ghostId: number;
  creator: string;
  callsign: string;
  stakeLamports: number;
  targetReturnBps: number;
  regime: number;
  wins: number;
  losses: number;
  bountyEarnedLamports: number;
  unclaimedBountyLamports: number;
  entryPrices: [bigint, bigint, bigint];
  exitPrices: [bigint, bigint, bigint];
  moves: TapeMove[];
  tapeHashHex: string;
  sourceSprintId: number;
  active: boolean;
  createdTs: number;
  bump: number;
}

export interface SprintRunAccount {
  address: string;
  sprintId: number;
  player: string;
  sessionKey: string;
  ghostId: number;
  stakeLamports: number;
  status: number;
  startTs: number;
  endTs: number;
  lastMarkTs: number;
  settledTs: number;
  entryPrices: [bigint, bigint, bigint];
  lastPrices: [bigint, bigint, bigint];
  weights: [number, number, number];
  pnlBps: number;
  cards: [number, number, number];
  cardsUsed: [boolean, boolean, boolean];
  activeCard: number;
  activeCardUntil: number;
  vrfRequested: boolean;
  vrfFulfilled: boolean;
  vrfSeedHex: string;
  moves: TapeMove[];
  publishedAsGhost: boolean;
  challengerWon: boolean;
  delegatedValidator: string;
  bump: number;
}

// Verified exact 8-byte Anchor discriminators from idl/tapeduel.json
export const IX_DISC = {
  init_arena: Uint8Array.from([24, 246, 252, 176, 155, 175, 123, 124]),
  fund_treasury: Uint8Array.from([71, 154, 45, 220, 206, 32, 174, 239]),
  deposit: Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]),
  withdraw: Uint8Array.from([183, 18, 70, 156, 148, 109, 161, 34]),
  create_sprint: Uint8Array.from([112, 58, 167, 87, 77, 201, 10, 179]),
  delegate_sprint: Uint8Array.from([63, 162, 68, 73, 65, 219, 229, 250]),
  request_vrf_cards: Uint8Array.from([157, 214, 43, 104, 63, 207, 46, 186]),
  start_sprint_er: Uint8Array.from([5, 215, 85, 224, 46, 185, 211, 69]),
  rebalance_er: Uint8Array.from([100, 130, 191, 26, 186, 188, 4, 82]),
  activate_card_er: Uint8Array.from([89, 62, 57, 146, 5, 225, 74, 122]),
  settle_and_undelegate_er: Uint8Array.from([60, 159, 21, 12, 44, 89, 49, 204]),
  finalize_payout: Uint8Array.from([80, 105, 227, 22, 73, 169, 249, 67]),
  publish_ghost: Uint8Array.from([68, 100, 209, 236, 165, 155, 44, 173]),
  seed_ghost: Uint8Array.from([179, 57, 172, 42, 249, 220, 79, 105]),
  claim_bounty: Uint8Array.from([225, 157, 163, 238, 239, 169, 75, 226]),
} as const;

export const ACC_DISC = {
  ArenaConfig: Uint8Array.from([9, 186, 181, 145, 197, 50, 33, 38]),
  ArenaTreasury: Uint8Array.from([69, 180, 122, 250, 248, 80, 177, 18]),
  GhostTape: Uint8Array.from([63, 0, 232, 183, 131, 241, 69, 243]),
  PlayerVault: Uint8Array.from([37, 59, 99, 224, 234, 233, 179, 185]),
  SprintRun: Uint8Array.from([241, 241, 225, 114, 197, 8, 84, 245]),
} as const;

function u64LeBytes(value: number | bigint): Uint8Array {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, BigInt(value), true);
  return out;
}

function i32LeBytes(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setInt32(0, value, true);
  return out;
}

function i64LeBytes(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setBigInt64(0, value, true);
  return out;
}

function u16LeBytes(value: number): Uint8Array {
  const out = new Uint8Array(2);
  const view = new DataView(out.buffer);
  view.setUint16(0, value, true);
  return out;
}

function u32LeBytes(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value, true);
  return out;
}

function encodeString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return concatBytes(u32LeBytes(bytes.length), bytes);
}

function concatBytes(...chunks: Uint8Array[]): Buffer {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(out);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasDisc(data: Uint8Array, expected: Uint8Array): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

// PDA derivations
export function getArenaPda(programId = TAPEDUEL_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([ARENA_SEED], programId)[0];
}

export function getTreasuryPda(programId = TAPEDUEL_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], programId)[0];
}

export function getVaultPda(player: PublicKey, programId = TAPEDUEL_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([VAULT_SEED, player.toBuffer()], programId)[0];
}

export function getGhostPda(ghostId: number | bigint, programId = TAPEDUEL_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(
    [GHOST_SEED, Buffer.from(u64LeBytes(ghostId))],
    programId
  )[0];
}

export function getSprintPda(
  player: PublicKey,
  sprintNonce: number | bigint,
  programId = TAPEDUEL_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SPRINT_SEED, player.toBuffer(), Buffer.from(u64LeBytes(sprintNonce))],
    programId
  )[0];
}

export function getProgramIdentityPda(programId = TAPEDUEL_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("identity")], programId)[0];
}

export function getDelegationBufferPda(
  delegatedAccount: PublicKey,
  ownerProgramId = TAPEDUEL_PROGRAM_ID
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), delegatedAccount.toBuffer()],
    ownerProgramId
  )[0];
}

export function getDelegationRecordPda(delegatedAccount: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), delegatedAccount.toBuffer()],
    DELEGATION_PROGRAM_ID
  )[0];
}

export function getDelegationMetadataPda(delegatedAccount: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), delegatedAccount.toBuffer()],
    DELEGATION_PROGRAM_ID
  )[0];
}

// Account decoders
export function decodeArenaConfig(address: string, data: Uint8Array): ArenaConfigAccount {
  if (!hasDisc(data, ACC_DISC.ArenaConfig)) {
    throw new Error("Invalid ArenaConfig discriminator");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const authority = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const totalSprints = Number(view.getBigUint64(o, true));
  o += 8;
  const totalGhosts = Number(view.getBigUint64(o, true));
  o += 8;
  const totalVolumeLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const bump = data[o];
  return { address, authority, totalSprints, totalGhosts, totalVolumeLamports, bump };
}

export function decodePlayerVault(address: string, data: Uint8Array): PlayerVaultAccount {
  if (!hasDisc(data, ACC_DISC.PlayerVault)) {
    throw new Error("Invalid PlayerVault discriminator");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const owner = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const availableLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const lockedLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const totalWins = view.getUint32(o, true);
  o += 4;
  const totalLosses = view.getUint32(o, true);
  o += 4;
  const sprintNonce = Number(view.getBigUint64(o, true));
  o += 8;
  const bump = data[o];
  return {
    address,
    owner,
    availableLamports,
    lockedLamports,
    totalWins,
    totalLosses,
    sprintNonce,
    bump,
  };
}

function decodeMovesArray(data: Uint8Array, view: DataView, startOffset: number, moveCount: number): TapeMove[] {
  const count = Math.min(moveCount, MAX_MOVES);
  const moves: TapeMove[] = [];
  for (let i = 0; i < count; i++) {
    const o = startOffset + i * 6;
    moves.push({
      elapsedSecs: view.getUint16(o, true),
      solW: view.getInt8(o + 2),
      btcW: view.getInt8(o + 3),
      ethW: view.getInt8(o + 4),
      cardId: data[o + 5],
    });
  }
  return moves;
}

export function decodeGhostTape(address: string, data: Uint8Array): GhostTapeAccount {
  if (!hasDisc(data, ACC_DISC.GhostTape)) {
    throw new Error("Invalid GhostTape discriminator");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const ghostId = Number(view.getBigUint64(o, true));
  o += 8;
  const creator = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const callsignRaw = data.subarray(o, o + 20);
  o += 20;
  const callsignLen = Math.min(20, data[o]);
  o += 1;
  const callsign = new TextDecoder().decode(callsignRaw.subarray(0, callsignLen));
  const stakeLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const targetReturnBps = view.getInt32(o, true);
  o += 4;
  const regime = data[o];
  o += 1;
  const wins = view.getUint32(o, true);
  o += 4;
  const losses = view.getUint32(o, true);
  o += 4;
  const bountyEarnedLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const unclaimedBountyLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const entryPrices: [bigint, bigint, bigint] = [
    view.getBigInt64(o, true),
    view.getBigInt64(o + 8, true),
    view.getBigInt64(o + 16, true),
  ];
  o += 24;
  const exitPrices: [bigint, bigint, bigint] = [
    view.getBigInt64(o, true),
    view.getBigInt64(o + 8, true),
    view.getBigInt64(o + 16, true),
  ];
  o += 24;
  const moveCount = data[o];
  o += 1;
  const moves = decodeMovesArray(data, view, o, moveCount);
  o += MAX_MOVES * 6;
  const tapeHashHex = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const sourceSprintId = Number(view.getBigUint64(o, true));
  o += 8;
  const active = data[o] === 1;
  o += 1;
  const createdTs = Number(view.getBigInt64(o, true));
  o += 8;
  const bump = data[o];

  return {
    address,
    ghostId,
    creator,
    callsign,
    stakeLamports,
    targetReturnBps,
    regime,
    wins,
    losses,
    bountyEarnedLamports,
    unclaimedBountyLamports,
    entryPrices,
    exitPrices,
    moves,
    tapeHashHex,
    sourceSprintId,
    active,
    createdTs,
    bump,
  };
}

export function decodeSprintRun(address: string, data: Uint8Array): SprintRunAccount {
  if (!hasDisc(data, ACC_DISC.SprintRun)) {
    throw new Error("Invalid SprintRun discriminator");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const sprintId = Number(view.getBigUint64(o, true));
  o += 8;
  const player = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const sessionKey = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const ghostId = Number(view.getBigUint64(o, true));
  o += 8;
  const stakeLamports = Number(view.getBigUint64(o, true));
  o += 8;
  const status = data[o];
  o += 1;
  const startTs = Number(view.getBigInt64(o, true));
  o += 8;
  const endTs = Number(view.getBigInt64(o, true));
  o += 8;
  const lastMarkTs = Number(view.getBigInt64(o, true));
  o += 8;
  const settledTs = Number(view.getBigInt64(o, true));
  o += 8;
  const entryPrices: [bigint, bigint, bigint] = [
    view.getBigInt64(o, true),
    view.getBigInt64(o + 8, true),
    view.getBigInt64(o + 16, true),
  ];
  o += 24;
  const lastPrices: [bigint, bigint, bigint] = [
    view.getBigInt64(o, true),
    view.getBigInt64(o + 8, true),
    view.getBigInt64(o + 16, true),
  ];
  o += 24;
  const weights: [number, number, number] = [
    view.getInt8(o),
    view.getInt8(o + 1),
    view.getInt8(o + 2),
  ];
  o += 3;
  const pnlBps = view.getInt32(o, true);
  o += 4;
  const cards: [number, number, number] = [data[o], data[o + 1], data[o + 2]];
  o += 3;
  const cardsUsed: [boolean, boolean, boolean] = [
    data[o] === 1,
    data[o + 1] === 1,
    data[o + 2] === 1,
  ];
  o += 3;
  const activeCard = data[o];
  o += 1;
  const activeCardUntil = Number(view.getBigInt64(o, true));
  o += 8;
  const vrfRequested = data[o] === 1;
  o += 1;
  const vrfFulfilled = data[o] === 1;
  o += 1;
  const vrfSeedHex = bytesToHex(data.subarray(o, o + 32));
  o += 32;
  const moveCount = data[o];
  o += 1;
  const moves = decodeMovesArray(data, view, o, moveCount);
  o += MAX_MOVES * 6;
  const publishedAsGhost = data[o] === 1;
  o += 1;
  const challengerWon = data[o] === 1;
  o += 1;
  const delegatedValidator = new PublicKey(data.subarray(o, o + 32)).toBase58();
  o += 32;
  const bump = data[o];

  return {
    address,
    sprintId,
    player,
    sessionKey,
    ghostId,
    stakeLamports,
    status,
    startTs,
    endTs,
    lastMarkTs,
    settledTs,
    entryPrices,
    lastPrices,
    weights,
    pnlBps,
    cards,
    cardsUsed,
    activeCard,
    activeCardUntil,
    vrfRequested,
    vrfFulfilled,
    vrfSeedHex,
    moves,
    publishedAsGhost,
    challengerWon,
    delegatedValidator,
    bump,
  };
}

// Instruction builders matching idl/tapeduel.json exactly
export function buildInitArenaIx(authority: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getArenaPda(), isSigner: false, isWritable: true },
      { pubkey: getTreasuryPda(), isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX_DISC.init_arena),
  });
}

export function buildFundTreasuryIx(
  funder: PublicKey,
  amountLamports: number | bigint
): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getTreasuryPda(), isSigner: false, isWritable: true },
      { pubkey: funder, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.fund_treasury, u64LeBytes(amountLamports)),
  });
}

export function buildDepositIx(
  player: PublicKey,
  amountLamports: number | bigint
): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getVaultPda(player), isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.deposit, u64LeBytes(amountLamports)),
  });
}

export function buildWithdrawIx(
  player: PublicKey,
  amountLamports: number | bigint
): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getVaultPda(player), isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
    ],
    data: concatBytes(IX_DISC.withdraw, u64LeBytes(amountLamports)),
  });
}

export function buildCreateSprintIx(params: {
  player: PublicKey;
  sprintNonce: number;
  ghostId: number;
  sessionKey: PublicKey;
  stakeLamports: number;
  validator: PublicKey;
}): TransactionInstruction {
  const sprintPda = getSprintPda(params.player, params.sprintNonce);
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getArenaPda(), isSigner: false, isWritable: true },
      { pubkey: getVaultPda(params.player), isSigner: false, isWritable: true },
      { pubkey: getGhostPda(params.ghostId), isSigner: false, isWritable: false },
      { pubkey: sprintPda, isSigner: false, isWritable: true },
      { pubkey: params.player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      IX_DISC.create_sprint,
      u64LeBytes(params.sprintNonce),
      params.sessionKey.toBytes(),
      u64LeBytes(params.stakeLamports),
      params.validator.toBytes()
    ),
  });
}

export function buildDelegateSprintIx(params: {
  payer: PublicKey;
  sprintPda: PublicKey;
  sprintNonce: number;
  validator: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: getDelegationBufferPda(params.sprintPda), isSigner: false, isWritable: true },
      { pubkey: getDelegationRecordPda(params.sprintPda), isSigner: false, isWritable: true },
      { pubkey: getDelegationMetadataPda(params.sprintPda), isSigner: false, isWritable: true },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: TAPEDUEL_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // Remaining account[0]: target ER validator
      { pubkey: params.validator, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.delegate_sprint, u64LeBytes(params.sprintNonce)),
  });
}

export function buildRequestVrfCardsIx(params: {
  payer: PublicKey;
  sprintPda: PublicKey;
  oracleQueue: PublicKey;
  clientSeed: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: params.oracleQueue, isSigner: false, isWritable: true },
      { pubkey: SLOT_HASHES_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: getProgramIdentityPda(), isSigner: false, isWritable: false },
      { pubkey: VRF_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.request_vrf_cards, Uint8Array.from([params.clientSeed & 0xff])),
  });
}

export function buildStartSprintErIx(params: {
  authority: PublicKey;
  sprintPda: PublicKey;
  initialWeights: [number, number, number];
}): TransactionInstruction {
  const weights = new Int8Array(params.initialWeights);
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: PYTH_FEEDS.SOL, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.BTC, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.ETH, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.start_sprint_er, new Uint8Array(weights.buffer)),
  });
}

export function buildRebalanceErIx(params: {
  authority: PublicKey;
  sprintPda: PublicKey;
  newWeights: [number, number, number];
}): TransactionInstruction {
  const weights = new Int8Array(params.newWeights);
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: PYTH_FEEDS.SOL, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.BTC, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.ETH, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.rebalance_er, new Uint8Array(weights.buffer)),
  });
}

export function buildActivateCardErIx(params: {
  authority: PublicKey;
  sprintPda: PublicKey;
  slot: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: PYTH_FEEDS.SOL, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.BTC, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.ETH, isSigner: false, isWritable: false },
    ],
    data: concatBytes(IX_DISC.activate_card_er, Uint8Array.from([params.slot & 0xff])),
  });
}

export function buildSettleAndUndelegateErIx(params: {
  payer: PublicKey;
  sprintPda: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: PYTH_FEEDS.SOL, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.BTC, isSigner: false, isWritable: false },
      { pubkey: PYTH_FEEDS.ETH, isSigner: false, isWritable: false },
      { pubkey: MAGIC_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MAGIC_CONTEXT_ID, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX_DISC.settle_and_undelegate_er),
  });
}

export function buildFinalizePayoutIx(params: {
  payer: PublicKey;
  sprintPlayer: PublicKey;
  sprintPda: PublicKey;
  ghostId: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getTreasuryPda(), isSigner: false, isWritable: true },
      { pubkey: getVaultPda(params.sprintPlayer), isSigner: false, isWritable: true },
      { pubkey: getGhostPda(params.ghostId), isSigner: false, isWritable: true },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(IX_DISC.finalize_payout),
  });
}

export function buildPublishGhostIx(params: {
  creator: PublicKey;
  sprintPda: PublicKey;
  nextGhostId: number;
  callsign: string;
  regime: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getArenaPda(), isSigner: false, isWritable: true },
      { pubkey: params.sprintPda, isSigner: false, isWritable: true },
      { pubkey: getGhostPda(params.nextGhostId), isSigner: false, isWritable: true },
      { pubkey: params.creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      IX_DISC.publish_ghost,
      u64LeBytes(params.nextGhostId),
      encodeString(params.callsign),
      Uint8Array.from([params.regime & 0xff])
    ),
  });
}

export function buildSeedGhostIx(params: {
  authority: PublicKey;
  nextGhostId: number;
  callsign: string;
  stakeLamports: number;
  targetReturnBps: number;
  regime: number;
  entryPrices: [bigint, bigint, bigint];
  exitPrices: [bigint, bigint, bigint];
  moves: TapeMove[];
  tapeHash: Uint8Array;
}): TransactionInstruction {
  const moveBuffers = params.moves.map((m) => {
    const w = new Int8Array([m.solW, m.btcW, m.ethW]);
    return concatBytes(
      u16LeBytes(m.elapsedSecs),
      new Uint8Array(w.buffer),
      Uint8Array.from([m.cardId & 0xff])
    );
  });

  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getArenaPda(), isSigner: false, isWritable: true },
      { pubkey: getGhostPda(params.nextGhostId), isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      IX_DISC.seed_ghost,
      u64LeBytes(params.nextGhostId),
      encodeString(params.callsign),
      u64LeBytes(params.stakeLamports),
      i32LeBytes(params.targetReturnBps),
      Uint8Array.from([params.regime & 0xff]),
      i64LeBytes(params.entryPrices[0]),
      i64LeBytes(params.entryPrices[1]),
      i64LeBytes(params.entryPrices[2]),
      i64LeBytes(params.exitPrices[0]),
      i64LeBytes(params.exitPrices[1]),
      i64LeBytes(params.exitPrices[2]),
      u32LeBytes(params.moves.length),
      ...moveBuffers,
      params.tapeHash.slice(0, 32)
    ),
  });
}

export function buildClaimBountyIx(params: {
  creator: PublicKey;
  ghostId: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: TAPEDUEL_PROGRAM_ID,
    keys: [
      { pubkey: getTreasuryPda(), isSigner: false, isWritable: true },
      { pubkey: getGhostPda(params.ghostId), isSigner: false, isWritable: true },
      { pubkey: params.creator, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(IX_DISC.claim_bounty),
  });
}
