# TapeDuel

Asynchronous 90-second portfolio duels on Solana Devnet and MagicBlock Ephemeral Rollups (ER).

Pick an on-chain **Bounty Ghost** (a recorded trader tape), lock a stake from your Solana Devnet escrow vault with one wallet signature, receive a verifiable 3-card **MagicBlock VRF** tactical hand, and rebalance SOL, BTC, ETH, and Cash against live **MagicBlock Pyth Lazer** feeds with zero gas and zero wallet popups. At `00:00`, the sprint settles and undelegates back to Solana Devnet L1, unmasks the Ghost's hidden moves side by side with yours, and lets winners publish their tape as a new Bounty Ghost collecting a 10% defense cut from future challengers.

Built for **MagicBlock Solana Blitz V10: Entertainment Finance**.

## Routes

- `/` **Arena Lobby**: Featured head-to-head match stage paired with horizontal Bounty Ghost pit-pass bands and stake tier filters (`0.05`, `0.10`, `0.25` SOL).
- `/sprint/[id]` **Live Execution Desk**: Full-width dual-curve oscilloscope against live MagicBlock Pyth Lazer prices, 3D-flipping MagicBlock VRF Tactical Hand (`2x Boost`, `Drawdown Shield`, `Polarity Flip` with `[1]`/`[2]`/`[3]` keyboard shortcuts), rapid-fire allocation pad, and real-time ER confirmation receipt tape.
- `/tapes/[id]` **Replay & Proof Room**: Settlement verdict bar, synchronized `clip-path` Ghost unmask scrubber, Solana Devnet and MagicBlock ER Explorer proofs, and one-click `Publish as Bounty Ghost`.
- `/vault` **Bankroll & Ghosts**: Solana Devnet L1 escrow deposit/withdraw console, built-in Devnet test SOL airdrop helper, and published Ghost defense bounty claiming.

## Solana & MagicBlock Architecture

