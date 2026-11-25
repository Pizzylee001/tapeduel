use anchor_lang::prelude::*;
use crate::constants::*;
use crate::math::*;
use crate::state::*;

#[test]
fn test_account_sizes_match_borsh_serialization_exactly() {
    let arena = ArenaConfig {
        authority: Pubkey::default(),
        total_sprints: 1,
        total_ghosts: 1,
        total_volume_lamports: 100,
        bump: 255,
    };
    assert_eq!(borsh::to_vec(&arena).unwrap().len(), ArenaConfig::SIZE);

    let treasury = ArenaTreasury {
        authority: Pubkey::default(),
        bump: 254,
    };
    assert_eq!(borsh::to_vec(&treasury).unwrap().len(), ArenaTreasury::SIZE);

    let vault = PlayerVault {
        owner: Pubkey::default(),
        available_lamports: 1,
        locked_lamports: 2,
        total_wins: 3,
        total_losses: 4,
        sprint_nonce: 5,
        bump: 253,
    };
    assert_eq!(borsh::to_vec(&vault).unwrap().len(), PlayerVault::SIZE);

    let ghost = GhostTape {
        ghost_id: 1,
        creator: Pubkey::default(),
        callsign: [b'A'; 20],
        callsign_len: 10,
        stake_lamports: MIN_STAKE_LAMPORTS,
        target_return_bps: 142,
        regime: 0,
        wins: 2,
        losses: 1,
        bounty_earned_lamports: 500,
        unclaimed_bounty_lamports: 250,
        entry_prices: [100; 3],
        exit_prices: [105; 3],
        move_count: 3,
        moves: [TapeMove::default(); MAX_MOVES],
        tape_hash: [7u8; 32],
        source_sprint_id: 9,
        active: true,
        created_ts: 1_764_000_000,
        bump: 252,
    };
    assert_eq!(borsh::to_vec(&ghost).unwrap().len(), GhostTape::SIZE);

    let sprint = SprintRun {
        sprint_id: 1,
        player: Pubkey::default(),
        session_key: Pubkey::default(),
        ghost_id: 1,
        stake_lamports: MIN_STAKE_LAMPORTS,
        status: STATUS_ACTIVE,
        start_ts: 100,
        end_ts: 190,
        last_mark_ts: 120,
        settled_ts: 0,
        entry_prices: [100; 3],
        last_prices: [102; 3],
        weights: [50, -30, 20],
        pnl_bps: 44,
        cards: [CARD_BOOST_2X, CARD_SHIELD, CARD_POLARITY_FLIP],
        cards_used: [false; 3],
        active_card: CARD_NONE,
        active_card_until: 0,
        vrf_requested: true,
        vrf_fulfilled: true,
        vrf_seed: [9u8; 32],
        move_count: 2,
        moves: [TapeMove::default(); MAX_MOVES],
        published_as_ghost: false,
        challenger_won: false,
        delegated_validator: Pubkey::default(),
        bump: 251,
    };
    assert_eq!(borsh::to_vec(&sprint).unwrap().len(), SprintRun::SIZE);
}

#[test]
fn test_multi_step_sprint_with_flip_boost_and_shield() {
    let mut pnl: i32 = 0;

    // Step 1 (0s -> 20s): 80% Long SOL, 20% Cash. SOL rallies +2% -> +160 bps
    let p0 = [100_0000_0000, 90000_0000_0000, 3000_0000_0000];
    let p1 = [102_0000_0000, 90000_0000_0000, 3000_0000_0000];
    pnl += compute_mark_to_market_delta_bps([80, 0, 0], p0, p1, CARD_NONE, 0, 1020).unwrap();
    assert_eq!(pnl, 160);

    // Step 2 (20s -> 35s): Activate 2x Boost for 15s, keep 80% Long SOL. SOL rises +1% -> +80 * 2 = +160 bps
    let p2 = [103_0200_0000, 90000_0000_0000, 3000_0000_0000];
    pnl += compute_mark_to_market_delta_bps([80, 0, 0], p1, p2, CARD_BOOST_2X, 1035, 1035).unwrap();
    assert_eq!(pnl, 320);

    // Step 3 (35s -> 47s): Activate Shield for 12s, SOL drops -5% -> shielded to 0 bps
    let p3 = [97_8690_0000, 90000_0000_0000, 3000_0000_0000];
    pnl += compute_mark_to_market_delta_bps([80, 0, 0], p2, p3, CARD_SHIELD, 1047, 1045).unwrap();
    assert_eq!(pnl, 320);

    // Step 4 (47s -> 90s): Polarity Flip negates [80, 0, 0] -> [-80, 0, 0]. SOL drops another -2% -> +160 bps
    let p4 = [95_9116_2000, 90000_0000_0000, 3000_0000_0000];
    pnl += compute_mark_to_market_delta_bps([-80, 0, 0], p3, p4, CARD_NONE, 1047, 1090).unwrap();
    assert_eq!(pnl, 480);

    // Beat a Ghost with +310 bps target
    assert!(pnl > 310);
}

#[test]
fn test_callsign_validation_rules() {
    let (bytes, len) = validate_callsign("SOL-SURGE-04").unwrap();
    assert_eq!(len, 12);
    assert_eq!(&bytes[..12], b"SOL-SURGE-04");

    assert!(validate_callsign("AB").is_err());
    assert!(validate_callsign("THIS-CALLSIGN-IS-WAY-TOO-LONG-21").is_err());
    assert!(validate_callsign("BAD\nNAME").is_err());
}

#[test]
fn test_extreme_price_clamp_and_zero_price_rejection() {
    let prev = [100_0000_0000, 100_0000_0000, 100_0000_0000];
    let extreme_up = [500_0000_0000, 100_0000_0000, 100_0000_0000];
    let clamped = compute_mark_to_market_delta_bps([100, 0, 0], prev, extreme_up, 0, 0, 10).unwrap();
    assert_eq!(clamped, 5_000);

    let zero_price = [0, 100_0000_0000, 100_0000_0000];
    assert!(compute_mark_to_market_delta_bps([100, 0, 0], zero_price, prev, 0, 0, 10).is_err());
}

#[test]
fn test_cash_only_allocation_produces_zero_pnl() {
    let prev = [100_0000_0000, 90000_0000_0000, 3000_0000_0000];
    let next = [150_0000_0000, 70000_0000_0000, 4200_0000_0000];
    let delta = compute_mark_to_market_delta_bps([0, 0, 0], prev, next, CARD_BOOST_2X, 999, 500).unwrap();
    assert_eq!(delta, 0);
}
