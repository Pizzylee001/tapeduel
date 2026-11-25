"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  ArrowDownLeft,
  ArrowSquareOut,
  ArrowUpRight,
  CheckCircle,
  Drop,
  ShieldCheck,
  Trophy,
  Wallet,
  WarningCircle,
} from "@phosphor-icons/react";
import { useTapeDuel } from "@/components/providers/SolanaWalletProvider";
import {
  REGIME_LABELS,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/lib/solana/config";
import {
  buildClaimBountyIx,
  buildDepositIx,
  buildWithdrawIx,
  getTreasuryPda,
  getVaultPda,
} from "@/lib/solana/codec";
import { getL1Connection } from "@/lib/solana/client";
import { formatBps, formatSol, shortKey } from "@/lib/solana/practiceData";

const QUICK_AMOUNTS = ["0.10", "0.25", "0.50", "1.00"] as const;

export function VaultConsole() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const {
    vault,
    walletSolLamports,
    treasuryLamports,
    ghosts,
    isProgramLiveOnDevnet,
    refreshChainState,
  } = useTapeDuel();

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amountInput, setAmountInput] = useState<string>("0.25");
  const [busy, setBusy] = useState<boolean>(false);
  const [airdropBusy, setAirdropBusy] = useState<boolean>(false);
  const [claimingGhostId, setClaimingGhostId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; sig?: string } | null>(null);

  const myGhosts = useMemo(() => {
    if (!publicKey) return [];
    const pk = publicKey.toBase58();
    return ghosts.filter((g) => g.creator === pk && !g.address.startsWith("practice-"));
  }, [ghosts, publicKey]);

  const totalClaimableLamports = useMemo(() => {
    return myGhosts.reduce((sum, g) => sum + g.unclaimedBountyLamports, 0);
  }, [myGhosts]);

  const handleVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    if (!isProgramLiveOnDevnet) {
      setErrorMsg(
        "The TapeDuel program is not yet funded and initialized on Devnet. Use Live-Price Practice on the Arena or run anchor deploy first."
      );
      return;
    }

    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMsg("Enter a valid positive SOL amount (for example, 0.25).");
      return;
    }

    const lamports = Math.round(parsed * LAMPORTS_PER_SOL);
    if (mode === "deposit" && lamports > walletSolLamports) {
      setErrorMsg(
        `Insufficient wallet balance (${formatSol(walletSolLamports, 3)} SOL available). Request a Devnet airdrop below first.`
      );
      return;
    }
    if (mode === "withdraw" && (!vault || lamports > vault.availableLamports)) {
      setErrorMsg(
        `Insufficient unlocked vault balance (${formatSol(vault?.availableLamports ?? 0, 3)} SOL available).`
      );
      return;
    }

    setBusy(true);
    try {
      const l1 = getL1Connection();
      const ix =
        mode === "deposit"
          ? buildDepositIx(publicKey, lamports)
          : buildWithdrawIx(publicKey, lamports);
      const sig = await sendTransaction(new Transaction().add(ix), l1);
      await l1.confirmTransaction(sig, "confirmed");
      setSuccessMsg({
        text:
          mode === "deposit"
            ? `Deposited ${parsed.toFixed(2)} SOL into escrow vault.`
            : `Withdrew ${parsed.toFixed(2)} SOL back to your wallet.`,
        sig,
      });
      await refreshChainState();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Vault transaction failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleAirdrop = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    setAirdropBusy(true);
    try {
      const l1 = getL1Connection();
      const sig = await l1.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      await l1.confirmTransaction(sig, "confirmed");
      setSuccessMsg({
        text: "Received 1.00 Devnet test SOL airdrop.",
        sig,
      });
      await refreshChainState();
    } catch {
      setErrorMsg(
        "Solana Devnet RPC faucet is currently rate-limited for your IP. Use faucet.solana.com with your connected address."
      );
    } finally {
      setAirdropBusy(false);
    }
  };

  const handleClaimBounty = async (ghostId: number) => {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    setClaimingGhostId(ghostId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const l1 = getL1Connection();
      const tx = new Transaction().add(
        buildClaimBountyIx({
          creator: publicKey,
          ghostId,
        })
      );
      const sig = await sendTransaction(tx, l1);
      await l1.confirmTransaction(sig, "confirmed");
      setSuccessMsg({
        text: `Claimed 10% defense bounty for Ghost #${ghostId}.`,
        sig,
      });
      await refreshChainState();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to claim bounty.");
    } finally {
      setClaimingGhostId(null);
    }
  };

  const vaultPdaStr = publicKey ? getVaultPda(publicKey).toBase58() : null;
  const treasuryPdaStr = getTreasuryPda().toBase58();

  return (
    <div className="space-y-7 animate-stage-in">
      {/* Masthead */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-5">
        <div>
          <h1 className="font-display text-[28px] sm:text-[36px] leading-[1.08] text-[var(--color-ink-primary)]">
            BANKROLL & GHOSTS
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-ink-secondary)] max-w-2xl">
            Manage your Solana Devnet L1 escrow vault, request Devnet test SOL, and collect 10% defense bounties earned by your published Bounty Ghosts.
          </p>
        </div>

        <a
          href={explorerAddressUrl(treasuryPdaStr, "devnet")}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] font-data text-xs text-[var(--color-ink-secondary)] self-start sm:self-end inline-flex items-center gap-1.5"
        >
          <span>TREASURY {formatSol(treasuryLamports)} SOL</span>
          <ArrowSquareOut size={13} />
        </a>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-[var(--color-semantic-short-bg)] border border-[var(--color-semantic-short)]/40 text-sm text-[var(--color-ink-primary)] flex items-start gap-2.5"
        >
          <WarningCircle
            size={18}
            weight="bold"
            className="text-[var(--color-semantic-short)] shrink-0 mt-0.5"
          />
          <div className="space-y-1">
            <p>{errorMsg}</p>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent-primary)] underline"
            >
              Open official faucet.solana.com <ArrowSquareOut size={13} />
            </a>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[var(--color-semantic-long-bg)] border border-[var(--color-semantic-long)]/40 text-sm text-[var(--color-ink-primary)] flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[var(--color-semantic-long)] font-semibold">
            <CheckCircle size={18} weight="fill" />
            {successMsg.text}
          </span>
          {successMsg.sig && (
            <a
              href={explorerTxUrl(successMsg.sig, "devnet")}
              target="_blank"
              rel="noreferrer"
              className="font-data text-xs underline text-[var(--color-ink-primary)] inline-flex items-center gap-1"
            >
              View Devnet Tx <ArrowSquareOut size={13} />
            </a>
          )}
        </div>
      )}

      {/* Asymmetric 5/7 Split per DESIGN.md */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (5 cols): Escrow Deposit/Withdraw Console */}
        <section
          aria-label="Solana Devnet escrow console"
          className="lg:col-span-5 chamfer-stage bg-[var(--color-surface-raised)] border border-[var(--color-border-gold)] p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-[var(--color-ink-primary)]">
              ESCROW VAULT
            </h2>
            {vaultPdaStr && (
              <a
                href={explorerAddressUrl(vaultPdaStr, "devnet")}
                target="_blank"
                rel="noreferrer"
                className="font-data text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-accent-primary)] underline"
              >
                PDA {shortKey(vaultPdaStr)}
              </a>
            )}
          </div>

          {/* Live Balances Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Available Escrow
              </div>
              <div className="mt-1 font-data text-xl font-semibold text-[var(--color-accent-primary)]">
                {vault ? `${formatSol(vault.availableLamports)} SOL` : "0.00 SOL"}
              </div>
            </div>

            <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Locked in Duel
              </div>
              <div className="mt-1 font-data text-xl font-semibold text-[var(--color-ink-primary)]">
                {vault ? `${formatSol(vault.lockedLamports)} SOL` : "0.00 SOL"}
              </div>
            </div>

            <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Devnet Wallet
              </div>
              <div className="mt-1 font-data text-base font-medium text-[var(--color-ink-secondary)]">
                {connected ? `${formatSol(walletSolLamports, 3)} SOL` : "Not Connected"}
              </div>
            </div>

            <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Duel Record
              </div>
              <div className="mt-1 font-data text-base font-medium text-[var(--color-ink-secondary)]">
                {vault ? `${vault.totalWins}W - ${vault.totalLosses}L` : "0W - 0L"}
              </div>
            </div>
          </div>

          {/* Deposit / Withdraw Switch */}
          <div className="grid grid-cols-2 border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)]">
            <button
              type="button"
              onClick={() => {
                setMode("deposit");
                setErrorMsg(null);
              }}
              className={`min-h-[42px] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                mode === "deposit"
                  ? "bg-[var(--color-accent-primary)] text-[var(--color-on-accent)]"
                  : "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]"
              }`}
            >
              <ArrowDownLeft size={15} weight="bold" />
              <span>Deposit SOL</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("withdraw");
                setErrorMsg(null);
              }}
              className={`min-h-[42px] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                mode === "withdraw"
                  ? "bg-[var(--color-accent-primary)] text-[var(--color-on-accent)]"
                  : "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]"
              }`}
            >
              <ArrowUpRight size={15} weight="bold" />
              <span>Withdraw SOL</span>
            </button>
          </div>

          <form onSubmit={handleVaultSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="vault-amount"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]"
              >
                {mode === "deposit" ? "Amount to Deposit (Devnet SOL)" : "Amount to Withdraw (SOL)"}
              </label>
              <input
                id="vault-amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full min-h-[46px] px-3.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-strong)] font-data text-base text-[var(--color-ink-primary)]"
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountInput(amt)}
                  className={`py-2 text-xs font-data border cursor-pointer ${
                    amountInput === amt
                      ? "bg-[var(--color-surface-elevated)] border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                      : "bg-[var(--color-surface-inset)] border-[var(--color-border-subtle)] text-[var(--color-ink-secondary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {amt} SOL
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-on-accent)] font-display text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wallet size={17} weight="fill" aria-hidden="true" />
              <span>
                {!connected
                  ? "Connect Devnet Wallet"
                  : busy
                  ? "Confirming on Solana L1..."
                  : mode === "deposit"
                  ? `Deposit ${amountInput || "0"} SOL`
                  : `Withdraw ${amountInput || "0"} SOL`}
              </span>
            </button>
          </form>

          {/* Devnet Airdrop Helper */}
          <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
                Need Devnet Test SOL?
              </span>
              <a
                href="https://faucet.solana.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--color-semantic-vrf)] hover:underline inline-flex items-center gap-1"
              >
                Web Faucet <ArrowSquareOut size={12} />
              </a>
            </div>
            <button
              type="button"
              disabled={airdropBusy}
              onClick={handleAirdrop}
              className="w-full min-h-[42px] bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-primary)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Drop size={15} weight="fill" className="text-[var(--color-semantic-vrf)]" />
              <span>{airdropBusy ? "Requesting Devnet Airdrop..." : "Request 1.00 Devnet SOL"}</span>
            </button>
            <p className="text-[11px] text-[var(--color-ink-muted)] flex items-start gap-1.5">
              <ShieldCheck size={14} className="text-[var(--color-semantic-long)] shrink-0 mt-0.5" />
              <span>
                Withdrawals strictly require your primary wallet signature on Solana L1. Ephemeral ER session keys cannot move vault funds.
              </span>
            </p>
          </div>
        </section>

        {/* Right (7 cols): Published Bounty Ghosts & Claimable Defense Bounties */}
        <section
          aria-label="Published Bounty Ghosts and defense bounties"
          className="lg:col-span-7 space-y-4"
        >
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl text-[var(--color-ink-primary)]">
                YOUR PUBLISHED BOUNTY GHOSTS
              </h2>
              <p className="mt-1 text-xs text-[var(--color-ink-secondary)]">
                Each winning tape you publish defends the Arena automatically and collects 10% of every defeated challenger&apos;s stake.
              </p>
            </div>

            <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-gold)] px-4 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Claimable Bounties
              </div>
              <div className="font-data text-lg font-semibold text-[var(--color-accent-primary)]">
                {formatSol(totalClaimableLamports, 4)} SOL
              </div>
            </div>
          </div>

          {!connected ? (
            <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-8 text-center space-y-3">
              <Trophy
                size={32}
                weight="duotone"
                className="mx-auto text-[var(--color-accent-primary)]"
              />
              <p className="text-sm text-[var(--color-ink-secondary)]">
                Connect your Solana Devnet wallet to view your published Bounty Ghosts and claim accumulated 10% defense cuts.
              </p>
              <button
                type="button"
                onClick={() => setVisible(true)}
                className="px-5 py-2.5 chamfer-btn bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] font-display text-xs uppercase tracking-wider cursor-pointer"
              >
                Connect Wallet
              </button>
            </div>
          ) : myGhosts.length === 0 ? (
            <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-8 text-center space-y-3">
              <p className="font-display text-lg text-[var(--color-ink-primary)]">
                NO PUBLISHED GHOSTS FOR {shortKey(publicKey?.toBase58() ?? "")}
              </p>
              <p className="text-sm text-[var(--color-ink-secondary)] max-w-md mx-auto">
                Beat any active Bounty Ghost in a 90-second duel, then publish your winning tape from the Replay & Proof Room to start collecting 10% defense bounties.
              </p>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex px-5 py-2.5 chamfer-btn bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] font-display text-xs uppercase tracking-wider"
                >
                  Enter Arena Lobby
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-subtle)]">
              {myGhosts.map((g) => (
                <div
                  key={g.address}
                  className="bg-[var(--color-surface-raised)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-display text-lg text-[var(--color-ink-primary)]">
                        {g.callsign}
                      </span>
                      <span className="px-2 py-0.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] text-[11px] font-semibold uppercase text-[var(--color-ink-secondary)]">
                        {REGIME_LABELS[g.regime] ?? "Momentum"}
                      </span>
                      <span className="font-data text-xs text-[var(--color-semantic-long)] font-semibold">
                        TARGET {formatBps(g.targetReturnBps)}
                      </span>
                    </div>
                    <div className="font-data text-xs text-[var(--color-ink-muted)] flex flex-wrap gap-3">
                      <span>RECORD: {g.wins}W - {g.losses}L</span>
                      <span>TOTAL EARNED: {formatSol(g.bountyEarnedLamports, 4)} SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                        Unclaimed
                      </div>
                      <div className="font-data text-sm font-semibold text-[var(--color-accent-primary)]">
                        {formatSol(g.unclaimedBountyLamports, 4)} SOL
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={g.unclaimedBountyLamports <= 0 || claimingGhostId === g.ghostId}
                      onClick={() => handleClaimBounty(g.ghostId)}
                      className="min-h-[40px] px-4 chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-[var(--color-on-accent)] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                    >
                      {claimingGhostId === g.ghostId ? "Claiming..." : "Claim"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Arena Overview Reference List */}
          <div className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
                Arena Bounty Rules
              </span>
              <span className="font-data text-[var(--color-semantic-vrf)]">
                ON-CHAIN SOLVENCY
              </span>
            </div>
            <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed">
              Every challenger locks test SOL into their personal PlayerVault PDA on Solana Devnet before delegating their SprintRun PDA to MagicBlock ER. Winning returns the locked stake plus 85% profit from the ArenaTreasury PDA; losing routes 10% directly to the defending Ghost&apos;s unclaimed bounty ledger.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
