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

struct Desk {
    admin: Pubkey,
    mint_in: Pubkey,
    mint_out: Pubkey,
    rate_num: u64,
    rate_den: u64,
    fee: u64,
}

pub fn process_instruction<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let (tag, rest) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    match tag {
        0 => initialize(program_id, accounts, rest),
        1 => charge_fee(program_id, accounts, rest),
        2 => prepare(program_id, accounts),
        3 => swap(program_id, accounts, rest),
        4 => refill(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn read_u64(data: &[u8]) -> Result<u64, ProgramError> {
    let bytes: [u8; 8] = data
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    Ok(u64::from_le_bytes(bytes))
}

fn load_desk(config: &AccountInfo, program_id: &Pubkey) -> Result<Desk, ProgramError> {
    if config.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    let raw = config.try_borrow_data()?;
    if raw.len() < CONFIG_LEN || raw[CONFIG_LEN - 1] != 1 {
        return Err(ProgramError::UninitializedAccount);
    }
    let mut admin = [0u8; 32];
    let mut mint_in = [0u8; 32];
    let mut mint_out = [0u8; 32];
    admin.copy_from_slice(&raw[0..32]);
    mint_in.copy_from_slice(&raw[32..64]);
    mint_out.copy_from_slice(&raw[64..96]);
    Ok(Desk {
        admin: Pubkey::new_from_array(admin),
        mint_in: Pubkey::new_from_array(mint_in),
        mint_out: Pubkey::new_from_array(mint_out),
        rate_num: read_u64(&raw[96..104])?,
        rate_den: read_u64(&raw[104..112])?,
        fee: read_u64(&raw[112..120])?,
    })
}

fn is_token_program(key: &Pubkey) -> bool {
    key == &TOKEN_PROGRAM_ID || key == &TOKEN_2022_PROGRAM_ID
}

fn decimals_of(mint: &AccountInfo, token_program: &AccountInfo) -> Result<u8, ProgramError> {
    if mint.owner != token_program.key || !is_token_program(token_program.key) {
        return Err(ProgramError::IncorrectProgramId);
    }
    let data = mint.try_borrow_data()?;
    if data.len() < 82 || data[45] != 1 {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(data[44])
}

fn authority_pda(program_id: &Pubkey, config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"authority", config.as_ref()], program_id)
}

fn ata_address(wallet: &Pubkey, token_program: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[wallet.as_ref(), token_program.as_ref(), mint.as_ref()],
        &ATA_PROGRAM_ID,
    )
    .0
}

fn create_ata<'a>(
    payer: &'a AccountInfo<'a>,
    ata: &'a AccountInfo<'a>,
    wallet: &'a AccountInfo<'a>,
    mint: &'a AccountInfo<'a>,
    system_program: &'a AccountInfo<'a>,
    token_program: &'a AccountInfo<'a>,
    ata_program: &'a AccountInfo<'a>,
) -> ProgramResult {
    if ata_program.key != &ATA_PROGRAM_ID {
        return Err(ProgramError::IncorrectProgramId);
    }
    if *ata.key != ata_address(wallet.key, token_program.key, mint.key) {
        return Err(ProgramError::InvalidAccountData);
    }
    let ix = Instruction {
        program_id: ATA_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*payer.key, true),
            AccountMeta::new(*ata.key, false),
            AccountMeta::new_readonly(*wallet.key, false),
            AccountMeta::new_readonly(*mint.key, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(*token_program.key, false),
        ],
        data: vec![1],
    };
    invoke(
        &ix,
        &[
            payer.clone(),
            ata.clone(),
            wallet.clone(),
            mint.clone(),
            system_program.clone(),
            token_program.clone(),
            ata_program.clone(),
        ],
    )
}

