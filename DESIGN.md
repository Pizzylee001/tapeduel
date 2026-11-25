---
title: TapeDuel Design System (Rotated Direction v2)
version: 2.0.0
status: approved
surfaceMode: operate
brandTheme: racing-forest-championship-gold
dials:
  antislop:
    energy: 3
    rhythm: 3
    motion: 2
  layout:
    variance: 8
    motion: 6
    density: 7
tokens:
  color:
    canvas: "#0B1B16"
    canvasSpotlight: "#143027"
    canvasDeep: "#07120E"
    surfaceRaised: "#122720"
    surfaceElevated: "#18332A"
    surfaceInset: "#081410"
    inkPrimary: "#F3EFE6"
    inkSecondary: "#B6C9C0"
    inkMuted: "#94ADA2"
    borderSubtle: "rgba(243, 239, 230, 0.14)"
    borderStrong: "rgba(243, 239, 230, 0.30)"
    borderGold: "rgba(240, 180, 41, 0.55)"
    accentPrimary: "#F0B429"
    accentPrimaryHover: "#F7C64E"
    onAccentPrimary: "#091511"
    semanticLong: "#34D399"
    semanticLongBg: "rgba(52, 211, 153, 0.12)"
    semanticShort: "#FB7185"
    semanticShortBg: "rgba(251, 113, 133, 0.12)"
    semanticVrf: "#2DD4BF"
    semanticVrfBg: "rgba(45, 212, 191, 0.12)"
  typography:
    display:
      fontFamily: "'Russo One', 'Arial Black', sans-serif"
      weights: [400]
      letterSpacing: "0.01em"
      lineHeight: 1.05
    body:
      fontFamily: "'Chakra Petch', system-ui, -apple-system, sans-serif"
      weights: [400, 500, 600, 700]
      letterSpacing: "0.005em"
      lineHeight: 1.48
    data:
      fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, monospace"
      weights: [400, 500, 600]
      letterSpacing: "-0.01em"
      lineHeight: 1.35
      fontVariantNumeric: "tabular-nums"
  shape:
    structuralRadius: "0px"
    chamferCut: "12px"
    controlRadius: "2px"
    chamferClipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)"
  spacing:
    unit: "4px"
    railWidth: "84px"
    tight: "8px"
    group: "16px"
    panelPad: "20px"
    section: "36px"
    maxWidth: "1380px"
  elevation:
    structuralRule: "1px solid rgba(243, 239, 230, 0.14)"
    activeRule: "1px solid #F0B429"
    cardDepthShadow: "0 12px 28px -8px rgba(4, 11, 8, 0.65)"
  motion:
    easeOut: "cubic-bezier(0.23, 1, 0.32, 1)"
    easeInOut: "cubic-bezier(0.77, 0, 0.175, 1)"
    pressMs: 110
    uiMs: 170
    cardFlipMs: 280
    revealSweepMs: 450
    staggerMs: 35
---

# TapeDuel Design System (`DESIGN.md`, Direction v2)

**Design Read:** Reading this as a high-stakes competitive trading arena (Operate surface with motorsport paddock theater) for Solana traders and Blitz V10 judges, in a **British Racing Forest + Championship Gold + Chamfered Pit-Pass** language with a left vertical command rail, dials `ENERGY 3 / RHYTHM 3 / MOTION 2` and `VARIANCE 8 / MOTION 6 / DENSITY 7`.

**Why Rotated from v1:** Lee had previously used the light cool-mineral/cobalt/top-nav aesthetic. Direction v2 rotates every axis: deep racing forest ground, championship gold accent, `Russo One` + `Chakra Petch` + `Fira Code` typography, fixed left vertical rail navigation, 45-degree chamfered physical pit-ticket geometry (zero rounded SaaS boxes), featured full-bleed match stage on `/`, and horizontal 3-card VRF hand layout on `/sprint/[id]`.

