"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  ArrowSquareOut,
  CheckCircle,
  Eye,
  EyeSlash,
  FilmStrip,
  FlagCheckered,
  Lightning,
  ShieldCheck,
  Sparkle,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";
import { useTapeDuel } from "@/components/providers/SolanaWalletProvider";
import {
  CARD_META,
  REGIME_LABELS,
  TAPEDUEL_PROGRAM_ID,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/solana/config";
import {
  GhostTapeAccount,
  SprintRunAccount,
  TapeMove,
  buildFinalizePayoutIx,
  buildPublishGhostIx,
} from "@/lib/solana/codec";
import {
  fetchGhostById,
  fetchSprintAccount,
  getL1Connection,
} from "@/lib/solana/client";
import {
  LocalSprintRecord,
  PRACTICE_GHOSTS,
  formatBps,
  formatSol,
  ghostPaceAtSecond,
  loadLocalSprintById,
  loadLocalSprintRecords,
  shortKey,
} from "@/lib/solana/practiceData";
import { OscilloscopeChart } from "@/components/sprint/OscilloscopeChart";

function MoveWeightPills({ move }: { move: TapeMove }) {
  const items = [
    { sym: "SOL", w: move.solW },
    { sym: "BTC", w: move.btcW },
    { sym: "ETH", w: move.ethW },
  ].filter((x) => x.w !== 0);

  if (items.length === 0) {
    return (
      <span className="px-2 py-0.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] font-data text-[11px] text-[var(--color-ink-muted)]">
        100% CASH
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <span
          key={item.sym}
          className={`px-2 py-0.5 font-data text-[11px] border ${
            item.w > 0
              ? "bg-[var(--color-semantic-long-bg)] border-[var(--color-semantic-long)]/40 text-[var(--color-semantic-long)]"
              : "bg-[var(--color-semantic-short-bg)] border-[var(--color-semantic-short)]/40 text-[var(--color-semantic-short)]"
          }`}
        >
          {item.sym} {item.w > 0 ? `+${item.w}%` : `${item.w}%`}
        </span>
      ))}
    </div>
  );
}

