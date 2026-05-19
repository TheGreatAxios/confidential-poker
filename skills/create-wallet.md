# Create a Wallet

Each agent needs a unique Ethereum-compatible wallet.

## Quick: Generate Agent Wallets

```bash
cd agents/langchain

# Generate 6 wallets (one per strategy) + auto-write .env.* files
bun run gen:wallets 6

# Overwrite existing files (destructive)
bun run gen:wallets 6 --force
```

**Default behavior:** creates `.env.wolf`, `.env.shark`, `.env.fox`, etc. in `agents/langchain/`.
If a `.env.<strategy>` already has `PRIVATE_KEY=`, it is **skipped**.

If you already have a `agents/langchain/.env` file, the script copies its content into each `.env.<strategy>` and appends `PRIVATE_KEY` + `STRATEGY`.

## Output

```
┌───────┬──────────┬──────────────────────────────────────────┬──────────────────────────────────────────────┐
│ Index │ Strategy │ Address                                  │ Private Key                                  │
├───────┼──────────┼──────────────────────────────────────────┼──────────────────────────────────────────────┤
│     0 │     wolf │ 0xAbC...                                 │ 0x123...                                     │
│     1 │    shark │ 0xDeF...                                 │ 0x456...                                     │
└───────┴──────────┴──────────────────────────────────────────┴──────────────────────────────────────────────┘
```

## Fund the Wallets

### Gas (SKALE Base Credits)

SKALE Base uses a credit system. When the agent's credit balance is low, it automatically opens a headless browser and claims from https://base-sepolia-faucet.skale.space. No manual gas acquisition needed.

### MockSKL Tokens (Game Currency)

The game uses MockSKL as the underlying token. Both agents and the frontend auto-claim from the built-in contract faucet when needed:

**Agents:**
1. Agent checks chip balance
2. If low, calls `MockSKL.faucet()` to claim free tokens
3. Approves ChipToken contract
4. Deposits into ChipToken for chips

Handled automatically by `ensureChipBalance()` in `agents/langchain/src/tools/claim-faucet.ts`.

**Humans (frontend):**
1. Click "Join Table" in the UI
2. If MockSKL balance is insufficient, the frontend auto-calls `MockSKL.faucet()` before depositing
3. No manual steps required

### Manual Claim (if needed)

If auto-claim fails (e.g., faucet cooldown), call the contract directly:

```bash
cast send <mockSklAddress> "faucet()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Chain Config

| Field | Value |
|-------|-------|
| Chain ID | 324705682 |
| RPC URL | `https://base-sepolia-testnet.skalenodes.com/v1/base-testnet` |
| Currency | CREDITS (credit-based gas system) |
| Explorer | `https://base-sepolia-testnet-explorer.skalenodes.com/` |

## Security

- Never commit private keys to git (`.env*` files are in `.gitignore`)
- These are testnet wallets — fine to generate and discard
- For mainnet, use hardware wallets and never expose private keys
- Viewer keys are public — they're derived from the private key and used to encrypt cards
