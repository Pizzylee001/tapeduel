use anchor_lang::prelude::*;
use crate::constants::MAX_MOVES;

#[account]
pub struct ArenaConfig {
    pub authority: Pubkey,
    pub total_sprints: u64,
    pub total_ghosts: u64,
    pub total_volume_lamports: u64,
    pub bump: u8,
}

impl ArenaConfig {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct ArenaTreasury {
    pub authority: Pubkey,
    pub bump: u8,
}

impl ArenaTreasury {
    pub const SIZE: usize = 32 + 1;
}

#[account]
pub struct PlayerVault {
    pub owner: Pubkey,
    pub available_lamports: u64,
    pub locked_lamports: u64,
    pub total_wins: u32,
    pub total_losses: u32,
    pub sprint_nonce: u64,
    pub bump: u8,
}

impl PlayerVault {
    pub const SIZE: usize = 32 + 8 + 8 + 4 + 4 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct TapeMove {
    pub elapsed_secs: u16,
    pub sol_w: i8,
    pub btc_w: i8,
    pub eth_w: i8,
    pub card_id: u8,
}

impl TapeMove {
    pub const SIZE: usize = 2 + 1 + 1 + 1 + 1;
}

#[account]
pub struct GhostTape {
    pub ghost_id: u64,
    pub creator: Pubkey,
    pub callsign: [u8; 20],
    pub callsign_len: u8,
    pub stake_lamports: u64,
    pub target_return_bps: i32,
    pub regime: u8, // 0=Momentum, 1=Hedged, 2=MeanRev
    pub wins: u32,
    pub losses: u32,
    pub bounty_earned_lamports: u64,
    pub unclaimed_bounty_lamports: u64,
    pub entry_prices: [i64; 3],
    pub exit_prices: [i64; 3],
    pub move_count: u8,
    pub moves: [TapeMove; MAX_MOVES],
    pub tape_hash: [u8; 32],
    pub source_sprint_id: u64,
    pub active: bool,
    pub created_ts: i64,
    pub bump: u8,
}

impl GhostTape {
    pub const SIZE: usize = 8
        + 32
        + 20
        + 1
        + 8
        + 4
        + 1
        + 4
        + 4
        + 8
        + 8
        + 24
        + 24
        + 1
        + (TapeMove::SIZE * MAX_MOVES)
        + 32
        + 8
        + 1
        + 8
        + 1;
}

#[account]
pub struct SprintRun {
    pub sprint_id: u64,
    pub player: Pubkey,
    pub session_key: Pubkey,
    pub ghost_id: u64,
    pub stake_lamports: u64,
    pub status: u8, // 0=Created, 1=Active, 2=SettledOnEr, 3=FinalizedOnL1
    pub start_ts: i64,
    pub end_ts: i64,
    pub last_mark_ts: i64,
    pub settled_ts: i64,
    pub entry_prices: [i64; 3],
    pub last_prices: [i64; 3],
    pub weights: [i8; 3],
    pub pnl_bps: i32,
    pub cards: [u8; 3],
    pub cards_used: [bool; 3],
    pub active_card: u8,
    pub active_card_until: i64,
    pub vrf_requested: bool,
    pub vrf_fulfilled: bool,
    pub vrf_seed: [u8; 32],
    pub move_count: u8,
    pub moves: [TapeMove; MAX_MOVES],
    pub published_as_ghost: bool,
    pub challenger_won: bool,
    pub delegated_validator: Pubkey,
    pub bump: u8,
}

impl SprintRun {
    pub const SIZE: usize = 8
        + 32
        + 32
        + 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 8
        + 24
        + 24
        + 3
        + 4
        + 3
        + 3
        + 1
        + 8
        + 1
        + 1
        + 32
        + 1
        + (TapeMove::SIZE * MAX_MOVES)
        + 1
        + 1
        + 32
        + 1;
}
