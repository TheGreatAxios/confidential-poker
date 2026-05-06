# Create a Wallet

To play on-chain, you need an Ethereum-compatible wallet.

## Option 1: Use an Existing Wallet (MetaMask, etc.)

Add SKALE Base Sepolia to your wallet:

- **Chain ID**: 324705682
- **RPC URL**: `https://base-sepolia-testnet.skalenodes.com/v1/base-testnet`
- **Currency**: sFUEL
- **Explorer**: `https://base-sepolia-testnet-explorer.skalenodes.com/`

## Option 2: Generate a Wallet Script

Use the gen-wallets script in the langchain agent package:

```bash
cd agents/langchain
bun run scripts/gen-wallets.ts
```

## Getting Testnet Tokens

### sFUEL (Gas)

SKALE Base Sepolia uses sFUEL for gas. Get it from:

- https://sfuel.skale.network/

### Chip Tokens (Game Tokens)

Chip tokens are the on-chain representation of your stack. To get them:
1. Connect your wallet to the frontend
2. Deposit underlying tokens into the ChipToken contract via the Join Panel
3. Approve the poker table contract to spend your chips
4. Sit down and play

## Security Notes

- Never commit private keys to git
- For testnet, generated wallets are fine
- For mainnet, use hardware wallets and never expose private keys
- Viewer keys are public — they're used to encrypt your cards