**Source Traceability:**
- Palette family ("forest: deep green + bone + amber/gold"): `01-ui-ux-design.md` line 351 (approved alternative palette rotation) + Lamborghini/Motorsport heritage contrast discipline (`01` Reference Brand Worlds).
- Typography pairing (`Russo One` + `Chakra Petch`): `01-ui-ux-design.md` Typography Catalog ("Gaming Bold", line 1301) paired with `Fira Code` (`01` line 1314) strictly for tabular numbers, prices, and hashes.
- Chamfered 45-degree geometry & micro-interactions: `01-ui-ux-design.md` Style Catalog ("Micro-interactions" + chamfered physical pit-pass tokens), explicitly stripping away neon magenta/green cyberpunk glow and rounded dark SaaS panels (`01` line 63, `08` line 46).

---

## 1. Visual Theme and Atmosphere

- **Surface mode:** Operate with high-energy competitive framing. Every screen puts live on-chain state and immediate duel actions in the first viewport.
- **Mood:** Heritage British racing paddock meets a mechanical pit-wall oscilloscope. Rich deep forest green surfaces, warm alabaster bone legibility, burnished championship gold triggers, and physical notched trading tickets that feel stamped rather than pasted from a SaaS component kit.
- **Background treatment (compulsory, non-flat):**
  1. Deep British Racing Forest field (`#0B1B16`) illuminated by an angled paddock overhead spotlight (`radial-gradient(960px 460px at 68% -12%, rgba(28, 74, 58, 0.58), transparent 70%)`) and a restrained bottom-left warm gold ambient floor bounce (`radial-gradient(640px 320px at 12% 108%, rgba(240, 180, 41, 0.08), transparent 65%)`).
  2. Ultra-fine diagonal woven carbon-felt micro-texture (`repeating-linear-gradient(-45deg, rgba(243, 239, 230, 0.018) 0 1px, transparent 1px 10px)`) giving physical paddock-desk depth without visual noise.
  3. Recessed dark oscilloscope stage (`#07120E`) with fine 10-second timing rules strictly inside the live 90-second Race Tape and Replay Scrubber canvases, where measuring seconds is the literal subject (`08` R-07).

### Reference Sweep (`09-graphics-motion.md` Step 1)

| Reference | Adopted property | Rejected property |
|---|---|---|
| **British Racing Heritage / Lamborghini (`01` Brand Worlds + line 351)** | Deep forest green + warm bone + burnished championship gold contrast; austere luxury-sport confidence. | Pure black `#000000` void and static brochure pacing. |
| **Physical Pit-Pass & Mechanical Chronographs (Brief vernacular)** | 45-degree chamfered top-right ticket notches (`12px` cut), stamped confirmation hashes, tactile stepped sliders. | Rounded `16px` SaaS cards, soft blurred glass panels, or neon outline halos. |
| **Esports Broadcast / `Gaming Bold` (`01` line 1301)** | `Russo One` scoreboard numerals and `Chakra Petch` angular technical labels built for rapid glance reading. | Purple/cyan neon cyberpunk clutter or busy animated backgrounds. |
| **Linear / Micro-interactions (`01` Catalog)** | Fast `110-180ms` `cubic-bezier(0.23, 1, 0.32, 1)` transitions, `0.97` press scale, zero-delay keyboard controls. | Generic top horizontal navbar and muted gray-blue slate palette. |

---

## 2. Color Palette and Roles

Max 2 core colors (Racing Forest neutral scale + Championship Gold primary accent) plus restrained functional trading signals (`08` R-29). All foreground/background pairs verified for WCAG AA/AAA contrast.

