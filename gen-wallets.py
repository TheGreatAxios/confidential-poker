#!/usr/bin/env python3
"""Generate all wallets and viewer keys for poker game."""
import json, os, subprocess, tempfile
from pathlib import Path

def gen_secp256k1_viewkey():
    """Generate secp256k1 keypair using openssl."""
    with tempfile.NamedTemporaryFile(suffix=".pem", delete=False) as f:
        tmppath = f.name
    
    try:
        subprocess.run(
            ["openssl", "ecparam", "-name", "secp256k1", "-genkey", "-noout", "-out", tmppath],
            check=True, capture_output=True
        )
        result = subprocess.run(
            ["openssl", "ec", "-in", tmppath, "-text", "-noout"],
            capture_output=True, text=True, check=True
        )
    finally:
        os.unlink(tmppath)
    
    lines = result.stdout.split('\n')
    
    # Extract priv
    priv_parts = []
    in_priv = False
    for line in lines:
        s = line.strip()
        if s.startswith('priv:'):
            in_priv = True
            priv_parts.append(s.split(':', 1)[1].strip().replace(':', ''))
        elif in_priv:
            if s.startswith('pub:') or not s:
                in_priv = False
            else:
                priv_parts.append(s.replace(':', ''))
    priv_hex = ''.join(priv_parts)[-64:] if priv_parts else "00" * 32
    
    # Extract pub
    pub_parts = []
    in_pub = False
    for line in lines:
        s = line.strip()
        if s.startswith('pub:'):
            in_pub = True
            pub_parts.append(s.split(':', 1)[1].strip().replace(':', ''))
        elif in_pub:
            if not s or s.startswith('ASN1'):
                in_pub = False
            else:
                pub_parts.append(s.replace(':', ''))
    pub_hex = ''.join(pub_parts)
    
    x_hex = y_hex = None
    if pub_hex.startswith('04') and len(pub_hex) >= 130:
        x_hex = pub_hex[2:66]
        y_hex = pub_hex[66:130]
    
    if not x_hex or not y_hex:
        raise RuntimeError(f"Parse error: {result.stdout}")
    
    return priv_hex, x_hex, y_hex

def gen_wallet():
    """Generate a wallet using cast --no-password or raw secp256k1."""
    # Use openssl for the EC key and derive the Ethereum address
    priv_hex, x_hex, y_hex = gen_secp256k1_viewkey()
    
    # Get Ethereum address from private key using cast
    result = subprocess.run(
        ["/data/.foundry/bin/cast", "wallet", "address", "--private-key", "0x" + priv_hex],
        capture_output=True, text=True
    )
    addr = result.stdout.strip()
    
    return addr, "0x" + priv_hex, "0x" + x_hex, "0x" + y_hex

def main():
    RPC = "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet"
    CONTRACT = "0x0D5d9697bda657c1ba2D1882dcF7BB20903D3aDC"
    MOCK_SKL = "0x4C1928684B7028C2805FA1d12aCEd5c839A8D42C"
    AGENT_KEY = "0x8d15c36c01a8a72179d65da71a1a8cb82c9b907ee1f2fc5fe8c271dd4ccf19be"
    AGENT_ADDR = "0x2F3Ca9f2aA0Ec5c0ea7A23D05E5083E09A54e238"
    
    # Agent viewer key
    print("Generating agent viewer key...")
    _, a_x, a_y = gen_secp256k1_viewkey()
    agent = {"address": AGENT_ADDR, "private_key": AGENT_KEY,
             "viewer_x": "0x" + a_x, "viewer_y": "0x" + a_y}
    print(f"  Agent: {AGENT_ADDR}")
    
    # Generate 5 bot wallets
    bots = []
    for i in range(5):
        print(f"Generating Bot{i+1}...")
        addr, priv, vx, vy = gen_wallet()
        bot = {
            "name": f"Bot{i+1}",
            "address": addr,
            "private_key": priv,
            "viewer_x": vx,
            "viewer_y": vy,
        }
        bots.append(bot)
        print(f"  {addr}")
    
    data = {
        "rpc": RPC,
        "contract": CONTRACT,
        "mock_skl": MOCK_SKL,
        "agent": agent,
        "bots": bots,
    }
    out = Path("/data/.nanobot/persistent/scratchpad/poker-deploy.json")
    out.write_text(json.dumps(data, indent=2))
    print(f"\n✅ All wallets generated. Saved to {out}")

if __name__ == "__main__":
    main()
