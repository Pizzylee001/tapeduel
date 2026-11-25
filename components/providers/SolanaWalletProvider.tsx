"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { SOLANA_RPC_URL } from "@/lib/solana/config";
import {
  ArenaConfigAccount,
  GhostTapeAccount,
  PlayerVaultAccount,
} from "@/lib/solana/codec";
import {
  fetchAllGhosts,
  fetchArenaConfig,
  fetchPlayerVault,
  fetchTreasuryBalanceLamports,
  getL1Connection,
} from "@/lib/solana/client";
import { PythSnapshot, fetchLivePythSnapshot } from "@/lib/solana/pyth";
import { PRACTICE_GHOSTS } from "@/lib/solana/practiceData";

export type OracleHealth = "connecting" | "live" | "stale";

interface TapeDuelContextValue {
  pyth: PythSnapshot | null;
  prevPyth: PythSnapshot | null;
  oracleHealth: OracleHealth;
  arena: ArenaConfigAccount | null;
  treasuryLamports: number;
  ghosts: GhostTapeAccount[];
  isProgramLiveOnDevnet: boolean;
  vault: PlayerVaultAccount | null;
  walletSolLamports: number;
  loadingChain: boolean;
  chainError: string | null;
  refreshChainState: () => Promise<void>;
}

const TapeDuelContext = createContext<TapeDuelContextValue | null>(null);

function TapeDuelStateProvider({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const [pyth, setPyth] = useState<PythSnapshot | null>(null);
  const [prevPyth, setPrevPyth] = useState<PythSnapshot | null>(null);
  const [oracleHealth, setOracleHealth] = useState<OracleHealth>("connecting");

  const [arena, setArena] = useState<ArenaConfigAccount | null>(null);
  const [treasuryLamports, setTreasuryLamports] = useState<number>(0);
  const [ghosts, setGhosts] = useState<GhostTapeAccount[]>([]);
  const [isProgramLiveOnDevnet, setIsProgramLiveOnDevnet] = useState<boolean>(false);
  const [vault, setVault] = useState<PlayerVaultAccount | null>(null);
  const [walletSolLamports, setWalletSolLamports] = useState<number>(0);
  const [loadingChain, setLoadingChain] = useState<boolean>(true);
  const [chainError, setChainError] = useState<string | null>(null);

  const latestPythRef = useRef<PythSnapshot | null>(null);

  // Live MagicBlock ER Pyth Lazer stream (SOL/BTC/ETH every 750ms)
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const snap = await fetchLivePythSnapshot();
        if (!active) return;
        if (latestPythRef.current) {
          setPrevPyth(latestPythRef.current);
        }
        latestPythRef.current = snap;
        setPyth(snap);
        setOracleHealth("live");
      } catch {
        if (!active) return;
        setOracleHealth((prev) => (prev === "live" ? "stale" : "connecting"));
      } finally {
        if (active) {
          timer = setTimeout(poll, 750);
        }
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const refreshChainState = useCallback(async () => {
    setLoadingChain(true);
    setChainError(null);
    try {
      const conn = getL1Connection();
      const [arenaRes, ghostsRes, treasuryBal] = await Promise.all([
        fetchArenaConfig(conn).catch(() => null),
        fetchAllGhosts(conn).catch(() => []),
        fetchTreasuryBalanceLamports(conn).catch(() => 0),
      ]);

      setArena(arenaRes);
      setTreasuryLamports(treasuryBal);
      if (arenaRes && ghostsRes.length > 0) {
        setGhosts(ghostsRes);
        setIsProgramLiveOnDevnet(true);
      } else {
        setGhosts(PRACTICE_GHOSTS);
        setIsProgramLiveOnDevnet(Boolean(arenaRes));
      }

      if (publicKey) {
        const [vaultRes, solBal] = await Promise.all([
          fetchPlayerVault(publicKey, conn).catch(() => null),
          conn.getBalance(publicKey).catch(() => 0),
        ]);
        setVault(vaultRes);
        setWalletSolLamports(solBal);
      } else {
        setVault(null);
        setWalletSolLamports(0);
      }
    } catch (err) {
      setChainError(err instanceof Error ? err.message : "Failed to reach Solana Devnet RPC");
      setGhosts(PRACTICE_GHOSTS);
    } finally {
      setLoadingChain(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refreshChainState();
  }, [refreshChainState]);

  const value = useMemo<TapeDuelContextValue>(
    () => ({
      pyth,
      prevPyth,
      oracleHealth,
      arena,
      treasuryLamports,
      ghosts,
      isProgramLiveOnDevnet,
      vault,
      walletSolLamports,
      loadingChain,
      chainError,
      refreshChainState,
    }),
    [
      pyth,
      prevPyth,
      oracleHealth,
      arena,
      treasuryLamports,
      ghosts,
      isProgramLiveOnDevnet,
      vault,
      walletSolLamports,
      loadingChain,
      chainError,
      refreshChainState,
    ]
  );

  return <TapeDuelContext.Provider value={value}>{children}</TapeDuelContext.Provider>;
}

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <TapeDuelStateProvider>{children}</TapeDuelStateProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function useTapeDuel(): TapeDuelContextValue {
  const ctx = useContext(TapeDuelContext);
  if (!ctx) {
    throw new Error("useTapeDuel must be used inside SolanaWalletProvider");
  }
  return ctx;
}
