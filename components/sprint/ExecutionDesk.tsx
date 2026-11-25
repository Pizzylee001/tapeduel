"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  ArrowsLeftRight,
  CheckCircle,
  FlagCheckered,
  Lightning,
  Play,
  Shield,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useTapeDuel } from "@/components/providers/SolanaWalletProvider";
import {
  CARD_META,
  SPRINT_DURATION_SECS,
  VRF_ER_QUEUE,
  explorerTxUrl,
} from "@/lib/solana/config";
import {
  GhostTapeAccount,
  SprintRunAccount,
  TapeMove,
  buildActivateCardErIx,
  buildRebalanceErIx,
  buildRequestVrfCardsIx,
  buildSettleAndUndelegateErIx,
  buildStartSprintErIx,
  decodeSprintRun,
} from "@/lib/solana/codec";
import { fetchGhostById, fetchSprintAccount, getErConnection } from "@/lib/solana/client";
import { loadSprintSessionKey } from "@/lib/solana/sessionKey";
import {
  LocalSprintRecord,
  PRACTICE_GHOSTS,
  computeClientMarkDeltaBps,
  formatBps,
  formatSol,
  ghostPaceAtSecond,
  saveLocalSprintRecord,
  shortKey,
} from "@/lib/solana/practiceData";
import { CurvePoint, OscilloscopeChart } from "./OscilloscopeChart";

interface ReceiptItem {
  id: string;
  action: string;
  ms: number;
  sig: string;
  cluster: "er" | "devnet" | "local";
  ts: number;
}

type AssetIndex = 0 | 1 | 2;
const ASSETS: Array<{ idx: AssetIndex; symbol: "SOL" | "BTC" | "ETH"; label: string }> = [
  { idx: 0, symbol: "SOL", label: "Solana" },
  { idx: 1, symbol: "BTC", label: "Bitcoin" },
  { idx: 2, symbol: "ETH", label: "Ethereum" },
];

const STEP_PRESETS = [0, 25, 50, 75, 100] as const;