fn transfer_checked<'a>(
    token_program: &'a AccountInfo<'a>,
    source: &'a AccountInfo<'a>,
    mint: &'a AccountInfo<'a>,
    destination: &'a AccountInfo<'a>,
    authority: &'a AccountInfo<'a>,
    amount: u64,
    decimals: u8,
    seeds: Option<&[&[u8]]>,
) -> ProgramResult {
    let mut data = Vec::with_capacity(10);
    data.push(12);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);
    let ix = Instruction {
        program_id: *token_program.key,
        accounts: vec![
            AccountMeta::new(*source.key, false),
            AccountMeta::new_readonly(*mint.key, false),
            AccountMeta::new(*destination.key, false),
            AccountMeta::new_readonly(*authority.key, true),
        ],
        data,
    };
    let infos = [
        source.clone(),
        mint.clone(),
        destination.clone(),
        authority.clone(),
        token_program.clone(),
    ];
    match seeds {
        Some(signer) => invoke_signed(&ix, &infos, &[signer]),
        None => invoke(&ix, &infos),
    }
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 8 + 8 + 8 + 32 + 32 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let rate_num = read_u64(&data[0..8])?;
    let rate_den = read_u64(&data[8..16])?;
    let fee = read_u64(&data[16..24])?;
    if rate_den == 0 || rate_num == 0 {
        return Err(ProgramError::InvalidArgument);
    }
    let account_info_iter = &mut accounts.iter();
    let config = next_account_info(account_info_iter)?;
    let admin = next_account_info(account_info_iter)?;
    if config.owner != program_id || !config.is_writable || !admin.is_signer {
        return Err(ProgramError::IncorrectProgramId);
    }
    if config.data_len() < CONFIG_LEN {
        return Err(ProgramError::InvalidAccountData);
    }
    let mut raw = config.try_borrow_mut_data()?;
    if raw[CONFIG_LEN - 1] == 1 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    raw[0..32].copy_from_slice(admin.key.as_ref());
    raw[32..64].copy_from_slice(&data[24..56]);
    raw[64..96].copy_from_slice(&data[56..88]);
    raw[96..104].copy_from_slice(&rate_num.to_le_bytes());
    raw[104..112].copy_from_slice(&rate_den.to_le_bytes());
    raw[112..120].copy_from_slice(&fee.to_le_bytes());
    raw[CONFIG_LEN - 1] = 1;
    Ok(())
}

fn charge_fee(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let amount_in = read_u64(data)?;
    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let recipient = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    if system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    if !user.is_signer || !user.is_writable || !recipient.is_writable {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let desk = load_desk(config, program_id)?;
    if recipient.key != &desk.admin {
        return Err(ProgramError::InvalidAccountData);
    }
    let out = quote_out(amount_in, desk.rate_num, desk.rate_den)?;
    invoke(
        &system_instruction::transfer(user.key, recipient.key, desk.fee),
        &[user.clone(), recipient.clone(), system_program.clone()],
    )?;
    solana_program::msg!("fixyswap quote_out={}", out);
    Ok(())
}

fn prepare<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let mint_in = next_account_info(account_info_iter)?;
    let mint_out = next_account_info(account_info_iter)?;
    let vault_authority = next_account_info(account_info_iter)?;
    let vault_in = next_account_info(account_info_iter)?;
    let vault_out = next_account_info(account_info_iter)?;
    let token_program_in = next_account_info(account_info_iter)?;
    let token_program_out = next_account_info(account_info_iter)?;
    let ata_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    if !payer.is_signer || system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let desk = load_desk(config, program_id)?;
    if mint_in.key != &desk.mint_in || mint_out.key != &desk.mint_out {
        return Err(ProgramError::InvalidAccountData);
    }
    let (authority, _) = authority_pda(program_id, config.key);
    if vault_authority.key != &authority {
        return Err(ProgramError::InvalidArgument);
    }
    let _ = decimals_of(mint_in, token_program_in)?;
    let _ = decimals_of(mint_out, token_program_out)?;
    create_ata(
        payer,
        vault_in,
        vault_authority,
        mint_in,
        system_program,
        token_program_in,
        ata_program,
    )?;
    create_ata(
        payer,
        vault_out,
        vault_authority,
        mint_out,
        system_program,
        token_program_out,
        ata_program,
    )?;
    Ok(())
}

