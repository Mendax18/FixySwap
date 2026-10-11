#!/bin/sh
set -eu
PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")"
cargo-build-sbf
solana config set --url https://api.devnet.solana.com --keypair ./deployer.json
solana airdrop 2
solana program deploy ./target/deploy/fixyswap.so --program-id ./target/deploy/fixyswap-keypair.json
solana program show "$(solana-keygen pubkey ./target/deploy/fixyswap-keypair.json)"