| Semantic Token | Hex / Value | Functional Role | Verified Contrast Pair |
|---|---|---|---|
| `--color-canvas` | `#0B1B16` | Page ground (layered with paddock spotlight) | Base for `#F3EFE6` (15.2:1 AAA) |
| `--color-surface-raised` | `#122720` | Primary structural modules, Ghost match rows | Base for `#F3EFE6` (12.8:1 AAA), `#B6C9C0` (8.9:1 AAA) |
| `--color-surface-elevated` | `#18332A` | Active hovered row, VRF Tactical Cards | Base for `#F3EFE6` (10.6:1 AAA) |
| `--color-surface-inset` | `#07120E` | Recessed oscilloscope chart canvas, telemetry strip | Base for `#F3EFE6` (16.9:1 AAA) |
| `--color-ink-primary` | `#F3EFE6` | Headlines, callsigns, active data values (Warm Bone) | >= 10.6:1 on all forest surfaces |
| `--color-ink-secondary` | `#B6C9C0` | Body prose, helper text, secondary metrics | >= 7.5:1 on all forest surfaces |
| `--color-ink-muted` | `#94ADA2` | Column headers, timestamps, inactive labels | >= 5.5:1 on all forest surfaces |
| `--color-accent-primary` | `#F0B429` | Single primary brand accent (CTAs, active rail, Your curve) | `#091511` on `#F0B429` = 10.1:1 (AAA) |
| `--color-accent-hover` | `#F7C64E` | Hover/active state on primary gold buttons | `#091511` on `#F7C64E` = 12.0:1 (AAA) |
| `--color-semantic-long` | `#34D399` | Long direction, positive PnL, verified ER settle (paired with `+`/arrow) | 7.9:1 on `#122720` |
| `--color-semantic-short` | `#FB7185` | Short direction, negative PnL, error state (paired with `-`/alert) | 5.9:1 on `#122720` |
| `--color-semantic-vrf` | `#2DD4BF` | MagicBlock VRF energy, sealed/dealt card badge (paired with text) | 8.2:1 on `#122720` |

Single theme declaration: **Racing Forest Daylight-Readable Dark** is the sole declared theme (`08` R-21, R-34). No unverified light-mode toggle is added as decoration.

---

## 3. Typography Rules

- **Production font loading (`02-frontend-build.md`):** Load `Russo_One`, `Chakra_Petch`, and `Fira_Code` via `next/font/google` in `app/layout.tsx` and bind CSS variables (`--font-display`, `--font-body`, `--font-mono`) on `<html>`. Never load via `<link>` in production.
- **Display rule:** `Russo One` handles page titles, Ghost callsigns, the 90-second countdown clock, and final PnL spread readouts.
- **UI/Body rule:** `Chakra Petch` (its subtle chamfered terminals mirror our 45-degree pit-ticket geometry) handles all labels, controls, buttons, and operational instructions.
- **Data rule:** `Fira Code` with `font-variant-numeric: tabular-nums` is strictly reserved for live Pyth prices, bps deltas, ER millisecond receipts, and Solana/ER hashes.

| Role | Family | Size (Desktop / Mobile) | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|---|
| Race Clock / Spread Hero | `Russo One` | `52px` / `38px` | 400 | `0.98` | `0.01em` | 90s sprint timer, post-duel spread outcome |
| Page H1 | `Russo One` | `36px` / `28px` | 400 | `1.08` | `0.01em` | Route mastheads on Arena, Replay, Vault |
| Section H2 / Callsign | `Russo One` | `22px` / `19px` | 400 | `1.15` | `0.015em` | Ghost callsigns, VRF card names, Desk headers |
| Body / Control Label | `Chakra Petch` | `15px` / `16px` | 500 / 600 | `1.48` | `0.005em` | Controls, buttons, helper copy (16px min mobile inputs) |
| Compact Meta | `Chakra Petch` | `12px` / `12px` | 600 | `1.3` | `0.04em` | Table columns, asset tags, status stamps |
| Telemetry Data | `Fira Code` | `13px-18px` | 500 | `1.32` | `-0.01em` | Pyth Lazer prices, bps, ER ms, tx hashes |

---

## 4. Component Stylings

1. **Fixed Left Vertical Paddock Rail (Desktop `84px` wide; Mobile bottom bar `64px`)**
   - Houses the chamfered `TapeDuel` emblem at top, 4 vertical icon+label route tabs (`Arena`, `Desk`, `Replay`, `Vault`) with a `3px` Championship Gold left active bar, and compact wallet/vault connection button at the bottom. Completely rotates away from the generic horizontal top navbar.
2. **Recessed Live Pyth Lazer Strip (Top edge of workspace)**
   - Flush `#07120E` telemetry bar (`38px` height) displaying live `SOL/USD`, `BTC/USD`, `ETH/USD` prices, tick delta, active MagicBlock ER node (`devnet-eu`), and live Wallet/Vault SOL readout. States: `live`, `connecting`, `stale/reconnect`.