export function ExecutionDesk({ sprintId }: { sprintId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryTxParam = searchParams.get("entryTx") || undefined;

  const { pyth, ghosts } = useTapeDuel();
  const isPractice = sprintId.startsWith("practice-");

  const [onChainSprint, setOnChainSprint] = useState<SprintRunAccount | null>(null);
  const [ghost, setGhost] = useState<GhostTapeAccount | null>(null);
  const [sessionKey, setSessionKey] = useState<Keypair | null>(null);

  // Sprint runtime state
  const [phase, setPhase] = useState<"ready" | "running" | "settling" | "settled">("ready");
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);
  const [weights, setWeights] = useState<[number, number, number]>([50, 25, 0]);
  const [draftWeights, setDraftWeights] = useState<[number, number, number]>([50, 25, 0]);
  const [pnlBps, setPnlBps] = useState<number>(0);
  const [cards, setCards] = useState<[number, number, number]>([1, 2, 3]);
  const [cardsDealt, setCardsDealt] = useState<boolean>(false);
  const [cardsUsed, setCardsUsed] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [activeCard, setActiveCard] = useState<number>(0);
  const [activeCardUntilMs, setActiveCardUntilMs] = useState<number>(0);
  const [vrfSeedHex, setVrfSeedHex] = useState<string>("");
  const [moves, setMoves] = useState<TapeMove[]>([]);
  const [curve, setCurve] = useState<CurvePoint[]>([{ sec: 0, userBps: 0, ghostBps: 0 }]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const startMsRef = useRef<number>(0);
  const entryPricesRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastPricesRef = useRef<[number, number, number]>([0, 0, 0]);
  const weightsRef = useRef<[number, number, number]>([50, 25, 0]);
  const pnlRef = useRef<number>(0);
  const activeCardRef = useRef<number>(0);
  const activeCardUntilRef = useRef<number>(0);
  const settledOnceRef = useRef<boolean>(false);
  const vrfSigRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    weightsRef.current = weights;
  }, [weights]);

  useEffect(() => {
    pnlRef.current = pnlBps;
  }, [pnlBps]);

  useEffect(() => {
    activeCardRef.current = activeCard;
    activeCardUntilRef.current = activeCardUntilMs;
  }, [activeCard, activeCardUntilMs]);

  // Load Ghost & On-Chain Sprint PDA if applicable
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (isPractice) {
        const ghostIdNum = Number(sprintId.replace("practice-", "")) || 1;
        const found =
          ghosts.find((g) => g.ghostId === ghostIdNum) ??
          PRACTICE_GHOSTS.find((g) => g.ghostId === ghostIdNum) ??
          PRACTICE_GHOSTS[0];
        if (!cancelled) {
          setGhost(found);
        }
        return;
      }

      const stored = loadSprintSessionKey(sprintId);
      if (!cancelled) setSessionKey(stored);

      const res = await fetchSprintAccount(sprintId, true);
      if (!cancelled && res) {
        setOnChainSprint(res.sprint);
        setWeights(res.sprint.weights);
        setDraftWeights(res.sprint.weights);
        setPnlBps(res.sprint.pnlBps);
        if (res.sprint.vrfFulfilled) {
          setCards(res.sprint.cards);
          setCardsUsed(res.sprint.cardsUsed);
          setCardsDealt(true);
          setVrfSeedHex(res.sprint.vrfSeedHex);
        }
        const g =
          ghosts.find((x) => x.ghostId === res.sprint.ghostId) ??
          (await fetchGhostById(res.sprint.ghostId)) ??
          PRACTICE_GHOSTS[0];
        if (!cancelled) setGhost(g);
      } else if (!cancelled) {
        setStatusError("Sprint PDA not found on MagicBlock ER or Devnet L1 yet.");
        setGhost(PRACTICE_GHOSTS[0]);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [sprintId, isPractice, ghosts]);

  const currentPrices = useMemo<[number, number, number]>(() => {
    if (!pyth) return [0, 0, 0];
    return [pyth.sol.priceUsd, pyth.btc.priceUsd, pyth.eth.priceUsd];
  }, [pyth]);

  const addReceipt = useCallback(
    (action: string, ms: number, sig: string, cluster: "er" | "devnet" | "local") => {
      setReceipts((prev) => [
        { id: `${Date.now()}-${Math.random()}`, action, ms, sig, cluster, ts: Date.now() },
        ...prev.slice(0, 14),
      ]);
    },
    []
  );

  const sendErInstruction = useCallback(
    async (ix: ReturnType<typeof buildRebalanceErIx>, label: string): Promise<string | null> => {
      if (!sessionKey) {
        setStatusError("Session key missing in browser sessionStorage for this Sprint PDA.");
        return null;
      }
      const er = getErConnection();
      const { blockhash } = await er.getLatestBlockhash("confirmed");
      const tx = new Transaction().add(ix);
      tx.recentBlockhash = blockhash;
      tx.feePayer = sessionKey.publicKey;
      tx.sign(sessionKey);

      const t0 = performance.now();
      const sig = await er.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });
      await er.confirmTransaction(sig, "confirmed");
      const ms = Math.max(1, Math.round(performance.now() - t0));
      addReceipt(label, ms, sig, "er");
      return sig;
    },
    [sessionKey, addReceipt]
  );

  const handleSettle = useCallback(async () => {
    if (settledOnceRef.current || !ghost) return;
    settledOnceRef.current = true;
    setPhase("settling");
    setBusyAction(true);

    try {
      const exitPrices: [number, number, number] =
        currentPrices[0] > 0 ? currentPrices : lastPricesRef.current;

      let settleSig: string | undefined;
      if (!isPractice && sessionKey) {
        const sprintPda = new PublicKey(sprintId);
        const sig = await sendErInstruction(
          buildSettleAndUndelegateErIx({
            payer: sessionKey.publicKey,
            sprintPda,
          }),
          "SETTLE + UNDELEGATE"
        );
        if (sig) settleSig = sig;
      } else {
        addReceipt("SETTLE TAPE", 9, `practice-${Date.now().toString(16)}`, "local");
      }

      const finalBps = Math.round(pnlRef.current);
      const recordId = isPractice ? `tape-${Date.now()}` : sprintId;
      const record: LocalSprintRecord = {
        id: recordId,
        mode: isPractice ? "practice" : "onchain",
        ghostId: ghost.ghostId,
        ghostCallsign: ghost.callsign,
        ghostTargetBps: ghost.targetReturnBps,
        ghostMoves: ghost.moves,
        stakeLamports: onChainSprint?.stakeLamports ?? ghost.stakeLamports,
        entryPrices: entryPricesRef.current,
        exitPrices,
        finalPnlBps: finalBps,
        challengerWon: finalBps > ghost.targetReturnBps,
        cards,
        cardsUsed,
        moves,
        curve,
        erReceipts: receipts.map((r) => ({
          action: r.action,
          ms: r.ms,
          sig: r.sig,
          cluster: r.cluster,
          ts: r.ts,
        })),
        entrySig: entryTxParam,
        vrfSig: vrfSigRef.current,
        settleSig,
        vrfSeedHex: vrfSeedHex || "live-pyth-practice-hand",
        sprintPda: isPractice ? undefined : sprintId,
        completedAt: Date.now(),
      };

      saveLocalSprintRecord(record);
      setPhase("settled");
      router.push(`/tapes/${recordId}`);
    } catch (err) {
      settledOnceRef.current = false;
      setPhase("running");
      setStatusError(err instanceof Error ? err.message : "Failed to settle sprint.");
    } finally {
      setBusyAction(false);
    }
  }, [
    ghost,
    currentPrices,
    isPractice,
    sessionKey,
    sprintId,
    sendErInstruction,
    addReceipt,
    onChainSprint,
    cards,
    cardsUsed,
    moves,
    curve,
    receipts,
    entryTxParam,
    vrfSeedHex,
    router,
  ]);

  // Live 250ms clock & live Pyth mark-to-market ticker while sprint is running
  useEffect(() => {
    if (phase !== "running" || !ghost) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      const sec = Math.min(SPRINT_DURATION_SECS, (now - startMsRef.current) / 1000);
      setElapsedSecs(sec);

      if (currentPrices[0] > 0 && lastPricesRef.current[0] > 0) {
        const delta = computeClientMarkDeltaBps(
          weightsRef.current,
          lastPricesRef.current,
          currentPrices,
          activeCardRef.current,
          activeCardUntilRef.current,
          now
        );
        if (delta !== 0) {
          const nextPnl = pnlRef.current + delta;
          pnlRef.current = nextPnl;
          setPnlBps(Math.round(nextPnl));
          lastPricesRef.current = currentPrices;
        }
      }

      const ghostPace = ghostPaceAtSecond(ghost.targetReturnBps, sec);
      setCurve((prev) => {
        const last = prev[prev.length - 1];
        if (last && sec - last.sec < 0.9 && sec < SPRINT_DURATION_SECS) return prev;
        return [
          ...prev,
          { sec: Number(sec.toFixed(1)), userBps: Math.round(pnlRef.current), ghostBps: ghostPace },
        ];
      });

      if (sec >= SPRINT_DURATION_SECS) {
        handleSettle();
      }
    }, 250);

    return () => clearInterval(timer);
  }, [phase, ghost, currentPrices, handleSettle]);

  const handleStartSprint = async () => {
    if (!ghost) return;
    if (currentPrices[0] <= 0) {
      setStatusError("Waiting for live MagicBlock Pyth Lazer SOL/BTC/ETH prices...");
      return;
    }

    setStatusError(null);
    setBusyAction(true);

    try {
      entryPricesRef.current = currentPrices;
      lastPricesRef.current = currentPrices;
      startMsRef.current = Date.now();
      setWeights(draftWeights);
      weightsRef.current = draftWeights;
      setPnlBps(0);
      pnlRef.current = 0;
      setElapsedSecs(0);
      setMoves([
        {
          elapsedSecs: 0,
          solW: draftWeights[0],
          btcW: draftWeights[1],
          ethW: draftWeights[2],
          cardId: 0,
        },
      ]);
      setCurve([{ sec: 0, userBps: 0, ghostBps: 0 }]);

      if (!isPractice && sessionKey) {
        const sprintPda = new PublicKey(sprintId);
        // 1. Trigger MagicBlock VRF card deal inside ER
        const vrfSig = await sendErInstruction(
          buildRequestVrfCardsIx({
            payer: sessionKey.publicKey,
            sprintPda,
            oracleQueue: VRF_ER_QUEUE,
            clientSeed: Math.floor(Math.random() * 255),
          }),
          "VRF DEAL"
        );
        if (vrfSig) vrfSigRef.current = vrfSig;

        // 2. Start 90s sprint on ER locking live Pyth Lazer entry prices
        await sendErInstruction(
          buildStartSprintErIx({
            authority: sessionKey.publicKey,
            sprintPda,
            initialWeights: draftWeights,
          }),
          "START ER"
        );

        // Poll ER for VRF callback fulfillment
        const er = getErConnection();
        const pollVrf = async () => {
          for (let i = 0; i < 20; i++) {
            const info = await er.getAccountInfo(sprintPda);
            if (info?.data) {
              const decoded = decodeSprintRun(sprintId, info.data);
              if (decoded.vrfFulfilled) {
                setCards(decoded.cards);
                setVrfSeedHex(decoded.vrfSeedHex);
                setCardsDealt(true);
                return;
              }
            }
            await new Promise((r) => setTimeout(r, 400));
          }
        };
        pollVrf().catch(() => undefined);
      } else {
        // Practice mode: deal shuffled 3-card hand with WebCrypto entropy and live Pyth entry
        const rnd = new Uint8Array(32);
        if (typeof window !== "undefined" && window.crypto) {
          window.crypto.getRandomValues(rnd);
        }
        const c0 = (rnd[0] % 3) + 1;
        const c1 = ((c0 - 1 + ((rnd[1] % 2) + 1)) % 3) + 1;
        const c2 = (rnd[2] % 3) + 1;
        setCards([c0, c1, c2]);
        setVrfSeedHex(
          Array.from(rnd)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        );
        addReceipt("START PYTH", 11, "live-pyth-entry", "local");
        setTimeout(() => {
          setCardsDealt(true);
          addReceipt("VRF HAND", 14, "practice-vrf-hand", "local");
        }, 320);
      }

      setPhase("running");
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to start sprint.");
    } finally {
      setBusyAction(false);
    }
  };

  const updateDraftWeight = (idx: AssetIndex, nextVal: number) => {
    setDraftWeights((prev) => {
      const clamped = Math.max(-100, Math.min(100, Math.round(nextVal)));
      const otherGross = prev.reduce((sum, w, i) => (i === idx ? sum : sum + Math.abs(w)), 0);
      const maxAllowed = Math.max(0, 100 - otherGross);
      const signed =
        Math.abs(clamped) > maxAllowed ? Math.sign(clamped) * maxAllowed : clamped;
      const copy: [number, number, number] = [...prev];
      copy[idx] = signed;
      return copy;
    });
  };

  const toggleAssetDirection = (idx: AssetIndex) => {
    setDraftWeights((prev) => {
      const copy: [number, number, number] = [...prev];
      if (copy[idx] === 0) {
        const otherGross = prev.reduce((sum, w, i) => (i === idx ? sum : sum + Math.abs(w)), 0);
        const step = Math.min(25, Math.max(0, 100 - otherGross));
        copy[idx] = -step;
      } else {
        copy[idx] = -copy[idx];
      }
      return copy;
    });
  };

  const handleFireRebalance = async (overrideWeights?: [number, number, number]) => {
    const target = overrideWeights ?? draftWeights;
    const gross = Math.abs(target[0]) + Math.abs(target[1]) + Math.abs(target[2]);
    if (gross > 100) {
      setStatusError("Total gross exposure across SOL, BTC, and ETH cannot exceed 100%.");
      return;
    }
    setStatusError(null);

    if (phase !== "running") {
      setWeights(target);
      setDraftWeights(target);
      return;
    }

    setBusyAction(true);
    try {
      const t0 = performance.now();
      if (!isPractice && sessionKey) {
        await sendErInstruction(
          buildRebalanceErIx({
            authority: sessionKey.publicKey,
            sprintPda: new PublicKey(sprintId),
            newWeights: target,
          }),
          `REBAL ${target[0]}/${target[1]}/${target[2]}`
        );
      } else {
        const ms = Math.max(8, Math.round(performance.now() - t0 + 11));
        addReceipt(
          `REBAL ${target[0]}/${target[1]}/${target[2]}`,
          ms,
          `local-${Date.now().toString(16).slice(-6)}`,
          "local"
        );
      }

      setWeights(target);
      setDraftWeights(target);
      weightsRef.current = target;
      setMoves((prev) => [
        ...prev.slice(0, 15),
        {
          elapsedSecs: Math.round(elapsedSecs),
          solW: target[0],
          btcW: target[1],
          ethW: target[2],
          cardId: 0,
        },
      ]);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Rebalance failed on MagicBlock ER.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleActivateCard = useCallback(
    async (slot: 0 | 1 | 2) => {
      if (phase !== "running" || !cardsDealt || cardsUsed[slot]) return;
      const cardId = cards[slot];
      setBusyAction(true);
      setStatusError(null);

      try {
        if (!isPractice && sessionKey) {
          await sendErInstruction(
            buildActivateCardErIx({
              authority: sessionKey.publicKey,
              sprintPda: new PublicKey(sprintId),
              slot,
            }),
            `CARD ${CARD_META[cardId as 1 | 2 | 3]?.shortCode ?? "VRF"}`
          );
        } else {
          addReceipt(
            `CARD ${CARD_META[cardId as 1 | 2 | 3]?.shortCode ?? "VRF"}`,
            12,
            `card-${slot}-${Date.now().toString(16).slice(-4)}`,
            "local"
          );
        }

        const nextUsed: [boolean, boolean, boolean] = [...cardsUsed];
        nextUsed[slot] = true;
        setCardsUsed(nextUsed);

        const now = Date.now();
        let nextWeights: [number, number, number] = [...weightsRef.current];
        if (cardId === 1) {
          setActiveCard(1);
          setActiveCardUntilMs(now + 15_000);
        } else if (cardId === 2) {
          setActiveCard(2);
          setActiveCardUntilMs(now + 12_000);
        } else if (cardId === 3) {
          nextWeights = [-nextWeights[0], -nextWeights[1], -nextWeights[2]];
          setWeights(nextWeights);
          setDraftWeights(nextWeights);
          weightsRef.current = nextWeights;
        }

        setMoves((prev) => [
          ...prev.slice(0, 15),
          {
            elapsedSecs: Math.round(elapsedSecs),
            solW: nextWeights[0],
            btcW: nextWeights[1],
            ethW: nextWeights[2],
            cardId,
          },
        ]);
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "Card activation failed.");
      } finally {
        setBusyAction(false);
      }
    },
    [phase, cardsDealt, cardsUsed, cards, isPractice, sessionKey, sprintId, sendErInstruction, addReceipt, elapsedSecs]
  );

  // Keyboard shortcuts [1] [2] [3] for VRF tactical cards during live sprint
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") handleActivateCard(0);
      if (e.key === "2") handleActivateCard(1);
      if (e.key === "3") handleActivateCard(2);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleActivateCard]);

  const remainingSecs = Math.max(0, SPRINT_DURATION_SECS - elapsedSecs);
  const clockMins = Math.floor(remainingSecs / 60);
  const clockWhole = Math.floor(remainingSecs % 60);
  const clockTenths = Math.floor((remainingSecs % 1) * 10);
  const clockDisplay = `${String(clockMins).padStart(2, "0")}:${String(clockWhole).padStart(
    2,
    "0"
  )}.${clockTenths}`;

  const ghostPaceNow = ghost ? ghostPaceAtSecond(ghost.targetReturnBps, elapsedSecs) : 0;
  const spreadBps = pnlBps - ghostPaceNow;
  const isLeading = spreadBps > 0;
  const activeCardSecsLeft = Math.max(0, Math.ceil((activeCardUntilMs - nowMs) / 1000));
  const draftGross =
    Math.abs(draftWeights[0]) + Math.abs(draftWeights[1]) + Math.abs(draftWeights[2]);
  const draftCash = Math.max(0, 100 - draftGross);
  const weightsDirty =
    draftWeights[0] !== weights[0] ||
    draftWeights[1] !== weights[1] ||
    draftWeights[2] !== weights[2];

  return (
    <div className="space-y-5 animate-stage-in">
      {/* Top Broadcast Race Bar */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div>
            <h1 className="font-display text-2xl sm:text-[28px] leading-tight text-[var(--color-ink-primary)]">
              LIVE EXECUTION DESK
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs">
              <span className="font-data text-[var(--color-ink-secondary)]">
                VS {ghost?.callsign ?? "LOADING..."}
              </span>
              <span className="text-[var(--color-border-strong)]">|</span>
              <span className="px-2 py-0.5 bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] font-data text-[11px] text-[var(--color-semantic-vrf)]">
                {isPractice
                  ? "LIVE PYTH PRACTICE (NOT ESCROWED)"
                  : `DELEGATED ER PDA ${shortKey(sprintId)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Race Clock + Live Spread + Start/Settle Trigger */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="text-left sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              Live Spread
            </div>
            <div
              className={`font-data text-lg sm:text-xl font-semibold ${
                spreadBps > 0
                  ? "text-[var(--color-semantic-long)]"
                  : spreadBps < 0
                  ? "text-[var(--color-semantic-short)]"
                  : "text-[var(--color-ink-secondary)]"
              }`}
            >
              {formatBps(spreadBps)} {spreadBps > 0 ? "LEAD" : spreadBps < 0 ? "TRAIL" : "EVEN"}
            </div>
          </div>

          <div className="bg-[var(--color-canvas-deep)] border border-[var(--color-border-gold)] px-4 py-1.5 min-w-[146px] text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              Sprint Clock
            </div>
            <div className="font-display text-[32px] sm:text-[42px] leading-none text-[var(--color-accent-primary)] font-data">
              {clockDisplay}
            </div>
          </div>

          {phase === "ready" && (
            <button
              type="button"
              disabled={busyAction || !pyth}
              onClick={handleStartSprint}
              className="min-h-[48px] px-5 chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-on-accent)] font-display text-sm uppercase tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <Play size={16} weight="fill" aria-hidden="true" />
              <span>{pyth ? "Start 90s Sprint" : "Syncing Pyth..."}</span>
            </button>
          )}

          {phase === "running" && (
            <button
              type="button"
              disabled={busyAction}
              onClick={handleSettle}
              className="min-h-[48px] px-4 chamfer-btn bg-[var(--color-surface-elevated)] hover:bg-[var(--color-accent-primary)] hover:text-[var(--color-on-accent)] border border-[var(--color-border-gold)] text-[var(--color-accent-primary)] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <FlagCheckered size={16} weight="bold" aria-hidden="true" />
              <span>Settle Early</span>
            </button>
          )}

          {phase === "settling" && (
            <span className="px-4 py-2 bg-[var(--color-surface-inset)] border border-[var(--color-border-gold)] text-xs font-data text-[var(--color-accent-primary)]">
              Settling & Undelegating...
            </span>
          )}
        </div>
      </div>

      {statusError && (
        <div
          role="alert"
          className="px-4 py-3 bg-[var(--color-semantic-short-bg)] border border-[var(--color-semantic-short)]/40 text-sm text-[var(--color-ink-primary)] flex items-center gap-2"
        >
          <WarningCircle size={18} weight="bold" className="text-[var(--color-semantic-short)] shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Stage 1: Full-Width Dual-Curve Oscilloscope */}
      <OscilloscopeChart
        points={curve}
        ghostCallsign={ghost?.callsign ?? "GHOST"}
        ghostTargetBps={ghost?.targetReturnBps}
        currentSec={elapsedSecs}
        userPnlBps={pnlBps}
        ghostPaceBps={ghostPaceNow}
        activeCard={activeCard}
        activeCardSecsLeft={activeCardSecsLeft}
      />

      {/* Stage 2: Asymmetric 7/5 Bottom Action Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left (7 cols): Horizontal 3-Card VRF Tactical Hand + Live Exposure Summary */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg sm:text-xl text-[var(--color-ink-primary)]">
              VRF TACTICAL HAND
            </h2>
            <span className="font-data text-xs text-[var(--color-semantic-vrf)]">
              {cardsDealt
                ? `DEALT | KEYS [1] [2] [3]`
                : phase === "ready"
                ? "SEALED UNTIL SPRINT START"
                : "AWAITING MAGICBLOCK VRF CALLBACK..."}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 vrf-perspective">
            {([0, 1, 2] as const).map((slot) => {
              const cardId = (cards[slot] || 1) as 1 | 2 | 3;
              const meta = CARD_META[cardId];
              const used = cardsUsed[slot];
              const isLiveCard =
                activeCard === cardId && activeCardSecsLeft > 0 && used;
              const Icon =
                cardId === 1 ? Lightning : cardId === 2 ? Shield : ArrowsLeftRight;

              return (
                <div
                  key={slot}
                  className="vrf-card-lift"
                  style={{ transitionDelay: `${slot * 65}ms` }}
                >
                  <div className={`vrf-card-inner ${cardsDealt ? "is-dealt" : ""}`}>
                    {/* Card Back: Cryptographic Teal VRF Stamp */}
                    <div className="vrf-card-face chamfer-card bg-[var(--color-surface-inset)] border border-[var(--color-semantic-vrf)]/50 p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-data text-[var(--color-semantic-vrf)]">
                          SLOT 0{slot + 1}
                        </span>
                        <Sparkle
                          size={16}
                          weight="fill"
                          className="text-[var(--color-semantic-vrf)]"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="my-3 border-y border-[var(--color-semantic-vrf)]/25 py-3 text-center">
                        <div className="font-display text-sm tracking-widest text-[var(--color-semantic-vrf)]">
                          MAGICBLOCK VRF
                        </div>
                        <div className="mt-1 font-data text-[11px] text-[var(--color-ink-muted)]">
                          SEALED CARD
                        </div>
                      </div>
                      <div className="font-data text-[10px] text-[var(--color-ink-muted)] text-center">
                        FLIPS ON CALLBACK
                      </div>
                    </div>

                    {/* Card Front: Armed Tactical Power */}
                    <div
                      className={`vrf-card-face vrf-card-front chamfer-card p-4 flex flex-col justify-between border ${
                        isLiveCard
                          ? "bg-[var(--color-surface-elevated)] border-[var(--color-accent-primary)]"
                          : used
                          ? "bg-[var(--color-surface-inset)] border-[var(--color-border-subtle)] opacity-60"
                          : "bg-[var(--color-surface-elevated)] border-[var(--color-border-gold)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-data text-[11px] font-semibold text-[var(--color-accent-primary)]">
                          [{slot + 1}] {meta.shortCode}
                        </span>
                        <Icon
                          size={18}
                          weight="fill"
                          className={
                            cardId === 1
                              ? "text-[var(--color-accent-primary)]"
                              : cardId === 2
                              ? "text-[var(--color-semantic-long)]"
                              : "text-[var(--color-semantic-vrf)]"
                          }
                          aria-hidden="true"
                        />
                      </div>

                      <div className="my-2">
                        <div className="font-display text-base text-[var(--color-ink-primary)]">
                          {meta.name}
                        </div>
                        <p className="mt-1 text-xs leading-snug text-[var(--color-ink-secondary)]">
                          {meta.summary}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={phase !== "running" || used || busyAction}
                        onClick={() => handleActivateCard(slot)}
                        className={`w-full min-h-[40px] px-3 py-1.5 chamfer-btn text-xs font-semibold uppercase tracking-wider cursor-pointer ${
                          isLiveCard
                            ? "bg-[var(--color-semantic-long)] text-[var(--color-on-accent)]"
                            : used
                            ? "bg-[var(--color-surface-inset)] text-[var(--color-ink-muted)] cursor-not-allowed"
                            : "bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] disabled:opacity-50"
                        }`}
                      >
                        {isLiveCard
                          ? `LIVE ${activeCardSecsLeft}s`
                          : used
                          ? "SPENT"
                          : "ACTIVATE"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Portfolio Allocation Strip & One-Tap Presets */}
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
                Live Portfolio Exposure
              </div>
              <div className="font-data text-xs text-[var(--color-ink-muted)]">
                GROSS <strong className="text-[var(--color-ink-primary)]">{draftGross}%</strong> | CASH{" "}
                <strong className="text-[var(--color-semantic-vrf)]">{draftCash}%</strong>
              </div>
            </div>

            {/* Segmented Bar */}
            <div className="h-3 w-full bg-[var(--color-canvas-deep)] border border-[var(--color-border-subtle)] flex overflow-hidden">
              {ASSETS.map((asset) => {
                const w = draftWeights[asset.idx];
                if (w === 0) return null;
                return (
                  <div
                    key={asset.symbol}
                    style={{ width: `${Math.abs(w)}%` }}
                    title={`${asset.symbol} ${w > 0 ? "LONG" : "SHORT"} ${Math.abs(w)}%`}
                    className={
                      w > 0
                        ? "bg-[var(--color-semantic-long)] border-r border-[var(--color-canvas-deep)]"
                        : "bg-[var(--color-semantic-short)] border-r border-[var(--color-canvas-deep)]"
                    }
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleFireRebalance([0, 0, 0])}
                className="px-3 py-1.5 bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] cursor-pointer"
              >
                100% Cash
              </button>
              <button
                type="button"
                onClick={() => handleFireRebalance([60, 40, 0])}
                className="px-3 py-1.5 bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] cursor-pointer"
              >
                SOL/BTC Long
              </button>
              <button
                type="button"
                onClick={() => handleFireRebalance([50, -50, 0])}
                className="px-3 py-1.5 bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)] cursor-pointer"
              >
                Pair Hedge
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFireRebalance([-draftWeights[0], -draftWeights[1], -draftWeights[2]])
                }
                className="px-3 py-1.5 bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-primary)] cursor-pointer"
              >
                Invert All
              </button>
            </div>
          </div>
        </div>

        {/* Right (5 cols): Rapid-Fire Allocation Pad & ER Confirmation Tape */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-[var(--color-ink-primary)]">
                ALLOCATION PAD
              </h2>
              <span className="font-data text-[11px] text-[var(--color-ink-muted)]">
                0 GAS / SESSION KEY
              </span>
            </div>

            <div className="space-y-3.5">
              {ASSETS.map((asset) => {
                const w = draftWeights[asset.idx];
                const isShort = w < 0;
                const absW = Math.abs(w);
                const livePrice = currentPrices[asset.idx];

                return (
                  <div
                    key={asset.symbol}
                    className="bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm text-[var(--color-ink-primary)]">
                          {asset.symbol}
                        </span>
                        <span className="font-data text-xs text-[var(--color-ink-muted)]">
                          {livePrice > 0 ? `$${livePrice.toFixed(2)}` : "..."}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`font-data text-sm font-semibold ${
                            w > 0
                              ? "text-[var(--color-semantic-long)]"
                              : w < 0
                              ? "text-[var(--color-semantic-short)]"
                              : "text-[var(--color-ink-muted)]"
                          }`}
                        >
                          {w > 0 ? `+${w}%` : `${w}%`}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleAssetDirection(asset.idx)}
                          className={`px-2.5 py-1 min-h-[30px] text-[11px] font-semibold uppercase tracking-wider border cursor-pointer ${
                            isShort
                              ? "bg-[var(--color-semantic-short-bg)] border-[var(--color-semantic-short)]/50 text-[var(--color-semantic-short)]"
                              : "bg-[var(--color-semantic-long-bg)] border-[var(--color-semantic-long)]/50 text-[var(--color-semantic-long)]"
                          }`}
                        >
                          {isShort ? "SHORT" : "LONG"}
                        </button>
                      </div>
                    </div>

                    <input
                      type="range"
                      aria-label={`${asset.symbol} allocation weight`}
                      min={0}
                      max={100}
                      step={5}
                      value={absW}
                      onChange={(e) => {
                        const mag = Number(e.target.value);
                        updateDraftWeight(asset.idx, isShort ? -mag : mag);
                      }}
                      className="w-full tapeduel-slider"
                    />

                    <div className="grid grid-cols-5 gap-1">
                      {STEP_PRESETS.map((pct) => {
                        const selected = absW === pct;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => updateDraftWeight(asset.idx, isShort ? -pct : pct)}
                            className={`py-1 text-[11px] font-data border cursor-pointer ${
                              selected
                                ? "bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] border-[var(--color-accent-primary)] font-semibold"
                                : "bg-[var(--color-surface-raised)] text-[var(--color-ink-secondary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]"
                            }`}
                          >
                            {pct}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={busyAction || (phase === "running" && !weightsDirty)}
              onClick={() => handleFireRebalance()}
              className="w-full min-h-[46px] chamfer-btn bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-on-accent)] font-display text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle size={17} weight="fill" aria-hidden="true" />
              <span>
                {phase === "running"
                  ? weightsDirty
                    ? "Fire Gasless ER Rebalance"
                    : "Positions Synced"
                  : "Lock Opening Weights"}
              </span>
            </button>
          </div>

          {/* ER Confirmation Receipt Tape */}
          <div className="bg-[var(--color-canvas-deep)] border border-[var(--color-border-subtle)] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
                ER Receipt Tape
              </span>
              <span className="font-data text-[11px] text-[var(--color-ink-muted)]">
                {receipts.length} CONFIRMED
              </span>
            </div>

            {receipts.length === 0 ? (
              <p className="text-xs font-data text-[var(--color-ink-muted)] py-2">
                Start the 90s sprint to stream gasless MagicBlock ER confirmations here.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-[168px] overflow-y-auto">
                {receipts.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-xs font-data py-1 border-b border-[var(--color-border-subtle)]/50 last:border-b-0"
                  >
                    <span className="text-[var(--color-ink-primary)] truncate">
                      {item.action}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[var(--color-semantic-long)]">{item.ms}ms</span>
                      {item.cluster !== "local" ? (
                        <a
                          href={explorerTxUrl(item.sig, item.cluster)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-semantic-vrf)] underline"
                        >
                          {item.sig.slice(0, 6)}
                        </a>
                      ) : (
                        <span className="text-[var(--color-ink-muted)]">PYTH</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-1 flex items-center justify-between text-[11px] text-[var(--color-ink-muted)]">
              <span>Stake: {formatSol(onChainSprint?.stakeLamports ?? ghost?.stakeLamports ?? 100_000_000)} SOL</span>
              <Link href="/" className="text-[var(--color-ink-secondary)] hover:text-[var(--color-accent-primary)] underline">
                Back to Arena
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
