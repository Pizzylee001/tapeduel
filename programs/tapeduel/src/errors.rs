use anchor_lang::prelude::*;

#[error_code]
pub enum TapeDuelError {
    #[msg("Unauthorized signer for this instruction")]
    Unauthorized,
    #[msg("Invalid deposit or withdraw amount")]
    InvalidAmount,
    #[msg("Insufficient available vault balance")]
    InsufficientVaultBalance,
    #[msg("Stake amount must be between 0.05 SOL and 1.00 SOL")]
    InvalidStakeAmount,
    #[msg("Selected Bounty Ghost is not active")]
    GhostNotActive,
    #[msg("Allocation weights must each be within -100..=100 and sum of absolutes <= 100")]
    InvalidAllocationWeights,
    #[msg("Sprint is not in the expected lifecycle state")]
    InvalidSprintState,
    #[msg("Sprint timer has already expired")]
    SprintExpired,
    #[msg("VRF Tactical Cards have not been dealt yet")]
    VrfNotReady,
    #[msg("VRF has already been fulfilled for this sprint")]
    VrfAlreadyFulfilled,
    #[msg("Invalid tactical card slot index")]
    InvalidCardSlot,
    #[msg("Tactical card in this slot has already been used")]
    CardAlreadyUsed,
    #[msg("Invalid Pyth Lazer price feed account or owner")]
    InvalidPriceFeed,
    #[msg("Oracle price value is invalid or non-positive")]
    InvalidOraclePrice,
    #[msg("Arithmetic overflow or underflow")]
    MathOverflow,
    #[msg("Arena treasury has insufficient funds to pay winning profit")]
    InsufficientTreasuryFunds,
    #[msg("Only a finalized winning sprint can be published as a Bounty Ghost")]
    NotWinningSprint,
    #[msg("This sprint has already been published as a Bounty Ghost")]
    AlreadyPublished,
    #[msg("Callsign must be 3 to 20 printable ASCII characters")]
    InvalidCallsign,
    #[msg("No unclaimed defense bounty is available for this Ghost")]
    NoClaimableBounty,
    #[msg("Vault balance would fall below rent-exempt minimum")]
    RentExemptViolation,
}