3. **Featured Head-to-Head Match Stage (Top of `/` Arena)**
   - Full-width chamfered stage (`clip-path` top-right 12px notch) pitting **YOU** against the currently selected **Bounty Ghost** with large target return, defense record, required stake lock, payout split (`85% winner / 10% ghost owner / 5% vault`), and the single Championship Gold CTA (`Enter 90s Duel`).
4. **Horizontal Bounty Ghost Pit-Pass Rows (`/` below stage)**
   - Crisp `0px`-radius horizontal timing bands separated by `1px` bone hairlines (NOT a 3-column generic card grid). Clicking any band immediately loads that Ghost into the Featured Match Stage above. States: `selected` (`1px solid #F0B429` + `#18332A` fill), `hover`, `loading`, `empty`, `error`.
5. **Dual-Curve Oscilloscope Canvas (`/sprint/[id]` full-width top stage)**
   - Wide `#07120E` recessed instrument showing 10-second timing ticks, Your live equity curve in **Championship Gold (`#F0B429`, `2.8px`)**, and the Ghost's sealed pace line in **Warm Bone dashed (`#B6C9C0`, `1.8px`)**, with inline Race Clock and live spread readout.
6. **Horizontal 3-Card VRF Tactical Hand (`/sprint/[id]` bottom-left)**
   - Three side-by-side chamfered physical tactical cards (`2x Boost`, `Drawdown Shield`, `Polarity Flip`) arranged like an active player's hand. Each card executes a hardware-accelerated 3D `rotateY` flip from its stamped Teal VRF cryptographic back to its armed tactical face when MagicBlock VRF callback confirms, and lifts `-4px` on hover. States: `awaiting-vrf`, `ready`, `active`, `spent`.
7. **Rapid-Fire Allocation Pad & ER Confirmation Tape (`/sprint/[id]` bottom-right)**
   - Compact `SOL / BTC / ETH` stepped allocation rows (`0% / 25% / 50% / 75% / 100%` + slider + instant `LONG / SHORT` toggle) firing gasless session-key ER rebalances, stacked directly above a compact live ER millisecond receipt tape (`11ms`, `14ms`).
8. **Synchronized Ghost Reveal Scrubber & Proof Receipt (`/tapes/[id]`)**
   - Full-width settlement outcome banner + `clip-path` left-to-right unmask reveal of the Ghost's hidden timeline alongside yours + verifiable Devnet Explorer links + one-click `Publish as Bounty Ghost`.
9. **Vault Escrow Console & Published Ghosts Ledger (`/vault`)**
   - Split 5/7 layout: Devnet SOL deposit/withdraw form (16px mobile input, explicit labels, inline errors, Devnet airdrop helper) beside your Published Bounty Ghosts and claimable defense bounties.

---

## 5. Layout Principles and Route Inventory

- **Shell:** Desktop uses a fixed `84px` Left Paddock Rail (`#081410`, right border `1px solid rgba(243,239,230,0.14)`) + fluid main workspace (`max-w-[1380px]`). Mobile (`< 768px`) collapses the rail into a persistent 4-item bottom dock (`64px` height, safe-area inset) plus compact top identity bar.
- **Structural Variety Across All 4 Real Pages:**
  1. **`/` Arena Lobby:** Full-width **Featured Match Stage** (chamfered head-to-head duel slip) stacked over **Full-Width Horizontal Ghost Pit-Pass Bands** with stake filters.
  2. **`/sprint/[id]` Live Execution Desk:** **Broadcast Cockpit Stack** (Wide recessed Oscilloscope Race Tape on top -> Asymmetric 7/5 bottom action deck: Horizontal 3-Card VRF Hand on left + Rapid-Fire Allocation Pad & ER Tape on right).
  3. **`/tapes/[id]` Replay & Proof Room:** **Editorial Settlement Spread** (Gold/Crimson verdict bar -> Side-by-side `clip-path` unmasked move ledger -> 3-column on-chain Explorer proof strip).
  4. **`/vault` Bankroll & Ghosts:** **Asymmetric 5/7 Split** (Left: chamfered Escrow Deposit/Withdraw console + faucet helper; Right: Published Bounty Ghosts defense table & bounty claim bar).

