use anchor_lang::prelude::*;

pub const ARENA_SEED: &[u8] = b"arena";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const VAULT_SEED: &[u8] = b"vault";
pub const GHOST_SEED: &[u8] = b"ghost";
pub const SPRINT_SEED: &[u8] = b"sprint";

pub const WINNER_PROFIT_BPS: u64 = 8_500;
pub const GHOST_DEFENSE_BPS: u64 = 1_000;
pub const PROTOCOL_FEE_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10_000;

pub const SPRINT_DURATION_SECS: i64 = 90;
pub const BOOST_DURATION_SECS: i64 = 15;
pub const SHIELD_DURATION_SECS: i64 = 12;
pub const MAX_MOVES: usize = 16;

pub const MIN_STAKE_LAMPORTS: u64 = 50_000_000; // 0.05 SOL
pub const MAX_STAKE_LAMPORTS: u64 = 1_000_000_000; // 1.00 SOL

pub const CARD_NONE: u8 = 0;
pub const CARD_BOOST_2X: u8 = 1;
pub const CARD_SHIELD: u8 = 2;
pub const CARD_POLARITY_FLIP: u8 = 3;

pub const STATUS_CREATED: u8 = 0;
pub const STATUS_ACTIVE: u8 = 1;
pub const STATUS_SETTLED_ER: u8 = 2;
pub const STATUS_FINALIZED_L1: u8 = 3;

// MagicBlock Pyth Lazer real-time price feed program and accounts on Devnet ER
pub const PYTH_LAZER_PROGRAM_ID: Pubkey = pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");
pub const SOL_USD_FEED: Pubkey = pubkey!("ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu");
pub const BTC_USD_FEED: Pubkey = pubkey!("71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr");
pub const ETH_USD_FEED: Pubkey = pubkey!("5vaYr1hpv8yrSpu8w3K95x22byYxUJCCNCSYJtqVWPvG");

// Verified byte offsets inside 134-byte MagicBlock Pyth Lazer price accounts
pub const PYTH_MIN_ACCOUNT_LEN: usize = 134;
pub const PYTH_PRICE_OFFSET: usize = 73;
pub const PYTH_EXP_OFFSET: usize = 89;
pub const PYTH_PUBLISH_TS_OFFSET: usize = 93;
