# Create a Viewer Key

BITE Protocol uses viewer keys (secp256k1 public key coordinates) to encrypt your cards so only you can see them.

## What is a Viewer Key?

A viewer key consists of two values:
- **x** — 32-byte hex string (bytes32)
- **y** — 32-byte hex string (bytes32)

Together, these represent a point on the secp256k1 elliptic curve, derived from your wallet's private key.

## Why Do You Need One?

When you sit down at the table, you provide your viewer key. The contract uses it to:
1. Encrypt your hole cards (ECIES) — so only you can decrypt them
2. Encrypt cards for TEE showdown — for fair reveal

Your private key can always decrypt your cards. Other players cannot see what you have.

## How to Generate

### Option 1: Auto-Generated

The easiest way — run the wallet generator:

```bash
cd packages/server
npm run gen-wallets
```

This creates wallets with viewer keys pre-generated.

### Option 2: Programmatic

Use `@noble/curves` to derive from your private key:

```typescript
import { randomBytes } from 'viem';
import { ec as EC } from '@noble/curves/secp256k1';

// Generate a random wallet
const privateKey = '0x' + randomBytes(32).toString('hex');

// Derive viewer key
const privInt = BigInt(privateKey);
const pub = EC.ProjectivePoint.BASE.multiply(privInt);

const viewerKey = {
  x: '0x' + pub.x.toString(16).padStart(64, '0'),
  y: '0x' + pub.y.toString(16).padStart(64, '0'),
};

console.log('Viewer Key:', viewerKey);
```

### Option 3: Using cast

```bash
# Derive public key from private key
cast pubkey $PRIVATE_KEY

# This gives you x and y coordinates
```

## Using Your Viewer Key

When you sit down at the poker table:

```typescript
// Call sitDown with your viewer key
contract.writeContract({
  functionName: 'sitDown',
  args: [{ x: viewerKey.x, y: viewerKey.y }],
});
```

The contract stores your viewer key and uses it to encrypt your cards.

## Security

- Your viewer key is **public** — it's stored on-chain
- Your **private key** must remain secret — never share it
- Anyone with your private key can decrypt your cards
- Use a hardware wallet for mainnet for maximum security