---

## 6. Depth and Elevation

- **Borders for structure, chamfer + deep drop shadow for physical objects (`09` line 187):**
  - Structural strips and tables stay flush on `#122720` with crisp `1px solid rgba(243, 239, 230, 0.14)` rules and `0px` corners.
  - Physical interactive objects (Featured Match Stage and the 3 VRF Tactical Cards) use a `12px` 45-degree top-right chamfer notch (`clip-path`) plus focused elevation shadow (`0 12px 28px -8px rgba(4, 11, 8, 0.65)`).
  - Zero blurred neon outer glows, zero glassmorphism stacks, zero rounded card grids.
- **3D with a job:** `perspective: 950px` on the 3-Card VRF Tactical Hand for the VRF deal `rotateY` flip and subtle hover lift (`translateY(-4px)` desktop only, disabled on touch and reduced motion).

---

## 7. Do's and Don'ts

**Do:**
- Pair every Long/Short or PnL color with `+`/`-` sign and explicit text (`LONG`, `SHORT`, `WIN`, `LOSS`) so color is never the only cue.
- Keep `Fira Code` tabular figures on all prices, bps, countdowns, and ER ms latencies.
- Surface real Solana Devnet + MagicBlock Explorer proof links on every completed sprint.

**Don't:**
- Never use em dashes (`—`) anywhere in UI copy or docs (`08` R-02).
- Never use rounded SaaS card walls (`rounded-2xl`), kicker/eyebrows above headings, decorative `01/02/03` numbering, purple/indigo/orange accents, or emoji icons.
- Never invent fake stats, fake TVL, or fake user counts (`08` R-17/R-36).

---

## 8. Responsive Behavior

- **Breakpoints:** `375px`, `768px` (`md`), `1024px` (`lg`), `1440px` (`xl`).
- **Explicit `< 768px` collapse per route:**
  - Navigation: Left `84px` vertical rail hides on `< md` and switches to a fixed 4-button bottom dock (`64px` height) plus a compact `56px` mobile brand + wallet header.
  - `/` Arena: Featured Match Stage stacks vertically with full-width Gold CTA; Ghost rows hide secondary `Defense W-L` and `Regime` columns (`hidden sm:block`) so Callsign, Stake, and Target Return fit cleanly inside `375px`.
  - `/sprint/[id]` Execution Desk: Oscilloscope chart stays full width; bottom 7/5 deck stacks cleanly (3 VRF cards stack vertically with full `44px` activate triggers above the Allocation Pad and ER Tape).
  - `/tapes/[id]` and `/vault`: Multi-column splits collapse cleanly to single column with `16px` minimum input font size and `44px+` tap targets.

---

## 9. Signature, Motion, and Depth

- **Motion tier:** Standard-Dynamic (`MOTION 6` / `08 MOTION 2`), strictly `transform` and `opacity` (no `transition: all`).
- **Entrance:** `35ms` staggered reveal (`opacity: 0, translateY(8px) scale(0.985)` -> `1`, `240ms cubic-bezier(0.23, 1, 0.32, 1)`), plays once and stays visible.
- **Hover and press:** `140ms` crisp border/lift feedback, `scale(0.97)` on `:active` (`110ms`). Zero delay on rapid keyboard allocation keys.
- **One Signature Moment:**
  1. **VRF Hand Deal (`rotateY` 3D flip):** When MagicBlock VRF callback lands in `<15ms`, the 3 chamfered Tactical Cards flip across the horizontal hand (`65ms` stagger, `280ms cubic-bezier(0.23, 1, 0.32, 1)`) from Teal-stamped VRF backs to armed Gold/Bone tactical faces.
  2. **Sealed Ghost Unmask (`clip-path` sweep):** On `/tapes/[id]`, unmasking sweeps the opponent Ghost's previously hidden moves left-to-right over `450ms`.
- **Reduced-motion fallback (`@media (prefers-reduced-motion: reduce)`):** Disables 3D flips, hover lifts, and slide transforms; uses crisp `120ms` opacity crossfades and static instant state updates.
