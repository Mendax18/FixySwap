import fs from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("913gmkUU6DriGxg29upw9sSzVRPoSbH6fMKwiXYGTqnZ");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const CONFIG_LEN = 121;
const FEE = 1_650_000n;
const DECIMALS = 6;

const payer = await Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(new URL("./deployer.json", import.meta.url), "utf8"))),
);
const connection = new Connection("http://127.0.0.1:8899", "confirmed");

async function pda(seeds, program) {
  const [address] = await PublicKey.findProgramAddress(seeds, program);
  return address;
}

function ix(programId, keys, data) {
  return { programId, keys, data };
}

function initMintIx(programId, mint, authority) {
  const data = Buffer.alloc(35);
  data[0] = 20;
  data[1] = DECIMALS;
  Buffer.from(authority.toBytes()).copy(data, 2);
  data[34] = 0;
  return ix(programId, [{ pubkey: mint, isSigner: false, isWritable: true }], data);
}

function mintToIx(programId, mint, dest, authority, amount) {
  const data = Buffer.alloc(10);
  data[0] = 14;
  data.writeBigUInt64LE(amount, 1);
  data[9] = DECIMALS;
  return ix(
    programId,
    [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  );
}

function createAtaIx(payerKey, ata, owner, mint, tokenProgram) {
  return ix(
    ATA,
    [
      { pubkey: payerKey, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    Buffer.from([1]),
  );
}

async function send(tx, signers) {
  await sendAndConfirmTransaction(connection, tx, signers);
}

async function tokenAmount(account) {
  const info = await connection.getAccountInfo(account);
  if (!info) return 0n;
  return Buffer.from(info.data).readBigUInt64LE(64);
}

const mintIn = await Keypair.generate();
const mintOut = await Keypair.generate();
const mintRent = await connection.getMinimumBalanceForRentExemption(82);
await send(
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintIn.publicKey,
      lamports: mintRent,
      space: 82,
      programId: TOKEN_2022,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintOut.publicKey,
      lamports: mintRent,
      space: 82,
      programId: TOKEN,
    }),
    initMintIx(TOKEN_2022, mintIn.publicKey, payer.publicKey),
    initMintIx(TOKEN, mintOut.publicKey, payer.publicKey),
  ),
  [payer, mintIn, mintOut],
);

const config = await Keypair.generate();
const rent = await connection.getMinimumBalanceForRentExemption(CONFIG_LEN);
const init = Buffer.alloc(1 + 8 + 8 + 8 + 32 + 32);
init[0] = 0;
init.writeBigUInt64LE(1n, 1);
init.writeBigUInt64LE(5n, 9);
init.writeBigUInt64LE(FEE, 17);
Buffer.from(mintIn.publicKey.toBytes()).copy(init, 25);
Buffer.from(mintOut.publicKey.toBytes()).copy(init, 57);
await send(
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: config.publicKey,
      lamports: rent,
      space: CONFIG_LEN,
      programId: PROGRAM_ID,
    }),
    ix(
      PROGRAM_ID,
      [
        { pubkey: config.publicKey, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      init,
    ),
  ),
  [payer, config],
);

const authority = await pda([Buffer.from("authority"), config.publicKey.toBytes()], PROGRAM_ID);
const vaultIn = await pda(
  [authority.toBytes(), TOKEN_2022.toBytes(), mintIn.publicKey.toBytes()],
  ATA,
);
const vaultOut = await pda(
  [authority.toBytes(), TOKEN.toBytes(), mintOut.publicKey.toBytes()],
  ATA,
);

const user = await Keypair.generate();
const userIn = await pda([user.publicKey.toBytes(), TOKEN_2022.toBytes(), mintIn.publicKey.toBytes()], ATA);
const userOut = await pda([user.publicKey.toBytes(), TOKEN.toBytes(), mintOut.publicKey.toBytes()], ATA);

await send(
  new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: user.publicKey,
      lamports: 20_000_000,
    }),
    createAtaIx(payer.publicKey, userIn, user.publicKey, mintIn.publicKey, TOKEN_2022),
    mintToIx(TOKEN_2022, mintIn.publicKey, userIn, payer.publicKey, 5_000_000n),
    ix(
      PROGRAM_ID,
      [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: config.publicKey, isSigner: false, isWritable: false },
        { pubkey: mintIn.publicKey, isSigner: false, isWritable: false },
        { pubkey: mintOut.publicKey, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: vaultIn, isSigner: false, isWritable: true },
        { pubkey: vaultOut, isSigner: false, isWritable: true },
        { pubkey: TOKEN_2022, isSigner: false, isWritable: false },
        { pubkey: TOKEN, isSigner: false, isWritable: false },
        { pubkey: ATA, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      Buffer.from([2]),
    ),
    mintToIx(TOKEN, mintOut.publicKey, vaultOut, payer.publicKey, 2_000_000n),
  ),
  [payer],
);

const before = await connection.getBalance(payer.publicKey);
const swapData = Buffer.alloc(9);
swapData[0] = 3;
swapData.writeBigUInt64LE(5_000_000n, 1);
await send(
  new Transaction().add(
    ix(
      PROGRAM_ID,
      [
        { pubkey: user.publicKey, isSigner: true, isWritable: true },
        { pubkey: payer.publicKey, isSigner: false, isWritable: true },
        { pubkey: config.publicKey, isSigner: false, isWritable: false },
        { pubkey: mintIn.publicKey, isSigner: false, isWritable: false },
        { pubkey: mintOut.publicKey, isSigner: false, isWritable: false },
        { pubkey: userIn, isSigner: false, isWritable: true },
        { pubkey: userOut, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: vaultIn, isSigner: false, isWritable: true },
        { pubkey: vaultOut, isSigner: false, isWritable: true },
        { pubkey: TOKEN_2022, isSigner: false, isWritable: false },
        { pubkey: TOKEN, isSigner: false, isWritable: false },
        { pubkey: ATA, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      swapData,
    ),
  ),
  [user],
);

const gotIn = await tokenAmount(vaultIn);
const gotOut = await tokenAmount(userOut);
const leftVault = await tokenAmount(vaultOut);
const after = await connection.getBalance(payer.publicKey);
if (gotIn !== 5_000_000n || gotOut !== 1_000_000n || leftVault !== 1_000_000n) {
  throw new Error(`balances in=${gotIn} out=${gotOut} vault=${leftVault}`);
}
if (after - before !== FEE) {
  throw new Error(`fee ${after - before}`);
}
console.log(
  JSON.stringify({
    programId: PROGRAM_ID.toBase58(),
    mintIn: "token-2022",
    mintOut: "spl-token",
    vaultReceived: gotIn.toString(),
    userReceived: gotOut.toString(),
    deployerReceived: Number(after - before),
  }),
);
