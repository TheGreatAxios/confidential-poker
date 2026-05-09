---
name: card-encryption
description: BITE Protocol encryption for hole cards — viewing encrypted cards during play and reading them after showdown.
---

# Card Encryption (BITE Protocol)

## Overview

Poker uses the BITE Protocol for card privacy. Hole cards are encrypted on-chain so no one except the card holder can see them until showdown.

## Viewer Keys

When you sit down at a table, you provide a **viewer key** — your secp256k1 public key (x, y coordinates). This key is used by the contract to encrypt your hole cards via ECIES.

The viewer key is derived from your private key. The `key-store` module handles this automatically.

## Two Card-Reading Methods

### Method 1: After Showdown (getMyHoleCards)

After cards are revealed (CardsRevealed event), call `getMyHoleCards()` which returns decoded uint8 values:

```
card1, card2 = contract.getMyHoleCards()
```

These are plain uint8 encoded cards. Use the `readHoleCards` tool which handles this and decodes them to human-readable names.

### Method 2: During Play (BITE ECIES Decryption)

During active play, call `getMyEncryptedCards()` which returns ECIES-encrypted bytes. The agent decrypts them using BITE:

```
encrypted = contract.getMyEncryptedCards()
decrypted = BITE.decryptECIES(encrypted)
```

The `readHoleCards` tool handles this automatically.

## BITE Availability

BITE requires the SKALE chain's precompile contracts. The agent tries to use BITE for decryption. If the chain doesn't support BITE, fallback to reading cards after showdown via `getMyHoleCards`.

## Card Encoding Reference

| Encoded | Card |
|---------|------|
| 0 | 2 of Spades |
| 12 | Ace of Spades |
| 13 | 2 of Hearts |
| 26 | 2 of Diamonds |
| 39 | 2 of Clubs |
| 51 | Ace of Clubs |

Decode: `rank = (card % 13) + 2`, `suit = Math.floor(card / 13)` (0=Spades, 1=Hearts, 2=Diamonds, 3=Clubs)

## Security

- Private key is held in the key-store singleton and NEVER exposed to the LLM
- The LLM only sees decoded card names, never raw key material
- All signing happens via key-store, not the agent