| Component | Address / Endpoint |
|---|---|
| TapeDuel Program ID (Devnet) | `BdVNbT73iebJ3w396FeWiu3cvcQbe4fG1EZ138d1QpXi` |
| MagicBlock ER Primary Validator (`devnet-eu`) | `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e` (`https://devnet-eu.magicblock.app`) |
| Delegation Program | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` |
| MagicBlock VRF Program | `Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz` |
| MagicBlock ER VRF Queue | `5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc` |
| Pyth Lazer Price Program | `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd` |
| `SOL/USD` Live ER Feed | `ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu` |
| `BTC/USD` Live ER Feed | `71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr` |
| `ETH/USD` Live ER Feed | `5vaYr1hpv8yrSpu8w3K95x22byYxUJCCNCSYJtqVWPvG` |

### Verified Live Devnet & MagicBlock ER Proofs

- **Deployed Program:** [BdVNbT73iebJ3w396FeWiu3cvcQbe4fG1EZ138d1QpXi](https://explorer.solana.com/address/BdVNbT73iebJ3w396FeWiu3cvcQbe4fG1EZ138d1QpXi?cluster=devnet)
- **Seeded Bounty Ghosts (Devnet PDAs):**
  - `SOL-SURGE-04`: [AeLuHnNmpbmxW4rtr3hKiagRWVJEJCbwutyBRjoxSjKX](https://explorer.solana.com/address/AeLuHnNmpbmxW4rtr3hKiagRWVJEJCbwutyBRjoxSjKX?cluster=devnet)
  - `DELTA-HEDGE-11`: [8Sa3gdoQHyRB4MKEXpmnnyxLaQdh2jBBzKjK8T7ycoLN](https://explorer.solana.com/address/8Sa3gdoQHyRB4MKEXpmnnyxLaQdh2jBBzKjK8T7ycoLN?cluster=devnet)
  - `WHIPSAW-09`: [7xNHZYZ8634QzY2zuDPUNFvUGLjgeQVRV59JE3Kx1ctw](https://explorer.solana.com/address/7xNHZYZ8634QzY2zuDPUNFvUGLjgeQVRV59JE3Kx1ctw?cluster=devnet)
- **Single-Tx Create + Delegate Sprint (Devnet L1):** [3kcb2sQ...rW4B6T](https://explorer.solana.com/tx/3kcb2sQ1njxGhHU921p3FkPJbunsNQMv6vgvXEGJsih8NcaA16PJiNzeQFQyt8HQPc5u5MBkHZ11Eo88osrW4B6T?cluster=devnet)
- **MagicBlock ER VRF Request (`Cards dealt: [1, 2, 2]`):** [4dRuR25...emXZXte](https://explorer.solana.com/tx/4dRuR25ovdJ4m9H5py9Z2ZasaNfZk2wYzf7hvh3aa1tYndcPMfnbzRKPpbY6G3yRxp4Bcg95tdTrmGXFLemXZXte?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app)
- **Gasless ER Rebalance (Pyth Lazer Live Mark):** [4FoG4sf...WmWcq984](https://explorer.solana.com/tx/4FoG4sfqsCS1xiUijneDYxTMCeZ318LwNjXas4pbjaUhj7V697kSE7Fok2k9zi7UPfWx5gikEh3q3gssWmWcq984?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app)
- **Gasless ER Tactical Card Activation (`2x Boost`):** [2Vd22gN...FPsArLsK](https://explorer.solana.com/tx/2Vd22gN2SqrPGUNAJ7p4MAp2C7ezUFkLUTdgnn1HvEzFPnKiaZWA8kUP3agygsyoxDXYAaGznpdBgjMMFPsArLsK?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app)
- **ER Settle + Commit & Undelegate (`+4 bps`):** [46f7hzw...JEuAY96T](https://explorer.solana.com/tx/46f7hzwKyu3jysA3DyCzsBL16Z64RiiNU5hpNPTNVj62JPShJmPDbGU2K3eQRbJukqQRwPQbpUggxJTqJEuAY96T?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app)
- **Solana Devnet L1 Finalize Payout:** [43sSMKp...GPdSFNj](https://explorer.solana.com/tx/43sSMKpjdZFUywTUFMBZgBGsvYxagkuvB7jSbACbX3TuSmq4GVTG6Zpr3KReg2G4TYdRzBrp98BAH3E8GPdSFNj?cluster=devnet)

### Program Security & Solvency Rules

- **Scoped Session Keys**: Each sprint generates an ephemeral browser Ed25519 keypair stored in `sessionStorage`. The Anchor program allows that key to sign only ER gameplay instructions (`request_vrf_cards`, `start_sprint_er`, `rebalance_er`, `activate_card_er`, `settle_and_undelegate_er`). L1 escrow `withdraw` and `claim_bounty` strictly require the primary wallet signer.
- **VRF Callback Authentication**: `callback_vrf_cards` uses `#[vrf_callback]` from `ephemeral-rollups-sdk 0.20.0`, binding callbacks exclusively to this program's scoped VRF identity PDA.
- **Oracle Integrity**: All ER pricing handlers check exact `SOL_USD_FEED`, `BTC_USD_FEED`, and `ETH_USD_FEED` addresses, verify ownership by `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd`, and enforce positive price values with checked `i128` basis-point math.
- **Escrow Solvency**: Winner profits (`+85%` of stake) pay from the on-chain `ArenaTreasury` PDA; losing stakes route `10%` to the defending Ghost's unclaimed bounty ledger and `90%` back into `ArenaTreasury`.

## Local Development & Verification

### Prerequisites

- Node.js 22+ and `pnpm`
- Rust + Solana CLI (Agave) + Anchor CLI `1.2.2`

### Run Tests

```bash
# Rust unit tests (Borsh account size invariants, PnL math, tactical cards, settlement splits)
cargo test --manifest-path programs/tapeduel/Cargo.toml

# TypeScript SDK tests (IDL discriminator parity + live MagicBlock ER Pyth Lazer probe)
pnpm test:sdk

# TypeScript & production Next.js build
pnpm typecheck && pnpm build
```

### Deploy Program & Seed Devnet Arena

```bash
# Build Solana SBF binary
anchor build --no-idl

# Deploy to Solana Devnet (requires ~3.5 Devnet SOL on deployer keypair)
anchor deploy --provider.cluster devnet

# Initialize ArenaConfig + ArenaTreasury, seed 3 real Bounty Ghosts, and run full ER/VRF/Pyth E2E sprint
pnpm devnet:seed
```

### Deploy Frontend to Vercel

1. Import `Pizzylee001/tapeduel` on Vercel with Root Directory left at repository root (`.`).
2. Framework preset: **Next.js** (auto-detected).
3. Optional environment variables (defaults point to Solana Devnet and `devnet-eu.magicblock.app`; see `.env.example`):
   - `NEXT_PUBLIC_SOLANA_RPC_URL`
   - `NEXT_PUBLIC_MAGICBLOCK_ER_RPC_URL`
   - `NEXT_PUBLIC_MAGICBLOCK_ER_WS_URL`
   - `NEXT_PUBLIC_MAGICBLOCK_ER_VALIDATOR`
   - `NEXT_PUBLIC_TAPEDUEL_PROGRAM_ID`
4. Click **Deploy**.