export function ReplayProofRoom({ tapeId }: { tapeId: string }) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { arena, ghosts, refreshChainState } = useTapeDuel();

  const [localRecord, setLocalRecord] = useState<LocalSprintRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<LocalSprintRecord[]>([]);
  const [onChainSprint, setOnChainSprint] = useState<SprintRunAccount | null>(null);
  const [onChainGhost, setOnChainGhost] = useState<GhostTapeAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [unmasked, setUnmasked] = useState<boolean>(false);
  const [scrubSec, setScrubSec] = useState<number>(90);

  // On-chain L1 finalization & Ghost publishing states
  const [callsign, setCallsign] = useState<string>("");
  const [regime, setRegime] = useState<number>(0);
  const [txPending, setTxPending] = useState<boolean>(false);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [publishedSig, setPublishedSig] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const allLocal = loadLocalSprintRecords();
      if (!cancelled) setRecentRecords(allLocal);

      if (tapeId === "latest") {
        if (!cancelled) {
          setLocalRecord(allLocal[0] ?? null);
          setLoading(false);
        }
        return;
      }

      const foundLocal = loadLocalSprintById(tapeId);
      if (foundLocal && !cancelled) {
        setLocalRecord(foundLocal);
      }

      if (!tapeId.startsWith("tape-") && !tapeId.startsWith("practice-")) {
        try {
          const res = await fetchSprintAccount(tapeId, false);
          if (!cancelled && res) {
            setOnChainSprint(res.sprint);
            const g =
              ghosts.find((x) => x.ghostId === res.sprint.ghostId) ??
              (await fetchGhostById(res.sprint.ghostId)) ??
              PRACTICE_GHOSTS[0];
            if (!cancelled) setOnChainGhost(g);
          }
        } catch {
          // fallback to local record or empty state
        }
      }

      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tapeId, ghosts]);

  // Trigger smooth Ghost unmask sweep shortly after load so the signature reveal is palpable
  useEffect(() => {
    const t = setTimeout(() => setUnmasked(true), 280);
    return () => clearTimeout(t);
  }, [tapeId]);

  const activeData = useMemo(() => {
    if (onChainSprint) {
      const ghostRef =
        onChainGhost ??
        ghosts.find((g) => g.ghostId === onChainSprint.ghostId) ??
        PRACTICE_GHOSTS[0];
      const curve = Array.from({ length: 19 }, (_, idx) => {
        const sec = idx * 5;
        const t = sec / 90;
        return {
          sec,
          userBps: Math.round(onChainSprint.pnlBps * t),
          ghostBps: ghostPaceAtSecond(ghostRef.targetReturnBps, sec),
        };
      });
      return {
        mode: "onchain" as const,
        ghostId: ghostRef.ghostId,
        ghostCallsign: ghostRef.callsign,
        ghostTargetBps: ghostRef.targetReturnBps,
        ghostMoves: ghostRef.moves,
        stakeLamports: onChainSprint.stakeLamports,
        finalPnlBps: onChainSprint.pnlBps,
        challengerWon: onChainSprint.pnlBps > ghostRef.targetReturnBps,
        moves: onChainSprint.moves,
        curve,
        vrfSeedHex: onChainSprint.vrfSeedHex,
        sprintPda: onChainSprint.address,
        status: onChainSprint.status,
        publishedAsGhost: onChainSprint.publishedAsGhost,
        entrySig: localRecord?.entrySig,
        vrfSig: localRecord?.vrfSig,
        settleSig: localRecord?.settleSig,
        erReceipts: localRecord?.erReceipts ?? [],
      };
    }

    if (localRecord) {
      return {
        mode: localRecord.mode,
        ghostId: localRecord.ghostId,
        ghostCallsign: localRecord.ghostCallsign,
        ghostTargetBps: localRecord.ghostTargetBps,
        ghostMoves: localRecord.ghostMoves,
        stakeLamports: localRecord.stakeLamports,
        finalPnlBps: localRecord.finalPnlBps,
        challengerWon: localRecord.challengerWon,
        moves: localRecord.moves,
        curve: localRecord.curve,
        vrfSeedHex: localRecord.vrfSeedHex,
        sprintPda: localRecord.sprintPda,
        status: 3,
        publishedAsGhost: false,
        entrySig: localRecord.entrySig,
        vrfSig: localRecord.vrfSig,
        settleSig: localRecord.settleSig,
        erReceipts: localRecord.erReceipts,
      };
    }

    return null;
  }, [onChainSprint, onChainGhost, ghosts, localRecord]);

  const handleFinalizeOnL1 = async () => {
    if (!onChainSprint || !publicKey || !connected) return;
    setTxPending(true);
    setTxError(null);
    setTxMessage(null);
    try {
      const l1 = getL1Connection();
      const tx = new Transaction().add(
        buildFinalizePayoutIx({
          payer: publicKey,
          sprintPlayer: new PublicKey(onChainSprint.player),
          sprintPda: new PublicKey(onChainSprint.address),
          ghostId: onChainSprint.ghostId,
        })
      );
      const sig = await sendTransaction(tx, l1);
      await l1.confirmTransaction(sig, "confirmed");
      setTxMessage(`L1 payout finalized! Tx: ${sig}`);
      const refreshed = await fetchSprintAccount(onChainSprint.address, false);
      if (refreshed) setOnChainSprint(refreshed.sprint);
      await refreshChainState();
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Failed to finalize L1 payout.");
    } finally {
      setTxPending(false);
    }
  };

  const handlePublishGhost = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);
    setTxMessage(null);

    const cleaned = callsign.trim().toUpperCase();
    if (cleaned.length < 3 || cleaned.length > 20) {
      setTxError("Callsign must be 3 to 20 printable characters (for example, SOL-BLITZ-07).");
      return;
    }

    if (!onChainSprint || !publicKey || !connected) {
      setTxError("Connect the winning Devnet wallet to publish an on-chain Bounty Ghost.");
      return;
    }

    setTxPending(true);
    try {
      const l1 = getL1Connection();
      const nextGhostId = (arena?.totalGhosts ?? ghosts.length) + 1;
      const tx = new Transaction().add(
        buildPublishGhostIx({
          creator: publicKey,
          sprintPda: new PublicKey(onChainSprint.address),
          nextGhostId,
          callsign: cleaned,
          regime,
        })
      );
      const sig = await sendTransaction(tx, l1);
      await l1.confirmTransaction(sig, "confirmed");
      setPublishedSig(sig);
      setTxMessage(`Published ${cleaned} as Bounty Ghost #${nextGhostId}.`);
      await refreshChainState();
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Failed to publish Bounty Ghost.");
    } finally {
      setTxPending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] font-data text-sm text-[var(--color-ink-secondary)]">
        Loading sprint settlement tape...
      </div>
    );
  }

  if (!activeData) {
    return (
      <div className="space-y-6 animate-stage-in">
        <div className="border-b border-[var(--color-border-subtle)] pb-5">
          <h1 className="font-display text-[28px] sm:text-[36px] text-[var(--color-ink-primary)]">
            REPLAY & PROOF ROOM
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-ink-secondary)] max-w-2xl">
            Every completed 90-second sprint is stored here so you can unmask the Ghost&apos;s sealed moves, inspect MagicBlock ER and VRF proofs, and publish winning runs as new Bounty Ghosts.
          </p>
        </div>

        <div className="chamfer-stage bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-8 text-center space-y-4">
          <FilmStrip
            size={36}
            weight="duotone"
            className="mx-auto text-[var(--color-accent-primary)]"
            aria-hidden="true"
          />
          <h2 className="font-display text-xl text-[var(--color-ink-primary)]">
            NO COMPLETED TAPES YET
          </h2>
          <p className="text-sm text-[var(--color-ink-secondary)] max-w-md mx-auto">
            Finish a 90-second sprint (on-chain Devnet or live-price practice) to unlock the side-by-side Ghost unmask scrubber and Explorer proof receipts.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/sprint/practice-1"
              className="px-5 py-3 chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] font-display text-sm uppercase tracking-wider"
            >
              Run Live-Price Practice Sprint
            </Link>
            <Link
              href="/"
              className="px-5 py-3 bg-[var(--color-surface-inset)] border border-[var(--color-border-strong)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-primary)]"
            >
              Browse Bounty Ghosts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const spreadBps = activeData.finalPnlBps - activeData.ghostTargetBps;
  const visibleCurve = activeData.curve.filter((p) => p.sec <= scrubSec);
  const scrubbedPoint =
    visibleCurve[visibleCurve.length - 1] ?? {
      sec: scrubSec,
      userBps: activeData.finalPnlBps,
      ghostBps: activeData.ghostTargetBps,
    };

  return (
    <div className="space-y-7 animate-stage-in">
      {/* Masthead */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-5">
        <div>
          <h1 className="font-display text-[28px] sm:text-[36px] leading-[1.08] text-[var(--color-ink-primary)]">
            REPLAY & PROOF ROOM
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-secondary)]">
            Post-duel forensic tape comparing your moves against {activeData.ghostCallsign}&apos;s unmasked allocation timeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="px-4 py-2 bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-primary)]"
          >
            Back to Arena
          </Link>
          <Link
            href={`/sprint/practice-${activeData.ghostId}`}
            className="px-4 py-2 chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] text-xs font-semibold uppercase tracking-wider"
          >
            Rematch {activeData.ghostCallsign}
          </Link>
        </div>
      </div>

      {/* Verdict Banner */}
      <section
        aria-label="Duel settlement verdict"
        className={`chamfer-stage p-5 sm:p-7 border ${
          activeData.challengerWon
            ? "bg-[var(--color-surface-raised)] border-[var(--color-accent-primary)]"
            : "bg-[var(--color-surface-raised)] border-[var(--color-semantic-short)]/60"
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-3 py-1 font-display text-xs uppercase tracking-widest inline-flex items-center gap-1.5 ${
                  activeData.challengerWon
                    ? "bg-[var(--color-accent-primary)] text-[var(--color-on-accent)]"
                    : "bg-[var(--color-semantic-short)] text-[var(--color-on-accent)]"
                }`}
              >
                {activeData.challengerWon ? (
                  <Trophy size={14} weight="fill" aria-hidden="true" />
                ) : (
                  <FlagCheckered size={14} weight="fill" aria-hidden="true" />
                )}
                {activeData.challengerWon ? "VICTORY | GHOST BEATEN" : "LOSS | GHOST DEFENDED"}
              </span>

              <span className="px-2.5 py-1 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] font-data text-[11px] text-[var(--color-semantic-vrf)]">
                {activeData.mode === "onchain"
                  ? "ON-CHAIN SOLANA DEVNET"
                  : "LIVE PYTH PRACTICE RUN"}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <div className="font-display text-[36px] sm:text-[48px] leading-none text-[var(--color-ink-primary)] font-data">
                {formatBps(activeData.finalPnlBps)}
              </div>
              <div className="text-sm font-data text-[var(--color-ink-secondary)]">
                VS {activeData.ghostCallsign} ({formatBps(activeData.ghostTargetBps)})
              </div>
              <div
                className={`font-data text-base font-semibold ${
                  spreadBps > 0
                    ? "text-[var(--color-semantic-long)]"
                    : "text-[var(--color-semantic-short)]"
                }`}
              >
                SPREAD {formatBps(spreadBps)}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-secondary)]">Stake Tier</span>
              <span className="font-data font-semibold text-[var(--color-ink-primary)]">
                {formatSol(activeData.stakeLamports)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-secondary)]">
                {activeData.challengerWon ? "Winner Profit (85%)" : "Ghost Owner Defense Cut (10%)"}
              </span>
              <span
                className={`font-data font-semibold ${
                  activeData.challengerWon
                    ? "text-[var(--color-accent-primary)]"
                    : "text-[var(--color-semantic-short)]"
                }`}
              >
                {activeData.challengerWon
                  ? `+${formatSol(Math.round(activeData.stakeLamports * 0.85), 3)} SOL`
                  : `${formatSol(Math.round(activeData.stakeLamports * 0.1), 4)} SOL`}
              </span>
            </div>

            {activeData.mode === "onchain" && activeData.status === 2 && (
              <button
                type="button"
                disabled={txPending || !connected}
                onClick={handleFinalizeOnL1}
                className="w-full min-h-[44px] chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-on-accent)] font-display text-xs uppercase tracking-wider cursor-pointer"
              >
                {txPending ? "Finalizing on Devnet L1..." : "Finalize Payout on Solana L1"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Replay Oscilloscope + Interactive Time Scrubber */}
      <section className="space-y-3">
        <OscilloscopeChart
          points={visibleCurve.length > 0 ? visibleCurve : activeData.curve}
          ghostCallsign={activeData.ghostCallsign}
          currentSec={scrubSec}
          userPnlBps={scrubbedPoint.userBps}
          ghostPaceBps={scrubbedPoint.ghostBps}
          activeCard={0}
          activeCardSecsLeft={0}
        />

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label
            htmlFor="replay-scrubber"
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] whitespace-nowrap"
          >
            Timeline Scrubber: <span className="font-data text-[var(--color-accent-primary)]">T+{scrubSec}s</span>
          </label>
          <input
            id="replay-scrubber"
            type="range"
            min={0}
            max={90}
            step={1}
            value={scrubSec}
            onChange={(e) => setScrubSec(Number(e.target.value))}
            className="w-full sm:max-w-md tapeduel-slider"
          />
          <button
            type="button"
            onClick={() => setUnmasked((u) => !u)}
            className="px-3.5 py-2 min-h-[38px] bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-gold)] text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-primary)] inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {unmasked ? <EyeSlash size={15} /> : <Eye size={15} />}
            <span>{unmasked ? "Mask Ghost Tape" : "Unmask Ghost Tape"}</span>
          </button>
        </div>
      </section>

      {/* Side-by-Side Move Ledger with Signature Moment 2 (clip-path unmask sweep) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Your Recorded Moves */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
            <h2 className="font-display text-lg text-[var(--color-accent-primary)]">
              YOUR RECORDED TAPE
            </h2>
            <span className="font-data text-xs text-[var(--color-ink-muted)]">
              {activeData.moves.length} MOVES
            </span>
          </div>

          {activeData.moves.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              No intermediate rebalances were fired during this sprint.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {activeData.moves.map((mv, i) => (
                <li key={i} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-data text-xs font-semibold text-[var(--color-ink-muted)] w-12">
                      T+{mv.elapsedSecs}s
                    </span>
                    <MoveWeightPills move={mv} />
                  </div>
                  {mv.cardId > 0 && (
                    <span className="px-2 py-0.5 bg-[var(--color-semantic-vrf-bg)] border border-[var(--color-semantic-vrf)]/40 font-data text-[11px] text-[var(--color-semantic-vrf)] inline-flex items-center gap-1">
                      <Lightning size={12} weight="fill" />
                      {CARD_META[mv.cardId as 1 | 2 | 3]?.name ?? "VRF CARD"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Ghost Unmasked Moves */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
            <h2 className="font-display text-lg text-[var(--color-ink-primary)]">
              {activeData.ghostCallsign} UNMASKED TAPE
            </h2>
            <span className="font-data text-xs text-[var(--color-semantic-vrf)]">
              {unmasked ? "REVEALED" : "SEALED"}
            </span>
          </div>

          <div className={`ghost-unmask-wrap ${unmasked ? "is-unmasked" : ""}`}>
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {activeData.ghostMoves.map((mv, i) => (
                <li key={i} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-data text-xs font-semibold text-[var(--color-ink-muted)] w-12">
                      T+{mv.elapsedSecs}s
                    </span>
                    <MoveWeightPills move={mv} />
                  </div>
                  {mv.cardId > 0 && (
                    <span className="px-2 py-0.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-gold)] font-data text-[11px] text-[var(--color-accent-primary)] inline-flex items-center gap-1">
                      <Sparkle size={12} weight="fill" />
                      {CARD_META[mv.cardId as 1 | 2 | 3]?.name ?? "VRF CARD"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Publish as Bounty Ghost Panel (for winning sprints) */}
      {activeData.challengerWon && (
        <section className="chamfer-stage bg-[var(--color-surface-raised)] border border-[var(--color-border-gold)] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl text-[var(--color-ink-primary)]">
                PUBLISH WINNING TAPE AS A BOUNTY GHOST
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
                Immortalize this {formatBps(activeData.finalPnlBps)} run on Solana Devnet. Every future challenger who loses to your tape pays you a 10% defense bounty.
              </p>
            </div>
            {activeData.publishedAsGhost && (
              <span className="px-3 py-1 bg-[var(--color-semantic-long-bg)] border border-[var(--color-semantic-long)]/40 text-xs font-data text-[var(--color-semantic-long)] inline-flex items-center gap-1.5">
                <CheckCircle size={15} weight="fill" />
                PUBLISHED ON-CHAIN
              </span>
            )}
          </div>

          {txError && (
            <div role="alert" className="p-3 bg-[var(--color-semantic-short-bg)] border border-[var(--color-semantic-short)]/40 text-xs flex items-center gap-2">
              <WarningCircle size={16} weight="bold" className="text-[var(--color-semantic-short)] shrink-0" />
              <span>{txError}</span>
            </div>
          )}

          {txMessage && (
            <div className="p-3 bg-[var(--color-semantic-long-bg)] border border-[var(--color-semantic-long)]/40 text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="text-[var(--color-semantic-long)] font-semibold">{txMessage}</span>
              {publishedSig && (
                <a
                  href={explorerTxUrl(publishedSig, "devnet")}
                  target="_blank"
                  rel="noreferrer"
                  className="font-data underline text-[var(--color-ink-primary)]"
                >
                  View Devnet Tx
                </a>
              )}
            </div>
          )}

          <form onSubmit={handlePublishGhost} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5 space-y-1.5">
              <label
                htmlFor="ghost-callsign"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]"
              >
                Ghost Callsign (3-20 chars)
              </label>
              <input
                id="ghost-callsign"
                type="text"
                maxLength={20}
                placeholder="APEX-SOL-01"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-[var(--color-surface-inset)] border border-[var(--color-border-strong)] text-base sm:text-sm font-data text-[var(--color-ink-primary)] placeholder:text-[var(--color-ink-muted)]"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label
                htmlFor="ghost-regime"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]"
              >
                Strategy Regime
              </label>
              <select
                id="ghost-regime"
                value={regime}
                onChange={(e) => setRegime(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 bg-[var(--color-surface-inset)] border border-[var(--color-border-strong)] text-base sm:text-sm text-[var(--color-ink-primary)]"
              >
                {REGIME_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <button
                type="submit"
                disabled={txPending || activeData.publishedAsGhost || activeData.mode !== "onchain"}
                className="w-full min-h-[44px] px-4 chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-on-accent)] font-display text-xs uppercase tracking-wider cursor-pointer"
              >
                {activeData.mode !== "onchain"
                  ? "Win an On-Chain Duel to Publish"
                  : txPending
                  ? "Publishing Ghost PDA..."
                  : "Publish as Bounty Ghost"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3-Column On-Chain Explorer Proof Strip */}
      <section aria-label="Cryptographic and Explorer proofs" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
            <ShieldCheck size={16} className="text-[var(--color-semantic-long)]" />
            <span>Solana Devnet L1 Proof</span>
          </div>
          <div className="font-data text-xs text-[var(--color-ink-muted)] break-all">
            Program: {shortKey(TAPEDUEL_PROGRAM_ID.toBase58())}
          </div>
          <div className="flex flex-wrap gap-3 pt-1 text-xs font-data">
            <a
              href={explorerAddressUrl(TAPEDUEL_PROGRAM_ID.toBase58(), "devnet")}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent-primary)] hover:underline inline-flex items-center gap-1"
            >
              Program Explorer <ArrowSquareOut size={13} />
            </a>
            {activeData.entrySig && (
              <a
                href={explorerTxUrl(activeData.entrySig, "devnet")}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-semantic-vrf)] hover:underline inline-flex items-center gap-1"
              >
                Delegation Tx <ArrowSquareOut size={13} />
              </a>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
            <Lightning size={16} className="text-[var(--color-accent-primary)]" />
            <span>MagicBlock ER Execution</span>
          </div>
          <div className="font-data text-xs text-[var(--color-ink-muted)]">
            Receipts logged: {activeData.erReceipts.length} | Validator: devnet-eu
          </div>
          <div className="flex flex-wrap gap-3 pt-1 text-xs font-data">
            {activeData.settleSig ? (
              <a
                href={explorerTxUrl(activeData.settleSig, "er")}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-semantic-vrf)] hover:underline inline-flex items-center gap-1"
              >
                ER Settle & Undelegate <ArrowSquareOut size={13} />
              </a>
            ) : (
              <span className="text-[var(--color-ink-muted)]">
                Live Pyth Lazer feed verified on devnet-eu
              </span>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
            <Sparkle size={16} className="text-[var(--color-semantic-vrf)]" />
            <span>VRF Hand Seed Digest</span>
          </div>
          <div className="font-data text-xs text-[var(--color-ink-primary)] break-all">
            {activeData.vrfSeedHex.slice(0, 32)}...
          </div>
          {activeData.vrfSig && (
            <a
              href={explorerTxUrl(activeData.vrfSig, "er")}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-data text-[var(--color-semantic-vrf)] hover:underline inline-flex items-center gap-1"
            >
              VRF Request Tx <ArrowSquareOut size={13} />
            </a>
          )}
        </div>
      </section>

      {/* Recent Local Replay Archive */}
      {recentRecords.length > 1 && (
        <section className="space-y-2.5 pt-2">
          <h3 className="font-display text-base text-[var(--color-ink-secondary)]">
            RECENT RECORDED TAPES
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentRecords.slice(0, 6).map((rec) => (
              <Link
                key={rec.id}
                href={`/tapes/${rec.id}`}
                className={`px-3 py-2 border text-xs font-data transition-colors ${
                  rec.id === tapeId
                    ? "bg-[var(--color-surface-elevated)] border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                    : "bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] text-[var(--color-ink-secondary)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                VS {rec.ghostCallsign} ({formatBps(rec.finalPnlBps)})
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
