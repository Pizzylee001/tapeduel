"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Crosshair,
  FilmStrip,
  FlagCheckered,
  Vault,
  Wallet,
  Broadcast,
  ArrowUpRight,
  ArrowDownRight,
} from "@phosphor-icons/react";
import { useTapeDuel } from "@/components/providers/SolanaWalletProvider";
import { formatSol, shortKey } from "@/lib/solana/practiceData";

const NAV_ITEMS = [
  { href: "/", label: "Arena", match: (p: string) => p === "/", icon: FlagCheckered },
  {
    href: "/sprint/practice-1",
    label: "Desk",
    match: (p: string) => p.startsWith("/sprint"),
    icon: Crosshair,
  },
  {
    href: "/tapes/latest",
    label: "Replay",
    match: (p: string) => p.startsWith("/tapes"),
    icon: FilmStrip,
  },
  {
    href: "/vault",
    label: "Vault",
    match: (p: string) => p.startsWith("/vault"),
    icon: Vault,
  },
] as const;

function PriceTickerCell({
  symbol,
  price,
  prevPrice,
}: {
  symbol: string;
  price?: number;
  prevPrice?: number;
}) {
  const diff = price && prevPrice ? price - prevPrice : 0;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[11px] font-semibold tracking-wider text-[var(--color-ink-muted)]">
        {symbol}
      </span>
      <span className="font-data text-[13px] font-medium text-[var(--color-ink-primary)]">
        {price ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "..."}
      </span>
      {isUp && (
        <span className="inline-flex items-center text-[11px] font-data text-[var(--color-semantic-long)]">
          <ArrowUpRight size={12} weight="bold" aria-hidden="true" />
        </span>
      )}
      {isDown && (
        <span className="inline-flex items-center text-[11px] font-data text-[var(--color-semantic-short)]">
          <ArrowDownRight size={12} weight="bold" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

export function PaddockShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { pyth, prevPyth, oracleHealth, vault } = useTapeDuel();

  const handleWalletClick = () => {
    if (connected) {
      disconnect().catch(() => undefined);
    } else {
      setVisible(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Fixed 84px Left Vertical Paddock Rail */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex fixed left-0 top-0 bottom-0 w-[84px] z-40 flex-col items-center justify-between bg-[var(--color-surface-inset)] border-r border-[var(--color-border-subtle)] py-4"
      >
        {/* Chamfered Emblem */}
        <Link
          href="/"
          aria-label="TapeDuel Home"
          className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
        >
          <div className="w-11 h-11 chamfer-btn bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] flex items-center justify-center font-display text-lg tracking-tight">
            TD
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink-primary)]">
            DUEL
          </span>
        </Link>

        {/* 4 Vertical Route Tabs */}
        <nav className="flex flex-col w-full gap-1 my-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center py-3.5 gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  active
                    ? "text-[var(--color-accent-primary)] bg-[var(--color-surface-raised)]"
                    : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] hover:bg-[var(--color-surface-raised)]/60"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-accent-primary)]"
                  />
                )}
                <Icon size={21} weight={active ? "fill" : "regular"} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Wallet Control */}
        <button
          type="button"
          onClick={handleWalletClick}
          title={connected && publicKey ? `Connected: ${publicKey.toBase58()} (click to disconnect)` : "Connect Solana Devnet Wallet"}
          className={`w-[66px] py-2.5 px-1 chamfer-btn border text-[10px] font-semibold uppercase tracking-wider flex flex-col items-center gap-1 cursor-pointer ${
            connected
              ? "bg-[var(--color-surface-elevated)] border-[var(--color-border-gold)] text-[var(--color-accent-primary)]"
              : "bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] text-[var(--color-ink-primary)] hover:border-[var(--color-border-gold)]"
          }`}
        >
          <Wallet size={18} weight={connected ? "fill" : "regular"} aria-hidden="true" />
          <span className="font-data text-[10px]">
            {connected && publicKey ? shortKey(publicKey.toBase58()).slice(0, 6) : "Wallet"}
          </span>
        </button>
      </aside>

      {/* Mobile Compact 56px Top Header */}
      <header className="md:hidden sticky top-0 z-40 h-14 px-4 flex items-center justify-between bg-[var(--color-surface-inset)] border-b border-[var(--color-border-subtle)]">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 chamfer-btn bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] flex items-center justify-center font-display text-sm">
            TD
          </span>
          <span className="font-display text-lg tracking-wide text-[var(--color-ink-primary)]">
            TAPEDUEL
          </span>
        </Link>
        <button
          type="button"
          onClick={handleWalletClick}
          className="h-9 px-3 chamfer-btn bg-[var(--color-surface-raised)] border border-[var(--color-border-gold)] text-[var(--color-accent-primary)] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
        >
          <Wallet size={15} weight="bold" aria-hidden="true" />
          <span className="font-data">
            {connected && publicKey ? shortKey(publicKey.toBase58()) : "Connect"}
          </span>
        </button>
      </header>

      {/* Main Fluid Workspace */}
      <div className="flex-1 md:pl-[84px] flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Recessed Live Pyth Lazer Telemetry Strip */}
        <div className="w-full min-h-[38px] bg-[var(--color-canvas-deep)] border-b border-[var(--color-border-subtle)] px-4 lg:px-8 flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5 py-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-6">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Broadcast
                size={14}
                weight="bold"
                className={
                  oracleHealth === "live"
                    ? "text-[var(--color-semantic-vrf)]"
                    : "text-[var(--color-accent-primary)]"
                }
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-semantic-vrf)]">
                {oracleHealth === "live" ? "PYTH ER LIVE" : oracleHealth === "stale" ? "RECONNECTING" : "CONNECTING"}
              </span>
            </div>
            <PriceTickerCell
              symbol="SOL/USD"
              price={pyth?.sol.priceUsd}
              prevPrice={prevPyth?.sol.priceUsd}
            />
            <PriceTickerCell
              symbol="BTC/USD"
              price={pyth?.btc.priceUsd}
              prevPrice={prevPyth?.btc.priceUsd}
            />
            <PriceTickerCell
              symbol="ETH/USD"
              price={pyth?.eth.priceUsd}
              prevPrice={prevPyth?.eth.priceUsd}
            />
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] font-data text-[var(--color-ink-muted)] whitespace-nowrap">
            <span>
              ER: <strong className="text-[var(--color-ink-secondary)] font-medium">devnet-eu</strong>
              {pyth ? ` (${pyth.latencyMs}ms)` : ""}
            </span>
            <span className="text-[var(--color-border-strong)]">|</span>
            <span>
              VAULT:{" "}
              <strong className="text-[var(--color-accent-primary)] font-semibold">
                {vault ? `${formatSol(vault.availableLamports)} SOL` : connected ? "0.00 SOL" : "DISCONNECTED"}
              </strong>
            </span>
          </div>
        </div>

        {/* Route Content */}
        <main className="w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Persistent 64px Bottom Dock */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[var(--color-surface-inset)] border-t border-[var(--color-border-subtle)] grid grid-cols-4"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${
                active
                  ? "text-[var(--color-accent-primary)] bg-[var(--color-surface-raised)]"
                  : "text-[var(--color-ink-muted)]"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--color-accent-primary)]"
                />
              )}
              <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
