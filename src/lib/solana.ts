import { Connection, PublicKey } from "@solana/web3.js";

export const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export type MintLook = {
  address: string;
  program: "Token-2022" | "SPL Token";
  decimals: number;
};

export function parseAddress(value: string): PublicKey | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed);
  } catch {
    return null;
  }
}

export async function solBalance(owner: string): Promise<number | null> {
  const key = parseAddress(owner);
  if (!key) return null;
  try {
    const lamports = await connection.getBalance(key);
    return Number(lamports) / 1_000_000_000;
  } catch {
    return null;
  }
}

export async function tokenUiBalance(owner: string, mint: string): Promise<string | null> {
  const ownerKey = parseAddress(owner);
  const mintKey = parseAddress(mint);
  if (!ownerKey || !mintKey) return null;
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(ownerKey, { mint: mintKey });
    const parsed = accounts.value[0]?.account.data.parsed as
      | { info?: { tokenAmount?: { uiAmountString?: string } } }
      | undefined;
    return parsed?.info?.tokenAmount?.uiAmountString ?? "0";
  } catch {
    return null;
  }
}

export async function describeMint(value: string): Promise<MintLook> {
  const key = parseAddress(value);
  if (!key) throw new Error("That is not a Solana address.");
  let info: Awaited<ReturnType<Connection["getAccountInfo"]>>;
  try {
    info = await connection.getAccountInfo(key);
  } catch {
    throw new Error("Could not reach Solana mainnet.");
  }
  if (!info) throw new Error("Mint account was not found on mainnet.");
  const owner = info.owner.toBase58();
  const program =
    owner === TOKEN_2022_PROGRAM ? "Token-2022" : owner === TOKEN_PROGRAM ? "SPL Token" : null;
  if (!program) throw new Error("That account is not a token mint.");
  const decimals = info.data[44] ?? 0;
  return { address: key.toBase58(), program, decimals };
}
