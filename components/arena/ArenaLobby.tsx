"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import {
  ArrowRight,
  CheckCircle,
  Lightning,
  Play,
  ShieldCheck,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useTapeDuel } from "@/components/providers/SolanaWalletProvider";
import {
  MAGICBLOCK_ER_VALIDATOR,
  REGIME_LABELS,
  TAPEDUEL_PROGRAM_ID,
  explorerAddressUrl,
} from "@/lib/solana/config";
import {
  GhostTapeAccount,
  buildCreateSprintIx,
  buildDelegateSprintIx,
  getSprintPda,
} from "@/lib/solana/codec";
import { getL1Connection } from "@/lib/solana/client";
import { createAndStoreSprintSessionKey } from "@/lib/solana/sessionKey";
import { formatBps, formatSol, shortKey } from "@/lib/solana/practiceData";

const STAKE_FILTERS = [
  { id: "all", label: "All Stakes", lamports: null },
  { id: "0.05", label: "0.05 SOL", lamports: 50_000_000 },
  { id: "0.10", label: "0.10 SOL", lamports: 100_000_000 },
  { id: "0.25", label: "0.25 SOL", lamports: 250_000_000 },
] as const;

export function ArenaLobby() {
  const router = useRouter();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const {
    ghosts,
    isProgramLiveOnDevnet,
    vault,
    loadingChain,
    chainError,
    refreshChainState,
  } = useTapeDuel();

  const [stakeFilter, setStakeFilter] = useState<string>("all");
  const [selectedGhostId, setSelectedGhostId] = useState<number>(1);
  const [entering, setEntering] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredGhosts = useMemo(() => {
    const activeFilter = STAKE_FILTERS.find((f) => f.id === stakeFilter);
    if (!activeFilter || activeFilter.lamports === null) return ghosts;
    return ghosts.filter((g) => g.stakeLamports === activeFilter.lamports);
  }, [ghosts, stakeFilter]);

  const selectedGhost: GhostTapeAccount | null = useMemo(() => {
    return (
      ghosts.find((g) => g.ghostId === selectedGhostId) ??
      filteredGhosts[0] ??
      ghosts[0] ??
      null
    );
  }, [ghosts, filteredGhosts, selectedGhostId]);

  const isSelectedPractice = selectedGhost?.address.startsWith("practice-") ?? true;
  const hasEnoughEscrow =
    Boolean(vault) &&
    Boolean(selectedGhost) &&
    (vault?.availableLamports ?? 0) >= (selectedGhost?.stakeLamports ?? 0);

  const handleEnterOnChainDuel = async () => {
    if (!selectedGhost) return;
    setActionError(null);

    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    if (!isProgramLiveOnDevnet || isSelectedPractice) {
      router.push(`/sprint/practice-${selectedGhost.ghostId}`);
      return;
    }

    if (!vault || vault.availableLamports < selectedGhost.stakeLamports) {
      setActionError(
        `Vault needs ${formatSol(selectedGhost.stakeLamports)} SOL available to lock this stake. Deposit test SOL in Vault first.`
      );
      return;
    }

    setEntering(true);
    try {
      const l1 = getL1Connection();
      const sprintNonce = vault.sprintNonce;
      const sprintPda = getSprintPda(publicKey, sprintNonce);
      const sessionKey = createAndStoreSprintSessionKey(sprintPda.toBase58());

      const tx = new Transaction().add(
        buildCreateSprintIx({
          player: publicKey,
          sprintNonce,
          ghostId: selectedGhost.ghostId,
          sessionKey: sessionKey.publicKey,
          stakeLamports: selectedGhost.stakeLamports,
          validator: MAGICBLOCK_ER_VALIDATOR,
        }),
        buildDelegateSprintIx({
          payer: publicKey,
          sprintPda,
          sprintNonce,
          validator: MAGICBLOCK_ER_VALIDATOR,
        })
      );

      const sig = await sendTransaction(tx, l1);
      await l1.confirmTransaction(sig, "confirmed");
      await refreshChainState();
      router.push(`/sprint/${sprintPda.toBase58()}?entryTx=${sig}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Transaction cancelled or failed on Devnet."
      );
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="space-y-8 animate-stage-in">
      {/* Masthead Row (no kicker above H1 per DESIGN.md) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-5">
        <div>
          <h1 className="font-display text-[28px] sm:text-[36px] leading-[1.08] tracking-[0.01em] text-[var(--color-ink-primary)]">
            BOUNTY GHOST ARENA
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-ink-secondary)] max-w-2xl">
            Pick a recorded trader tape, lock stake with one wallet signature, and race 90 seconds of live SOL, BTC, and ETH moves on MagicBlock Ephemeral Rollups with zero gas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-end shrink-0">
          <a
            href={explorerAddressUrl(TAPEDUEL_PROGRAM_ID.toBase58(), "devnet")}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] text-[11px] font-data text-[var(--color-ink-secondary)] transition-colors"
          >
            PROG {shortKey(TAPEDUEL_PROGRAM_ID.toBase58())}
          </a>
          <span
            className={`px-3 py-1.5 border text-[11px] font-semibold uppercase tracking-[0.08em] ${
              isProgramLiveOnDevnet
                ? "bg-[var(--color-semantic-long-bg)] border-[var(--color-semantic-long)]/40 text-[var(--color-semantic-long)]"
                : "bg-[var(--color-semantic-vrf-bg)] border-[var(--color-semantic-vrf)]/40 text-[var(--color-semantic-vrf)]"
            }`}
          >
            {isProgramLiveOnDevnet ? "DEVNET LIVE" : "LIVE PYTH PRACTICE"}
          </span>
        </div>
      </div>

      {/* Chain error banner if Devnet RPC had an issue */}
      {chainError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[var(--color-semantic-short-bg)] border border-[var(--color-semantic-short)]/40 text-sm text-[var(--color-ink-primary)]"
        >
          <span className="flex items-center gap-2">
            <WarningCircle size={18} weight="bold" className="text-[var(--color-semantic-short)]" />
            Devnet RPC status: {chainError}. Live Pyth Lazer practice tapes remain available.
          </span>
          <button
            type="button"
            onClick={() => refreshChainState()}
            className="px-3 py-1 bg-[var(--color-surface-inset)] border border-[var(--color-border-strong)] text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            Retry RPC
          </button>
        </div>
      )}

      {/* Featured Full-Width Head-to-Head Match Stage */}
      {selectedGhost && (
        <section
          aria-label="Featured head-to-head match stage"
          className="chamfer-stage bg-[var(--color-surface-raised)] border border-[var(--color-border-gold)] p-5 sm:p-7"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Matchup Identity & Sealed Target */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2.5 py-1 bg-[var(--color-canvas-deep)] border border-[var(--color-border-gold)] text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent-primary)]">
                  FEATURED DUEL #{selectedGhost.ghostId}
                </span>
                <span className="px-2.5 py-1 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-secondary)]">
                  {REGIME_LABELS[selectedGhost.regime] ?? "Momentum"}
                </span>
                <span className="text-[11px] font-data text-[var(--color-ink-muted)]">
                  {isSelectedPractice ? "LIVE PYTH PRACTICE TAPE" : `ON-CHAIN PDA ${shortKey(selectedGhost.address)}`}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="font-display text-xl sm:text-2xl text-[var(--color-ink-secondary)]">
                  YOU
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-primary)] px-2 py-0.5 bg-[var(--color-canvas-deep)] border border-[var(--color-border-subtle)]">
                  VS
                </span>
                <h2 className="font-display text-[26px] sm:text-[34px] leading-none text-[var(--color-ink-primary)]">
                  {selectedGhost.callsign}
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Target Return
                  </div>
                  <div className="mt-1 font-data text-lg sm:text-xl font-semibold text-[var(--color-semantic-long)]">
                    {formatBps(selectedGhost.targetReturnBps)}
                  </div>
                </div>
                <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Stake Lock
                  </div>
                  <div className="mt-1 font-data text-lg sm:text-xl font-semibold text-[var(--color-ink-primary)]">
                    {formatSol(selectedGhost.stakeLamports)} SOL
                  </div>
                </div>
                <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Defense Record
                  </div>
                  <div className="mt-1 font-data text-lg sm:text-xl font-semibold text-[var(--color-ink-primary)]">
                    {selectedGhost.wins}W - {selectedGhost.losses}L
                  </div>
                </div>
                <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Sealed Moves
                  </div>
                  <div className="mt-1 font-data text-lg sm:text-xl font-semibold text-[var(--color-semantic-vrf)]">
                    {selectedGhost.moves.length} LOCKED
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Payout Split & Single Gold Primary CTA */}
            <div className="lg:col-span-5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-5 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-[var(--color-ink-secondary)]">
                  <span>Beat {formatBps(selectedGhost.targetReturnBps)} to collect</span>
                  <span className="font-data font-semibold text-[var(--color-accent-primary)]">
                    +{formatSol(Math.round(selectedGhost.stakeLamports * 0.85), 3)} SOL (85%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-ink-muted)] text-xs">
                  <span>Ghost defense cut on loss</span>
                  <span className="font-data">10% to creator / 5% arena fee</span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-ink-muted)] text-xs">
                  <span>Execution rails</span>
                  <span className="font-data text-[var(--color-semantic-vrf)]">
                    MagicBlock ER + VRF 3-Card Hand
                  </span>
                </div>
              </div>

              {actionError && (
                <div
                  role="alert"
                  className="p-3 bg-[var(--color-semantic-short-bg)] border border-[var(--color-semantic-short)]/40 text-xs text-[var(--color-ink-primary)] flex items-start gap-2"
                >
                  <WarningCircle size={16} weight="bold" className="text-[var(--color-semantic-short)] shrink-0 mt-0.5" />
                  <div>
                    <p>{actionError}</p>
                    <Link
                      href="/vault"
                      className="inline-flex items-center gap-1 mt-1.5 font-semibold text-[var(--color-accent-primary)] underline"
                    >
                      Open Vault to Deposit SOL
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={entering}
                  onClick={handleEnterOnChainDuel}
                  className="w-full min-h-[48px] px-5 py-3 chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-[var(--color-on-accent)] font-display text-base tracking-wide uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lightning size={18} weight="fill" aria-hidden="true" />
                  <span>
                    {entering
                      ? "Delegating Sprint to ER..."
                      : isProgramLiveOnDevnet && !isSelectedPractice
                      ? connected
                        ? hasEnoughEscrow
                          ? "Enter 90s On-Chain Duel"
                          : "Lock Stake & Enter 90s Duel"
                        : "Connect Wallet to Enter Duel"
                      : "Enter 90s Live-Price Duel"}
                  </span>
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </button>

                {isProgramLiveOnDevnet && !isSelectedPractice && (
                  <Link
                    href={`/sprint/practice-${selectedGhost.ghostId}`}
                    className="w-full min-h-[42px] px-4 py-2 bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play size={14} weight="fill" aria-hidden="true" />
                    <span>Launch Live-Price Practice Desk (No SOL Locked)</span>
                  </Link>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--color-ink-muted)]">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={14} className="text-[var(--color-semantic-long)]" aria-hidden="true" />
                  1 signature delegates PDA
                </span>
                <span className="inline-flex items-center gap-1">
                  <Sparkle size={14} className="text-[var(--color-semantic-vrf)]" aria-hidden="true" />
                  Session key signs 0-gas moves
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Full-Width Horizontal Bounty Ghost Pit-Pass Bands */}
      <section aria-label="Bounty Ghost ledger" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl sm:text-[22px] text-[var(--color-ink-primary)]">
              ACTIVE BOUNTY GHOSTS
            </h2>
            <span className="font-data text-xs text-[var(--color-ink-muted)]">
              {filteredGhosts.length} {filteredGhosts.length === 1 ? "TAPE" : "TAPES"}
            </span>
          </div>

          <div
            role="group"
            aria-label="Filter Bounty Ghosts by stake tier"
            className="flex flex-wrap items-center gap-1.5"
          >
            {STAKE_FILTERS.map((f) => {
              const active = stakeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStakeFilter(f.id)}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold uppercase tracking-wider whitespace-nowrap border transition-colors cursor-pointer ${
                    active
                      ? "bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] border-[var(--color-accent-primary)]"
                      : "bg-[var(--color-surface-raised)] text-[var(--color-ink-secondary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
          <div className="col-span-5 sm:col-span-4">Ghost Callsign</div>
          <div className="hidden sm:block sm:col-span-2">Regime</div>
          <div className="col-span-3 sm:col-span-2 text-right">Target</div>
          <div className="col-span-4 sm:col-span-2 text-right">Stake</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Defense W-L</div>
        </div>

        {/* Loading Skeleton */}
        {loadingChain && ghosts.length === 0 ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] animate-pulse"
              />
            ))}
          </div>
        ) : filteredGhosts.length === 0 ? (
          <div className="p-8 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] text-center space-y-3">
            <p className="text-sm text-[var(--color-ink-secondary)]">
              No Bounty Ghosts match the selected stake tier.
            </p>
            <button
              type="button"
              onClick={() => setStakeFilter("all")}
              className="px-4 py-2 chamfer-btn bg-[var(--color-surface-elevated)] border border-[var(--color-border-gold)] text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-primary)] cursor-pointer"
            >
              Show All Stakes
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-subtle)]">
            {filteredGhosts.map((ghost) => {
              const isSelected = selectedGhost?.ghostId === ghost.ghostId;
              return (
                <button
                  key={ghost.address}
                  type="button"
                  onClick={() => {
                    setSelectedGhostId(ghost.ghostId);
                    setActionError(null);
                  }}
                  className={`w-full text-left grid grid-cols-12 gap-2 items-center px-4 py-4 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--color-surface-elevated)] border-l-[3px] border-l-[var(--color-accent-primary)]"
                      : "bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-elevated)]/70 border-l-[3px] border-l-transparent"
                  }`}
                >
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0">
                    <span className="font-display text-base sm:text-lg text-[var(--color-ink-primary)] truncate">
                      {ghost.callsign}
                    </span>
                    {isSelected && (
                      <CheckCircle
                        size={16}
                        weight="fill"
                        className="text-[var(--color-accent-primary)] shrink-0 hidden sm:inline"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="hidden sm:block sm:col-span-2">
                    <span className="px-2 py-0.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
                      {REGIME_LABELS[ghost.regime] ?? "Momentum"}
                    </span>
                  </div>

                  <div className="col-span-3 sm:col-span-2 text-right font-data text-sm sm:text-base font-semibold text-[var(--color-semantic-long)]">
                    {formatBps(ghost.targetReturnBps)}
                  </div>

                  <div className="col-span-4 sm:col-span-2 text-right font-data text-sm sm:text-base font-medium text-[var(--color-ink-primary)]">
                    {formatSol(ghost.stakeLamports)} SOL
                  </div>

                  <div className="hidden sm:block sm:col-span-2 text-right font-data text-sm text-[var(--color-ink-secondary)]">
                    {ghost.wins}W - {ghost.losses}L
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
