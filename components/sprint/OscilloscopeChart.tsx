"use client";

import React from "react";
import { formatBps } from "@/lib/solana/practiceData";

export interface CurvePoint {
  sec: number;
  userBps: number;
  ghostBps: number;
}

interface OscilloscopeChartProps {
  points: CurvePoint[];
  ghostCallsign: string;
  currentSec: number;
  userPnlBps: number;
  ghostPaceBps: number;
  activeCard: number;
  activeCardSecsLeft: number;
}

export function OscilloscopeChart({
  points,
  ghostCallsign,
  currentSec,
  userPnlBps,
  ghostPaceBps,
  activeCard,
  activeCardSecsLeft,
}: OscilloscopeChartProps) {
  const width = 900;
  const height = 220;
  const padX = 36;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const allValues = points.flatMap((p) => [p.userBps, p.ghostBps]);
  allValues.push(0, 120, -60, userPnlBps, ghostPaceBps);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const margin = Math.max(30, (rawMax - rawMin) * 0.16);
  const minVal = rawMin - margin;
  const maxVal = rawMax + margin;
  const range = Math.max(1, maxVal - minVal);

  const toX = (sec: number) => padX + (Math.max(0, Math.min(90, sec)) / 90) * plotW;
  const toY = (bps: number) => padY + ((maxVal - bps) / range) * plotH;

  const zeroY = toY(0);

  const buildPath = (selector: (p: CurvePoint) => number) => {
    if (points.length === 0) return "";
    return points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${toX(p.sec).toFixed(1)} ${toY(selector(p)).toFixed(1)}`)
      .join(" ");
  };

  const userPath = buildPath((p) => p.userBps);
  const ghostPath = buildPath((p) => p.ghostBps);

  const lastPoint = points[points.length - 1] ?? {
    sec: currentSec,
    userBps: userPnlBps,
    ghostBps: ghostPaceBps,
  };
  const lastX = toX(lastPoint.sec);
  const lastUserY = toY(lastPoint.userBps);
  const lastGhostY = toY(lastPoint.ghostBps);

  const areaPath =
    points.length >= 2
      ? `${userPath} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${toX(points[0].sec).toFixed(
          1
        )} ${zeroY.toFixed(1)} Z`
      : "";

  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <div className="relative oscilloscope-grid border border-[var(--color-border-subtle)] overflow-hidden">
      {/* Legend & Active Card Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas-deep)]/90 text-[11px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-wider text-[var(--color-accent-primary)]">
            <span className="w-4 h-[3px] bg-[var(--color-accent-primary)] inline-block" />
            YOU ({formatBps(userPnlBps)})
          </span>
          <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">
            <span className="w-4 border-t-2 border-dashed border-[var(--color-ink-secondary)] inline-block" />
            {ghostCallsign} SEALED PACE ({formatBps(ghostPaceBps)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeCard === 1 && activeCardSecsLeft > 0 && (
            <span className="px-2 py-0.5 bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] font-data font-semibold">
              2X BOOST ACTIVE {activeCardSecsLeft}s
            </span>
          )}
          {activeCard === 2 && activeCardSecsLeft > 0 && (
            <span className="px-2 py-0.5 bg-[var(--color-semantic-long)] text-[var(--color-on-accent)] font-data font-semibold">
              SHIELD ACTIVE {activeCardSecsLeft}s
            </span>
          )}
          <span className="font-data text-[var(--color-ink-muted)]">
            T+{Math.round(currentSec)}s / 90s
          </span>
        </div>
      </div>

      {/* Responsive SVG Oscilloscope */}
      <div className="w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[185px] sm:h-[225px] block"
          role="img"
          aria-label={`Live 90-second race tape comparing your return ${formatBps(
            userPnlBps
          )} against ${ghostCallsign} pace ${formatBps(ghostPaceBps)} at ${Math.round(
            currentSec
          )} seconds`}
        >
          {/* 10s Vertical Timing Markers */}
          {ticks.map((sec) => {
            const x = toX(sec);
            return (
              <g key={sec}>
                <line
                  x1={x}
                  y1={padY}
                  x2={x}
                  y2={height - padY}
                  stroke="rgba(243,239,230,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - 6}
                  textAnchor="middle"
                  fill="#94ADA2"
                  fontSize="10"
                  fontFamily="var(--font-fira), monospace"
                >
                  {sec}s
                </text>
              </g>
            );
          })}

          {/* 0% Baseline */}
          <line
            x1={padX}
            y1={zeroY}
            x2={width - padX}
            y2={zeroY}
            stroke="rgba(243,239,230,0.28)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={padX - 6}
            y={zeroY + 3}
            textAnchor="end"
            fill="#94ADA2"
            fontSize="10"
            fontFamily="var(--font-fira), monospace"
          >
            0%
          </text>

          {/* Subtle Gold Fill Under User Curve */}
          {areaPath && <path d={areaPath} fill="rgba(240, 180, 41, 0.09)" />}

          {/* Ghost Sealed Pace Curve (Dashed Bone) */}
          {ghostPath && (
            <path
              d={ghostPath}
              fill="none"
              stroke="#B6C9C0"
              strokeWidth="1.9"
              strokeDasharray="6 4"
            />
          )}

          {/* User Live Equity Curve (Championship Gold) */}
          {userPath && (
            <path
              d={userPath}
              fill="none"
              stroke="#F0B429"
              strokeWidth="2.9"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Live Endpoints */}
          <circle cx={lastX} cy={lastGhostY} r="3.5" fill="#B6C9C0" />
          <circle
            cx={lastX}
            cy={lastUserY}
            r="5"
            fill="#F0B429"
            stroke="#091511"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
}