fn swap<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], data: &[u8]) -> ProgramResult {
    if data.len() != 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let amount_in = read_u64(data)?;
    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let recipient = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let mint_in = next_account_info(account_info_iter)?;
    let mint_out = next_account_info(account_info_iter)?;
    let user_in = next_account_info(account_info_iter)?;
    let user_out = next_account_info(account_info_iter)?;
    let vault_authority = next_account_info(account_info_iter)?;
    let vault_in = next_account_info(account_info_iter)?;
    let vault_out = next_account_info(account_info_iter)?;
    let token_program_in = next_account_info(account_info_iter)?;
    let token_program_out = next_account_info(account_info_iter)?;
    let ata_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    if system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    if !user.is_signer || !user.is_writable || !recipient.is_writable {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let desk = load_desk(config, program_id)?;
    if recipient.key != &desk.admin || mint_in.key != &desk.mint_in || mint_out.key != &desk.mint_out
    {
        return Err(ProgramError::InvalidAccountData);
    }
    let (authority, bump) = authority_pda(program_id, config.key);
    if vault_authority.key != &authority {
        return Err(ProgramError::InvalidArgument);
    }
    if *user_in.key != ata_address(user.key, token_program_in.key, mint_in.key) {
        return Err(ProgramError::InvalidAccountData);
    }
    let dec_in = decimals_of(mint_in, token_program_in)?;
    let dec_out = decimals_of(mint_out, token_program_out)?;
    let out = quote_out(amount_in, desk.rate_num, desk.rate_den)?;
    if out == 0 {
        return Err(ProgramError::InsufficientFunds);
    }
    create_ata(
        user,
        user_out,
        user,
        mint_out,
        system_program,
        token_program_out,
        ata_program,
    )?;
    create_ata(
        user,
        vault_in,
        vault_authority,
        mint_in,
        system_program,
        token_program_in,
        ata_program,
    )?;
    transfer_checked(
        token_program_in,
        user_in,
        mint_in,
        vault_in,
        user,
        amount_in,
        dec_in,
        None,
    )?;
    let bump_seed = [bump];
    let signer: &[&[u8]] = &[b"authority", config.key.as_ref(), &bump_seed];
    transfer_checked(
        token_program_out,
        vault_out,
        mint_out,
        user_out,
        vault_authority,
        out,
        dec_out,
        Some(signer),
    )?;
    invoke(
        &system_instruction::transfer(user.key, recipient.key, desk.fee),
        &[user.clone(), recipient.clone(), system_program.clone()],
    )?;
    solana_program::msg!("fixyswap swap in={} out={}", amount_in, out);
    Ok(())
}

fn refill<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], data: &[u8]) -> ProgramResult {
    if data.len() != 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let amount = read_u64(data)?;
    if amount == 0 {
        return Err(ProgramError::InvalidArgument);
    }
    let account_info_iter = &mut accounts.iter();
    let user = next_account_info(account_info_iter)?;
    let config = next_account_info(account_info_iter)?;
    let mint_out = next_account_info(account_info_iter)?;
    let user_out = next_account_info(account_info_iter)?;
    let vault_authority = next_account_info(account_info_iter)?;
    let vault_out = next_account_info(account_info_iter)?;
    let token_program_out = next_account_info(account_info_iter)?;
    let ata_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    if !user.is_signer || system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let desk = load_desk(config, program_id)?;
    if mint_out.key != &desk.mint_out {
        return Err(ProgramError::InvalidAccountData);
    }
    let (authority, _) = authority_pda(program_id, config.key);
    if vault_authority.key != &authority {
        return Err(ProgramError::InvalidArgument);
    }
    if *user_out.key != ata_address(user.key, token_program_out.key, mint_out.key) {
        return Err(ProgramError::InvalidAccountData);
    }
    let decimals = decimals_of(mint_out, token_program_out)?;
    create_ata(
        user,
        vault_out,
        vault_authority,
        mint_out,
        system_program,
        token_program_out,
        ata_program,
    )?;
    transfer_checked(
        token_program_out,
        user_out,
        mint_out,
        vault_out,
        user,
        amount,
        decimals,
        None,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ata_address, quote_out, ATA_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID};
    use solana_program::pubkey::Pubkey;

    #[test]
    fn five_allin_is_one_cars_in_base_units() {
        let five = 5_000_000u64;
        assert_eq!(quote_out(five, 1, 5).unwrap(), 1_000_000);
    }

    #[test]
    fn rejects_zero_and_bad_rate() {
        assert!(quote_out(0, 1, 5).is_err());
        assert!(quote_out(5, 1, 0).is_err());
        assert!(quote_out(5, 0, 1).is_err());
    }

    #[test]
    fn ata_depends_on_token_program() {
        let wallet = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let classic = ata_address(&wallet, &TOKEN_PROGRAM_ID, &mint);
        let ext = ata_address(&wallet, &TOKEN_2022_PROGRAM_ID, &mint);
        assert_ne!(classic, ext);
        let (again, _) = Pubkey::find_program_address(
            &[
                wallet.as_ref(),
                TOKEN_PROGRAM_ID.as_ref(),
                mint.as_ref(),
            ],
            &ATA_PROGRAM_ID,
        );
        assert_eq!(classic, again);
    }
}
