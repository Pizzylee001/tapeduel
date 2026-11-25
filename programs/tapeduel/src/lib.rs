#![allow(ambiguous_glob_reexports)]

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral, vrf, vrf_callback};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_rollups_sdk::vrf::{
    self as mb_vrf,
    consts::program_identity_pubkey,
    instructions::{create_request_randomness_ix_const, RequestRandomnessParams},
    types::SerializableAccountMeta,
};

pub mod constants;
pub mod errors;
pub mod math;
pub mod state;
#[cfg(test)]
mod tests;

use constants::*;
use errors::TapeDuelError;
use math::*;
use state::*;

declare_id!("BdVNbT73iebJ3w396FeWiu3cvcQbe4fG1EZ138d1QpXi");

#[ephemeral]
#[program]
pub mod tapeduel {
    use super::*;

    /// Initializes the global ArenaConfig and ArenaTreasury PDAs once on Devnet L1.
    pub fn init_arena(ctx: Context<InitArena>) -> Result<()> {
        let arena = &mut ctx.accounts.arena;
        arena.authority = ctx.accounts.authority.key();
        arena.total_sprints = 0;
        arena.total_ghosts = 0;
        arena.total_volume_lamports = 0;
        arena.bump = ctx.bumps.arena;

        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.bump = ctx.bumps.treasury;
        Ok(())
    }

