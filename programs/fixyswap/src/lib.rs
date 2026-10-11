use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey,
    pubkey::Pubkey,
    system_instruction,
};

entrypoint!(process_instruction);

pub const CONFIG_LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 1;
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
pub const ATA_PROGRAM_ID: Pubkey = pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

pub fn quote_out(amount_in: u64, rate_num: u64, rate_den: u64) -> Result<u64, ProgramError> {
    if amount_in == 0 || rate_den == 0 || rate_num == 0 {
        return Err(ProgramError::InvalidArgument);
    }
    let out = (amount_in as u128)
        .checked_mul(rate_num as u128)
        .ok_or(ProgramError::InvalidArgument)?
        .checked_div(rate_den as u128)
        .ok_or(ProgramError::InvalidArgument)?;
    u64::try_from(out).map_err(|_| ProgramError::InvalidArgument)
}
