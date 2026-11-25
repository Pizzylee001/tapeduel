use anchor_lang::prelude::*;
use crate::constants::{
    BPS_DENOMINATOR, CARD_BOOST_2X, CARD_SHIELD, GHOST_DEFENSE_BPS, PYTH_MIN_ACCOUNT_LEN,
    PYTH_PRICE_OFFSET, PYTH_PUBLISH_TS_OFFSET, WINNER_PROFIT_BPS,
};
use crate::errors::TapeDuelError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PythFeedReading {
    pub price: i64,
    pub publish_ts: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettlementBreakdown {
    pub winner_profit_lamports: u64,
    pub ghost_defense_lamports: u64,
    pub treasury_net_inflow_lamports: u64,
}

/// Parses price (1e-8 scale) and unix publish timestamp from MagicBlock Pyth Lazer account bytes.
pub fn parse_pyth_lazer_price(data: &[u8]) -> Result<PythFeedReading> {
    require!(
        data.len() >= PYTH_MIN_ACCOUNT_LEN,
        TapeDuelError::InvalidPriceFeed
    );
    let price_bytes: [u8; 8] = data[PYTH_PRICE_OFFSET..PYTH_PRICE_OFFSET + 8]
        .try_into()
        .map_err(|_| error!(TapeDuelError::InvalidPriceFeed))?;
    let ts_bytes: [u8; 8] = data[PYTH_PUBLISH_TS_OFFSET..PYTH_PUBLISH_TS_OFFSET + 8]
        .try_into()
        .map_err(|_| error!(TapeDuelError::InvalidPriceFeed))?;

    let price = i64::from_le_bytes(price_bytes);
    let publish_ts = i64::from_le_bytes(ts_bytes);
    require!(price > 0, TapeDuelError::InvalidOraclePrice);

    Ok(PythFeedReading { price, publish_ts })
}

/// Validates signed asset weights for SOL, BTC, ETH. Remainder (100 - sum(|w|)) is Cash.
pub fn validate_weights(weights: [i8; 3]) -> Result<()> {
    let mut gross_exposure: i32 = 0;
    for w in weights {
        let abs_w = (w as i32).abs();
        require!(abs_w <= 100, TapeDuelError::InvalidAllocationWeights);
        gross_exposure = gross_exposure
            .checked_add(abs_w)
            .ok_or(TapeDuelError::MathOverflow)?;
    }
    require!(
        gross_exposure <= 100,
        TapeDuelError::InvalidAllocationWeights
    );
    Ok(())
}

/// Computes mark-to-market basis-point PnL delta for the elapsed interval with active tactical card rules.
pub fn compute_mark_to_market_delta_bps(
    weights: [i8; 3],
    prev_prices: [i64; 3],
    next_prices: [i64; 3],
    active_card: u8,
    active_card_until: i64,
    now_ts: i64,
) -> Result<i32> {
    let mut raw_delta_bps: i128 = 0;
    for i in 0..3 {
        let prev = prev_prices[i] as i128;
        let next = next_prices[i] as i128;
        require!(prev > 0 && next > 0, TapeDuelError::InvalidOraclePrice);

        let w = weights[i] as i128;
        if w == 0 {
            continue;
        }

        // asset_return_bps = ((next - prev) * 10_000) / prev
        // weighted_bps = (asset_return_bps * w) / 100
        let diff = next.checked_sub(prev).ok_or(TapeDuelError::MathOverflow)?;
        let numerator = diff
            .checked_mul(10_000)
            .and_then(|v| v.checked_mul(w))
            .ok_or(TapeDuelError::MathOverflow)?;
        let denominator = prev.checked_mul(100).ok_or(TapeDuelError::MathOverflow)?;
        let weighted = numerator
            .checked_div(denominator)
            .ok_or(TapeDuelError::MathOverflow)?;

        raw_delta_bps = raw_delta_bps
            .checked_add(weighted)
            .ok_or(TapeDuelError::MathOverflow)?;
    }

    let card_is_live = now_ts <= active_card_until;
    let adjusted: i128 = if card_is_live && active_card == CARD_BOOST_2X {
        raw_delta_bps
            .checked_mul(2)
            .ok_or(TapeDuelError::MathOverflow)?
    } else if card_is_live && active_card == CARD_SHIELD && raw_delta_bps < 0 {
        0
    } else {
        raw_delta_bps
    };

    // Clamp extreme single-tick oracle anomalies cleanly
    let clamped = adjusted.clamp(-5_000, 5_000);
    Ok(clamped as i32)
}

/// Derives a verifiable 3-card VRF Tactical Hand from 32-byte VRF output.
/// Always deals 3 valid cards in {1=2x Boost, 2=Drawdown Shield, 3=Polarity Flip} with at least 2 distinct types.
pub fn derive_vrf_hand(randomness: &[u8; 32]) -> [u8; 3] {
    let c0 = (randomness[0] % 3) + 1;
    let offset = (randomness[1] % 2) + 1; // 1 or 2, guarantees c1 != c0
    let c1 = ((c0 - 1 + offset) % 3) + 1;
    let c2 = (randomness[2] % 3) + 1;
    [c0, c1, c2]
}

/// Computes exact lamport settlement splits with strict conservation.
pub fn compute_settlement_payouts(
    stake_lamports: u64,
    challenger_won: bool,
) -> Result<SettlementBreakdown> {
    if challenger_won {
        let profit = (stake_lamports as u128)
            .checked_mul(WINNER_PROFIT_BPS as u128)
            .and_then(|v| v.checked_div(BPS_DENOMINATOR as u128))
            .ok_or(TapeDuelError::MathOverflow)? as u64;
        Ok(SettlementBreakdown {
            winner_profit_lamports: profit,
            ghost_defense_lamports: 0,
            treasury_net_inflow_lamports: 0,
        })
    } else {
        let defense = (stake_lamports as u128)
            .checked_mul(GHOST_DEFENSE_BPS as u128)
            .and_then(|v| v.checked_div(BPS_DENOMINATOR as u128))
            .ok_or(TapeDuelError::MathOverflow)? as u64;
        let treasury_net = stake_lamports
            .checked_sub(defense)
            .ok_or(TapeDuelError::MathOverflow)?;
        Ok(SettlementBreakdown {
            winner_profit_lamports: 0,
            ghost_defense_lamports: defense,
            treasury_net_inflow_lamports: treasury_net,
        })
    }
}

pub fn validate_callsign(raw: &str) -> Result<([u8; 20], u8)> {
    let bytes = raw.as_bytes();
    require!(
        bytes.len() >= 3 && bytes.len() <= 20,
        TapeDuelError::InvalidCallsign
    );
    for &b in bytes {
        require!((0x20..=0x7E).contains(&b), TapeDuelError::InvalidCallsign);
    }
    let mut out = [0u8; 20];
    out[..bytes.len()].copy_from_slice(bytes);
    Ok((out, bytes.len() as u8))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::CARD_POLARITY_FLIP;

    #[test]
    fn test_validate_weights_accepts_valid_and_rejects_over_100() {
        assert!(validate_weights([50, -30, 20]).is_ok());
        assert!(validate_weights([0, 0, 0]).is_ok());
        assert!(validate_weights([-100, 0, 0]).is_ok());
        assert!(validate_weights([60, -50, 0]).is_err());
        assert!(validate_weights([101, 0, 0]).is_err());
        assert!(validate_weights([-101, 0, 0]).is_err());
    }

    #[test]
    fn test_mark_to_market_long_short_cash() {
        // SOL +10% (weight +50%), BTC -10% (weight -30% -> +3%), ETH flat (weight +20%)
        // Expected: +500 bps + 300 bps + 0 = +800 bps
        let prev = [100_0000_0000, 100_0000_0000, 100_0000_0000];
        let next = [110_0000_0000, 90_0000_0000, 100_0000_0000];
        let delta = compute_mark_to_market_delta_bps([50, -30, 20], prev, next, 0, 0, 1000).unwrap();
        assert_eq!(delta, 800);
    }

    #[test]
    fn test_boost_2x_doubles_positive_and_negative_while_active() {
        let prev = [100_0000_0000, 100_0000_0000, 100_0000_0000];
        let next_up = [102_0000_0000, 100_0000_0000, 100_0000_0000];
        let next_down = [98_0000_0000, 100_0000_0000, 100_0000_0000];

        let active_up = compute_mark_to_market_delta_bps(
            [100, 0, 0],
            prev,
            next_up,
            CARD_BOOST_2X,
            1015,
            1010,
        )
        .unwrap();
        assert_eq!(active_up, 400);

        let active_down = compute_mark_to_market_delta_bps(
            [100, 0, 0],
            prev,
            next_down,
            CARD_BOOST_2X,
            1015,
            1010,
        )
        .unwrap();
        assert_eq!(active_down, -400);

        // After expiry, normal 1x applies
        let expired_up = compute_mark_to_market_delta_bps(
            [100, 0, 0],
            prev,
            next_up,
            CARD_BOOST_2X,
            1015,
            1016,
        )
        .unwrap();
        assert_eq!(expired_up, 200);
    }

    #[test]
    fn test_drawdown_shield_blocks_losses_and_keeps_gains() {
        let prev = [100_0000_0000, 100_0000_0000, 100_0000_0000];
        let next_down = [95_0000_0000, 100_0000_0000, 100_0000_0000];
        let next_up = [103_0000_0000, 100_0000_0000, 100_0000_0000];

        let shielded_loss = compute_mark_to_market_delta_bps(
            [100, 0, 0],
            prev,
            next_down,
            CARD_SHIELD,
            2012,
            2005,
        )
        .unwrap();
        assert_eq!(shielded_loss, 0);

        let shielded_gain = compute_mark_to_market_delta_bps(
            [100, 0, 0],
            prev,
            next_up,
            CARD_SHIELD,
            2012,
            2005,
        )
        .unwrap();
        assert_eq!(shielded_gain, 300);
    }

    #[test]
    fn test_derive_vrf_hand_always_valid_and_diverse() {
        for seed_byte in 0u8..=255 {
            let mut rnd = [0u8; 32];
            rnd[0] = seed_byte;
            rnd[1] = seed_byte.wrapping_mul(7).wrapping_add(3);
            rnd[2] = seed_byte.wrapping_mul(13).wrapping_add(11);
            let hand = derive_vrf_hand(&rnd);
            for &c in &hand {
                assert!(c >= CARD_BOOST_2X && c <= CARD_POLARITY_FLIP);
            }
            assert_ne!(hand[0], hand[1]);
        }
    }

    #[test]
    fn test_settlement_payout_conservation() {
        let stake = 250_000_000u64; // 0.25 SOL
        let win = compute_settlement_payouts(stake, true).unwrap();
        assert_eq!(win.winner_profit_lamports, 212_500_000); // 85%
        assert_eq!(win.ghost_defense_lamports, 0);

        let loss = compute_settlement_payouts(stake, false).unwrap();
        assert_eq!(loss.ghost_defense_lamports, 25_000_000); // 10%
        assert_eq!(loss.treasury_net_inflow_lamports, 225_000_000); // 90%
        assert_eq!(
            loss.ghost_defense_lamports + loss.treasury_net_inflow_lamports,
            stake
        );
    }

    #[test]
    fn test_parse_pyth_lazer_price_matches_verified_devnet_offsets() {
        let mut buf = vec![0u8; 134];
        let sol_raw: i64 = 6_738_359_875; // $67.38359875
        let ts: i64 = 1_764_088_700;
        buf[PYTH_PRICE_OFFSET..PYTH_PRICE_OFFSET + 8].copy_from_slice(&sol_raw.to_le_bytes());
        buf[PYTH_PUBLISH_TS_OFFSET..PYTH_PUBLISH_TS_OFFSET + 8].copy_from_slice(&ts.to_le_bytes());

        let parsed = parse_pyth_lazer_price(&buf).unwrap();
        assert_eq!(parsed.price, sol_raw);
        assert_eq!(parsed.publish_ts, ts);

        // Reject short buffer or zero price
        assert!(parse_pyth_lazer_price(&buf[..100]).is_err());
        buf[PYTH_PRICE_OFFSET..PYTH_PRICE_OFFSET + 8].copy_from_slice(&0i64.to_le_bytes());
        assert!(parse_pyth_lazer_price(&buf).is_err());
    }
}