    /// Deposits Devnet SOL into ArenaTreasury so solo winning challengers get paid immediately on-chain.
    pub fn fund_treasury(ctx: Context<FundTreasury>, amount_lamports: u64) -> Result<()> {
        require!(amount_lamports > 0, TapeDuelError::InvalidAmount);
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            amount_lamports,
        )?;
        Ok(())
    }

    /// Deposits SOL into the player's L1 escrow PlayerVault PDA.
    pub fn deposit(ctx: Context<Deposit>, amount_lamports: u64) -> Result<()> {
        require!(amount_lamports > 0, TapeDuelError::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        if vault.owner == Pubkey::default() {
            vault.owner = ctx.accounts.player.key();
            vault.bump = ctx.bumps.vault;
        } else {
            require_keys_eq!(vault.owner, ctx.accounts.player.key(), TapeDuelError::Unauthorized);
        }

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: vault.to_account_info(),
                },
            ),
            amount_lamports,
        )?;

        vault.available_lamports = vault
            .available_lamports
            .checked_add(amount_lamports)
            .ok_or(TapeDuelError::MathOverflow)?;
        Ok(())
    }

    /// Withdraws available SOL from the player's L1 escrow PlayerVault PDA.
    /// Strictly requires the primary wallet signer (never callable by a session key).
    pub fn withdraw(ctx: Context<Withdraw>, amount_lamports: u64) -> Result<()> {
        require!(amount_lamports > 0, TapeDuelError::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(vault.owner, ctx.accounts.player.key(), TapeDuelError::Unauthorized);
        require!(
            vault.available_lamports >= amount_lamports,
            TapeDuelError::InsufficientVaultBalance
        );

        let min_rent = Rent::get()?.minimum_balance(vault.to_account_info().data_len());
        let current_lamports = vault.to_account_info().lamports();
        let remaining = current_lamports
            .checked_sub(amount_lamports)
            .ok_or(TapeDuelError::InsufficientVaultBalance)?;
        require!(remaining >= min_rent, TapeDuelError::RentExemptViolation);

        vault.available_lamports = vault
            .available_lamports
            .checked_sub(amount_lamports)
            .ok_or(TapeDuelError::MathOverflow)?;

        **vault.to_account_info().try_borrow_mut_lamports()? = remaining;
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .player
            .to_account_info()
            .lamports()
            .checked_add(amount_lamports)
            .ok_or(TapeDuelError::MathOverflow)?;
        Ok(())
    }

    /// Creates a new SprintRun PDA on base layer and locks the player's stake in PlayerVault.
    /// Pair with `delegate_sprint` in the same L1 transaction for a single-signature duel entry.
    pub fn create_sprint(
        ctx: Context<CreateSprint>,
        sprint_nonce: u64,
        session_key: Pubkey,
        stake_lamports: u64,
        validator: Pubkey,
    ) -> Result<()> {
        require!(
            stake_lamports >= MIN_STAKE_LAMPORTS && stake_lamports <= MAX_STAKE_LAMPORTS,
            TapeDuelError::InvalidStakeAmount
        );
        require!(ctx.accounts.ghost.active, TapeDuelError::GhostNotActive);
        require!(
            ctx.accounts.vault.sprint_nonce == sprint_nonce,
            TapeDuelError::InvalidSprintState
        );
        require!(
            ctx.accounts.vault.available_lamports >= stake_lamports,
            TapeDuelError::InsufficientVaultBalance
        );

        let arena = &mut ctx.accounts.arena;
        let sprint_id = arena
            .total_sprints
            .checked_add(1)
            .ok_or(TapeDuelError::MathOverflow)?;
        arena.total_sprints = sprint_id;
        arena.total_volume_lamports = arena
            .total_volume_lamports
            .checked_add(stake_lamports)
            .ok_or(TapeDuelError::MathOverflow)?;

        let vault = &mut ctx.accounts.vault;
        vault.available_lamports = vault
            .available_lamports
            .checked_sub(stake_lamports)
            .ok_or(TapeDuelError::MathOverflow)?;
        vault.locked_lamports = vault
            .locked_lamports
            .checked_add(stake_lamports)
            .ok_or(TapeDuelError::MathOverflow)?;
        vault.sprint_nonce = vault
            .sprint_nonce
            .checked_add(1)
            .ok_or(TapeDuelError::MathOverflow)?;

        let sprint = &mut ctx.accounts.sprint;
        sprint.sprint_id = sprint_id;
        sprint.player = ctx.accounts.player.key();
        sprint.session_key = session_key;
        sprint.ghost_id = ctx.accounts.ghost.ghost_id;
        sprint.stake_lamports = stake_lamports;
        sprint.status = STATUS_CREATED;
        sprint.start_ts = 0;
        sprint.end_ts = 0;
        sprint.last_mark_ts = 0;
        sprint.settled_ts = 0;
        sprint.entry_prices = [0; 3];
        sprint.last_prices = [0; 3];
        sprint.weights = [0; 3];
        sprint.pnl_bps = 0;
        sprint.cards = [0; 3];
        sprint.cards_used = [false; 3];
        sprint.active_card = CARD_NONE;
        sprint.active_card_until = 0;
        sprint.vrf_requested = false;
        sprint.vrf_fulfilled = false;
        sprint.vrf_seed = [0u8; 32];
        sprint.move_count = 0;
        sprint.moves = [TapeMove::default(); MAX_MOVES];
        sprint.published_as_ghost = false;
        sprint.challenger_won = false;
        sprint.delegated_validator = validator;
        sprint.bump = ctx.bumps.sprint;
        Ok(())
    }

    /// Delegates the initialized SprintRun PDA to the chosen MagicBlock ER validator.
    pub fn delegate_sprint(ctx: Context<DelegateSprint>, sprint_nonce: u64) -> Result<()> {
        let player_key = ctx.accounts.payer.key();
        let nonce_bytes = sprint_nonce.to_le_bytes();
        let seeds: &[&[u8]] = &[SPRINT_SEED, player_key.as_ref(), &nonce_bytes];

        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            seeds,
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Requests verifiable randomness from MagicBlock VRF (works on Devnet L1 or inside ER).
    pub fn request_vrf_cards(ctx: Context<RequestVrfCards>, client_seed: u8) -> Result<()> {
        let sprint = &mut ctx.accounts.sprint;
        let payer_key = ctx.accounts.payer.key();
        require!(
            payer_key == sprint.player || payer_key == sprint.session_key,
            TapeDuelError::Unauthorized
        );
        require!(!sprint.vrf_fulfilled, TapeDuelError::VrfAlreadyFulfilled);
        sprint.vrf_requested = true;

        let mut caller_seed = [client_seed; 32];
        let id_bytes = sprint.sprint_id.to_le_bytes();
        caller_seed[0..8].copy_from_slice(&id_bytes);

        const VRF_PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&ID);
        let ix = create_request_randomness_ix_const(
            RequestRandomnessParams {
                payer: payer_key,
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: ID,
                callback_discriminator: instruction::CallbackVrfCards::DISCRIMINATOR.to_vec(),
                caller_seed,
                accounts_metas: Some(vec![SerializableAccountMeta {
                    pubkey: sprint.key(),
                    is_signer: false,
                    is_writable: true,
                }]),
                ..Default::default()
            },
            VRF_PROGRAM_IDENTITY,
        );

        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// Invoked exclusively by MagicBlock VRF program identity to deal the 3 Tactical Cards.
    pub fn callback_vrf_cards(
        ctx: Context<CallbackVrfCards>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let sprint = &mut ctx.accounts.sprint;
        require!(!sprint.vrf_fulfilled, TapeDuelError::VrfAlreadyFulfilled);
        sprint.vrf_seed = randomness;
        sprint.cards = derive_vrf_hand(&randomness);
        sprint.vrf_fulfilled = true;
        Ok(())
    }

    /// Starts the 90-second sprint clock on MagicBlock ER using live Pyth Lazer SOL/BTC/ETH feeds.
    pub fn start_sprint_er(ctx: Context<SprintErAction>, initial_weights: [i8; 3]) -> Result<()> {
        validate_weights(initial_weights)?;
        let sprint = &mut ctx.accounts.sprint;
        require_er_signer(ctx.accounts.authority.key(), sprint)?;
        require!(
            sprint.status == STATUS_CREATED,
            TapeDuelError::InvalidSprintState
        );

        let prices = read_three_pyth_feeds(
            &ctx.accounts.sol_feed,
            &ctx.accounts.btc_feed,
            &ctx.accounts.eth_feed,
        )?;
        let now_ts = Clock::get()?.unix_timestamp;

        sprint.status = STATUS_ACTIVE;
        sprint.start_ts = now_ts;
        sprint.end_ts = now_ts
            .checked_add(SPRINT_DURATION_SECS)
            .ok_or(TapeDuelError::MathOverflow)?;
        sprint.last_mark_ts = now_ts;
        sprint.entry_prices = prices;
        sprint.last_prices = prices;
        sprint.weights = initial_weights;

        record_move(sprint, 0, initial_weights, CARD_NONE);
        Ok(())
    }

    /// Gasless sub-50ms rebalance inside MagicBlock ER signed by the ephemeral session key.
    pub fn rebalance_er(ctx: Context<SprintErAction>, new_weights: [i8; 3]) -> Result<()> {
        validate_weights(new_weights)?;
        let sprint = &mut ctx.accounts.sprint;
        require_er_signer(ctx.accounts.authority.key(), sprint)?;
        require!(
            sprint.status == STATUS_ACTIVE,
            TapeDuelError::InvalidSprintState
        );

        let now_ts = Clock::get()?.unix_timestamp;
        require!(now_ts <= sprint.end_ts, TapeDuelError::SprintExpired);

        let prices = read_three_pyth_feeds(
            &ctx.accounts.sol_feed,
            &ctx.accounts.btc_feed,
            &ctx.accounts.eth_feed,
        )?;

        let delta = compute_mark_to_market_delta_bps(
            sprint.weights,
            sprint.last_prices,
            prices,
            sprint.active_card,
            sprint.active_card_until,
            now_ts,
        )?;
        sprint.pnl_bps = sprint
            .pnl_bps
            .checked_add(delta)
            .ok_or(TapeDuelError::MathOverflow)?;
        sprint.last_prices = prices;
        sprint.last_mark_ts = now_ts;
        sprint.weights = new_weights;

        let elapsed = now_ts.saturating_sub(sprint.start_ts).clamp(0, 90) as u16;
        record_move(sprint, elapsed, new_weights, CARD_NONE);
        Ok(())
    }

    /// Activates one of the 3 VRF-dealt Tactical Cards inside MagicBlock ER.
    pub fn activate_card_er(ctx: Context<SprintErAction>, slot: u8) -> Result<()> {
        let slot_idx = slot as usize;
        require!(slot_idx < 3, TapeDuelError::InvalidCardSlot);

        let sprint = &mut ctx.accounts.sprint;
        require_er_signer(ctx.accounts.authority.key(), sprint)?;
        require!(
            sprint.status == STATUS_ACTIVE,
            TapeDuelError::InvalidSprintState
        );
        require!(sprint.vrf_fulfilled, TapeDuelError::VrfNotReady);
        require!(!sprint.cards_used[slot_idx], TapeDuelError::CardAlreadyUsed);

        let now_ts = Clock::get()?.unix_timestamp;
        require!(now_ts <= sprint.end_ts, TapeDuelError::SprintExpired);

        let prices = read_three_pyth_feeds(
            &ctx.accounts.sol_feed,
            &ctx.accounts.btc_feed,
            &ctx.accounts.eth_feed,
        )?;

        // Mark-to-market up to the exact activation second before applying new card effect
        let delta = compute_mark_to_market_delta_bps(
            sprint.weights,
            sprint.last_prices,
            prices,
            sprint.active_card,
            sprint.active_card_until,
            now_ts,
        )?;
        sprint.pnl_bps = sprint
            .pnl_bps
            .checked_add(delta)
            .ok_or(TapeDuelError::MathOverflow)?;
        sprint.last_prices = prices;
        sprint.last_mark_ts = now_ts;

        let card_id = sprint.cards[slot_idx];
        sprint.cards_used[slot_idx] = true;

        match card_id {
            CARD_BOOST_2X => {
                sprint.active_card = CARD_BOOST_2X;
                sprint.active_card_until = now_ts
                    .checked_add(BOOST_DURATION_SECS)
                    .ok_or(TapeDuelError::MathOverflow)?;
            }
            CARD_SHIELD => {
                sprint.active_card = CARD_SHIELD;
                sprint.active_card_until = now_ts
                    .checked_add(SHIELD_DURATION_SECS)
                    .ok_or(TapeDuelError::MathOverflow)?;
            }
            CARD_POLARITY_FLIP => {
                sprint.weights = [-sprint.weights[0], -sprint.weights[1], -sprint.weights[2]];
            }
            _ => return err!(TapeDuelError::InvalidCardSlot),
        }

        let elapsed = now_ts.saturating_sub(sprint.start_ts).clamp(0, 90) as u16;
        let current_weights = sprint.weights;
        record_move(sprint, elapsed, current_weights, card_id);
        Ok(())
    }

    /// Marks the final PnL on MagicBlock ER, closes the sprint, and commits + undelegates back to L1.
    pub fn settle_and_undelegate_er(ctx: Context<SettleAndUndelegateEr>) -> Result<()> {
        let sprint = &mut ctx.accounts.sprint;
        require_er_signer(ctx.accounts.payer.key(), sprint)?;
        require!(
            sprint.status == STATUS_ACTIVE,
            TapeDuelError::InvalidSprintState
        );

        let now_ts = Clock::get()?.unix_timestamp;
        let prices = read_three_pyth_feeds(
            &ctx.accounts.sol_feed,
            &ctx.accounts.btc_feed,
            &ctx.accounts.eth_feed,
        )?;

        let delta = compute_mark_to_market_delta_bps(
            sprint.weights,
            sprint.last_prices,
            prices,
            sprint.active_card,
            sprint.active_card_until,
            now_ts,
        )?;
        sprint.pnl_bps = sprint
            .pnl_bps
            .checked_add(delta)
            .ok_or(TapeDuelError::MathOverflow)?;
        sprint.last_prices = prices;
        sprint.last_mark_ts = now_ts;
        sprint.settled_ts = now_ts;
        sprint.status = STATUS_SETTLED_ER;

        sprint.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.sprint.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Settles escrowed SOL on Solana Devnet L1 after the SprintRun PDA undelegates from ER.
    pub fn finalize_payout(ctx: Context<FinalizePayout>) -> Result<()> {
        let sprint = &mut ctx.accounts.sprint;
        require!(
            sprint.status == STATUS_SETTLED_ER,
            TapeDuelError::InvalidSprintState
        );
        require_keys_eq!(sprint.player, ctx.accounts.vault.owner, TapeDuelError::Unauthorized);
        require!(
            sprint.ghost_id == ctx.accounts.ghost.ghost_id,
            TapeDuelError::InvalidSprintState
        );

        let stake = sprint.stake_lamports;
        let challenger_won = sprint.pnl_bps > ctx.accounts.ghost.target_return_bps;
        let breakdown = compute_settlement_payouts(stake, challenger_won)?;

        let vault = &mut ctx.accounts.vault;
        let ghost = &mut ctx.accounts.ghost;
        let treasury = &mut ctx.accounts.treasury;

        vault.locked_lamports = vault
            .locked_lamports
            .checked_sub(stake)
            .ok_or(TapeDuelError::MathOverflow)?;

        if challenger_won {
            let profit = breakdown.winner_profit_lamports;
            let treasury_min_rent =
                Rent::get()?.minimum_balance(treasury.to_account_info().data_len());
            let treasury_balance = treasury.to_account_info().lamports();
            let remaining_treasury = treasury_balance
                .checked_sub(profit)
                .ok_or(TapeDuelError::InsufficientTreasuryFunds)?;
            require!(
                remaining_treasury >= treasury_min_rent,
                TapeDuelError::InsufficientTreasuryFunds
            );

            **treasury.to_account_info().try_borrow_mut_lamports()? = remaining_treasury;
            **vault.to_account_info().try_borrow_mut_lamports()? = vault
                .to_account_info()
                .lamports()
                .checked_add(profit)
                .ok_or(TapeDuelError::MathOverflow)?;

            vault.available_lamports = vault
                .available_lamports
                .checked_add(stake)
                .and_then(|v| v.checked_add(profit))
                .ok_or(TapeDuelError::MathOverflow)?;
            vault.total_wins = vault.total_wins.saturating_add(1);
            ghost.losses = ghost.losses.saturating_add(1);
        } else {
            let vault_min_rent = Rent::get()?.minimum_balance(vault.to_account_info().data_len());
            let vault_balance = vault.to_account_info().lamports();
            let remaining_vault = vault_balance
                .checked_sub(stake)
                .ok_or(TapeDuelError::InsufficientVaultBalance)?;
            require!(remaining_vault >= vault_min_rent, TapeDuelError::RentExemptViolation);

            **vault.to_account_info().try_borrow_mut_lamports()? = remaining_vault;
            **treasury.to_account_info().try_borrow_mut_lamports()? = treasury
                .to_account_info()
                .lamports()
                .checked_add(stake)
                .ok_or(TapeDuelError::MathOverflow)?;

            ghost.unclaimed_bounty_lamports = ghost
                .unclaimed_bounty_lamports
                .checked_add(breakdown.ghost_defense_lamports)
                .ok_or(TapeDuelError::MathOverflow)?;
            ghost.bounty_earned_lamports = ghost
                .bounty_earned_lamports
                .checked_add(breakdown.ghost_defense_lamports)
                .ok_or(TapeDuelError::MathOverflow)?;
            vault.total_losses = vault.total_losses.saturating_add(1);
            ghost.wins = ghost.wins.saturating_add(1);
        }

        sprint.challenger_won = challenger_won;
        sprint.status = STATUS_FINALIZED_L1;
        Ok(())
    }

    /// Publishes a finalized winning SprintRun as an immutable on-chain Bounty Ghost.
    pub fn publish_ghost(
        ctx: Context<PublishGhost>,
        ghost_id: u64,
        callsign: String,
        regime: u8,
    ) -> Result<()> {
        let sprint = &mut ctx.accounts.sprint;
        require_keys_eq!(sprint.player, ctx.accounts.creator.key(), TapeDuelError::Unauthorized);
        require!(
            sprint.status == STATUS_FINALIZED_L1 && sprint.challenger_won,
            TapeDuelError::NotWinningSprint
        );
        require!(!sprint.published_as_ghost, TapeDuelError::AlreadyPublished);

        let expected_id = ctx
            .accounts
            .arena
            .total_ghosts
            .checked_add(1)
            .ok_or(TapeDuelError::MathOverflow)?;
        require!(ghost_id == expected_id, TapeDuelError::InvalidSprintState);

        let (callsign_bytes, callsign_len) = validate_callsign(&callsign)?;
        ctx.accounts.arena.total_ghosts = expected_id;
        sprint.published_as_ghost = true;

        let ghost = &mut ctx.accounts.ghost;
        ghost.ghost_id = expected_id;
        ghost.creator = ctx.accounts.creator.key();
        ghost.callsign = callsign_bytes;
        ghost.callsign_len = callsign_len;
        ghost.stake_lamports = sprint.stake_lamports;
        ghost.target_return_bps = sprint.pnl_bps;
        ghost.regime = regime.min(2);
        ghost.wins = 0;
        ghost.losses = 0;
        ghost.bounty_earned_lamports = 0;
        ghost.unclaimed_bounty_lamports = 0;
        ghost.entry_prices = sprint.entry_prices;
        ghost.exit_prices = sprint.last_prices;
        ghost.move_count = sprint.move_count;
        ghost.moves = sprint.moves;
        ghost.tape_hash = sprint.vrf_seed;
        ghost.source_sprint_id = sprint.sprint_id;
        ghost.active = true;
        ghost.created_ts = Clock::get()?.unix_timestamp;
        ghost.bump = ctx.bumps.ghost;
        Ok(())
    }

    /// Seeds an initial Bounty Ghost on Devnet (arena authority only) from a verified real tape.
    pub fn seed_ghost(
        ctx: Context<SeedGhost>,
        ghost_id: u64,
        callsign: String,
        stake_lamports: u64,
        target_return_bps: i32,
        regime: u8,
        entry_prices: [i64; 3],
        exit_prices: [i64; 3],
        moves: Vec<TapeMove>,
        tape_hash: [u8; 32],
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.arena.authority,
            ctx.accounts.authority.key(),
            TapeDuelError::Unauthorized
        );
        require!(
            stake_lamports >= MIN_STAKE_LAMPORTS && stake_lamports <= MAX_STAKE_LAMPORTS,
            TapeDuelError::InvalidStakeAmount
        );
        let expected_id = ctx
            .accounts
            .arena
            .total_ghosts
            .checked_add(1)
            .ok_or(TapeDuelError::MathOverflow)?;
        require!(ghost_id == expected_id, TapeDuelError::InvalidSprintState);

        let (callsign_bytes, callsign_len) = validate_callsign(&callsign)?;
        ctx.accounts.arena.total_ghosts = expected_id;

        let mut fixed_moves = [TapeMove::default(); MAX_MOVES];
        let count = moves.len().min(MAX_MOVES);
        for (i, mv) in moves.into_iter().take(count).enumerate() {
            validate_weights([mv.sol_w, mv.btc_w, mv.eth_w])?;
            fixed_moves[i] = mv;
        }

        let ghost = &mut ctx.accounts.ghost;
        ghost.ghost_id = expected_id;
        ghost.creator = ctx.accounts.authority.key();
        ghost.callsign = callsign_bytes;
        ghost.callsign_len = callsign_len;
        ghost.stake_lamports = stake_lamports;
        ghost.target_return_bps = target_return_bps;
        ghost.regime = regime.min(2);
        ghost.wins = 0;
        ghost.losses = 0;
        ghost.bounty_earned_lamports = 0;
        ghost.unclaimed_bounty_lamports = 0;
        ghost.entry_prices = entry_prices;
        ghost.exit_prices = exit_prices;
        ghost.move_count = count as u8;
        ghost.moves = fixed_moves;
        ghost.tape_hash = tape_hash;
        ghost.source_sprint_id = 0;
        ghost.active = true;
        ghost.created_ts = Clock::get()?.unix_timestamp;
        ghost.bump = ctx.bumps.ghost;
        Ok(())
    }

    /// Claims accumulated 10% defense bounties earned by a published Bounty Ghost.
    pub fn claim_bounty(ctx: Context<ClaimBounty>) -> Result<()> {
        let ghost = &mut ctx.accounts.ghost;
        require_keys_eq!(ghost.creator, ctx.accounts.creator.key(), TapeDuelError::Unauthorized);
        let amount = ghost.unclaimed_bounty_lamports;
        require!(amount > 0, TapeDuelError::NoClaimableBounty);

        let treasury = &mut ctx.accounts.treasury;
        let treasury_min_rent = Rent::get()?.minimum_balance(treasury.to_account_info().data_len());
        let remaining = treasury
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(TapeDuelError::InsufficientTreasuryFunds)?;
        require!(remaining >= treasury_min_rent, TapeDuelError::InsufficientTreasuryFunds);

        ghost.unclaimed_bounty_lamports = 0;
        **treasury.to_account_info().try_borrow_mut_lamports()? = remaining;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .creator
            .to_account_info()
            .lamports()
            .checked_add(amount)
            .ok_or(TapeDuelError::MathOverflow)?;
        Ok(())
    }
}

fn require_er_signer(signer: Pubkey, sprint: &SprintRun) -> Result<()> {
    require!(
        signer == sprint.player || signer == sprint.session_key,
        TapeDuelError::Unauthorized
    );
    Ok(())
}

fn read_three_pyth_feeds(
    sol_feed: &AccountInfo,
    btc_feed: &AccountInfo,
    eth_feed: &AccountInfo,
) -> Result<[i64; 3]> {
    require_keys_eq!(sol_feed.key(), SOL_USD_FEED, TapeDuelError::InvalidPriceFeed);
    require_keys_eq!(btc_feed.key(), BTC_USD_FEED, TapeDuelError::InvalidPriceFeed);
    require_keys_eq!(eth_feed.key(), ETH_USD_FEED, TapeDuelError::InvalidPriceFeed);

    require_keys_eq!(*sol_feed.owner, PYTH_LAZER_PROGRAM_ID, TapeDuelError::InvalidPriceFeed);
    require_keys_eq!(*btc_feed.owner, PYTH_LAZER_PROGRAM_ID, TapeDuelError::InvalidPriceFeed);
    require_keys_eq!(*eth_feed.owner, PYTH_LAZER_PROGRAM_ID, TapeDuelError::InvalidPriceFeed);

    let sol = parse_pyth_lazer_price(&sol_feed.try_borrow_data()?)?;
    let btc = parse_pyth_lazer_price(&btc_feed.try_borrow_data()?)?;
    let eth = parse_pyth_lazer_price(&eth_feed.try_borrow_data()?)?;

    Ok([sol.price, btc.price, eth.price])
}

fn record_move(sprint: &mut SprintRun, elapsed_secs: u16, weights: [i8; 3], card_id: u8) {
    let idx = sprint.move_count as usize;
    if idx < MAX_MOVES {
        sprint.moves[idx] = TapeMove {
            elapsed_secs,
            sol_w: weights[0],
            btc_w: weights[1],
            eth_w: weights[2],
            card_id,
        };
        sprint.move_count = sprint.move_count.saturating_add(1);
    }
}

#[derive(Accounts)]
pub struct InitArena<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ArenaConfig::SIZE,
        seeds = [ARENA_SEED],
        bump
    )]
    pub arena: Account<'info, ArenaConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + ArenaTreasury::SIZE,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, ArenaTreasury>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundTreasury<'info> {
    #[account(mut, seeds = [TREASURY_SEED], bump = treasury.bump)]
    pub treasury: Account<'info, ArenaTreasury>,
    #[account(mut)]
    pub funder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        init_if_needed,
        payer = player,
        space = 8 + PlayerVault::SIZE,
        seeds = [VAULT_SEED, player.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, PlayerVault>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, player.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, PlayerVault>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(sprint_nonce: u64)]
pub struct CreateSprint<'info> {
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Account<'info, ArenaConfig>,
    #[account(
        mut,
        seeds = [VAULT_SEED, player.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, PlayerVault>,
    #[account(seeds = [GHOST_SEED, &ghost.ghost_id.to_le_bytes()], bump = ghost.bump)]
    pub ghost: Account<'info, GhostTape>,
    #[account(
        init,
        payer = player,
        space = 8 + SprintRun::SIZE,
        seeds = [SPRINT_SEED, player.key().as_ref(), &sprint_nonce.to_le_bytes()],
        bump
    )]
    pub sprint: Account<'info, SprintRun>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateSprint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: SprintRun PDA initialized in the preceding instruction
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestVrfCards<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub sprint: Account<'info, SprintRun>,
    /// CHECK: Verified against official MagicBlock Devnet L1 or ER VRF oracle queues
    #[account(
        mut,
        constraint = oracle_queue.key() == mb_vrf::consts::DEFAULT_QUEUE
            || oracle_queue.key() == mb_vrf::consts::DEFAULT_EPHEMERAL_QUEUE
            || oracle_queue.key() == mb_vrf::consts::DEFAULT_TEST_QUEUE
    )]
    pub oracle_queue: UncheckedAccount<'info>,
    /// CHECK: Canonical Solana SlotHashes sysvar
    #[account(address = pubkey!("SysvarS1otHashes111111111111111111111111111"))]
    pub slot_hashes: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct CallbackVrfCards<'info> {
    #[account(mut)]
    pub sprint: Account<'info, SprintRun>,
}

