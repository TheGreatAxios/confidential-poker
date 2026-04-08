# Create a Wallet

To play on-chain, you need an Ethereum-compatible wallet.

## Option 1: Generate with the CLI

We provide a script to generate wallets with viewer keys:

```bash
cd packages/server
npm run gen-wallets
```

This creates `poker-deploy.json` with:
- Agent wallet (for the main player)
- 5 bot wallets (for AI opponents)

Each wallet includes:
- Address (0x...)
- Private key
- Viewer key (x, y coordinates) — for BITE encryption

## Option 2: Use an Existing Wallet

If you have an existing wallet (like MetaMask), you can derive your viewer key programmatically.

### Using cast (Foundry)

```bash
# Get private key from your wallet (never share!)

# Derive viewer key from private key
cast wallet address --private-key $PRIVATE_KEY

# Get public key coordinates
cast secp256k1 $PRIVATE_KEY
```

### Using the TypeScript script

The `gen-wallets.ts` script uses `@noble/curves` to derive secp256k1 public keys:

```typescript
import { ec as EC } from '@noble/curves/secp256k1';

function getPublicKey(privHex: string) {
  const privInt = BigInt(privHex);
  const pub = EC.ProjectivePoint.BASE.multiply(privInt);
  return {
    x: '0x' + pub.x.toString(16).padStart(64, '0'),
    y: '0x' + pub.y.toString(16).padStart(64, '0'),
  };
}
```

## Getting Testnet Tokens

### sFUEL (Gas)

SKALE Base Sepolia uses sFUEL for gas. Get it from the faucet:

```bash
# Using cast
cast send $TO_ADDRESS "" --private-key $PRIVATE_KEY --value 0.01ether --rpc-url $RPC
```

Or visit: https://sfuel.skale.network/

### MockSKL (Game Tokens)

The game uses MockSKL for chip betting. Get tokens from the in-game faucet:

1. Sit down at the table
2. Click "Get Chips" button
3. The faucet will distribute test tokens

## Security Notes

- Never commit private keys to git
- The `poker-deploy.json` file contains test wallet keys — fine for testnet
- For mainnet, use hardware wallets and never expose private keys
- Viewer keys are public — they're used to encrypt your cards