#[derive(Accounts)]
pub struct SprintErAction<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub sprint: Account<'info, SprintRun>,
    /// CHECK: Verified inside handler against exact SOL_USD_FEED pubkey and Pyth Lazer program owner
    pub sol_feed: UncheckedAccount<'info>,
    /// CHECK: Verified inside handler against exact BTC_USD_FEED pubkey and Pyth Lazer program owner
    pub btc_feed: UncheckedAccount<'info>,
    /// CHECK: Verified inside handler against exact ETH_USD_FEED pubkey and Pyth Lazer program owner
    pub eth_feed: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct SettleAndUndelegateEr<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub sprint: Account<'info, SprintRun>,
    /// CHECK: Verified inside handler against exact SOL_USD_FEED pubkey and Pyth Lazer program owner
    pub sol_feed: UncheckedAccount<'info>,
    /// CHECK: Verified inside handler against exact BTC_USD_FEED pubkey and Pyth Lazer program owner
    pub btc_feed: UncheckedAccount<'info>,
    /// CHECK: Verified inside handler against exact ETH_USD_FEED pubkey and Pyth Lazer program owner
    pub eth_feed: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct FinalizePayout<'info> {
    #[account(mut, seeds = [TREASURY_SEED], bump = treasury.bump)]
    pub treasury: Account<'info, ArenaTreasury>,
    #[account(
        mut,
        seeds = [VAULT_SEED, sprint.player.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, PlayerVault>,
    #[account(mut, seeds = [GHOST_SEED, &ghost.ghost_id.to_le_bytes()], bump = ghost.bump)]
    pub ghost: Account<'info, GhostTape>,
    #[account(mut)]
    pub sprint: Account<'info, SprintRun>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(ghost_id: u64)]
pub struct PublishGhost<'info> {
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Account<'info, ArenaConfig>,
    #[account(mut)]
    pub sprint: Account<'info, SprintRun>,
    #[account(
        init,
        payer = creator,
        space = 8 + GhostTape::SIZE,
        seeds = [GHOST_SEED, &ghost_id.to_le_bytes()],
        bump
    )]
    pub ghost: Account<'info, GhostTape>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ghost_id: u64)]
pub struct SeedGhost<'info> {
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump)]
    pub arena: Account<'info, ArenaConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + GhostTape::SIZE,
        seeds = [GHOST_SEED, &ghost_id.to_le_bytes()],
        bump
    )]
    pub ghost: Account<'info, GhostTape>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimBounty<'info> {
    #[account(mut, seeds = [TREASURY_SEED], bump = treasury.bump)]
    pub treasury: Account<'info, ArenaTreasury>,
    #[account(mut, seeds = [GHOST_SEED, &ghost.ghost_id.to_le_bytes()], bump = ghost.bump)]
    pub ghost: Account<'info, GhostTape>,
    #[account(mut)]
    pub creator: Signer<'info>,
}
