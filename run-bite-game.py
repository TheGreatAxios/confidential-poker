#!/usr/bin/env python3
"""
Full BITE-encrypted poker game on SKALE Base Sepolia.
Contract: 0x0D5d9697bda657c1ba2D1882dcF7BB20903D3aDC
Uses ECIES viewer keys for encrypted card dealing and CTX for showdown.
"""
import json, subprocess, sys, time, random
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec

RPC = "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet"
CAST = "/data/.foundry/bin/cast"
BITE_CONTRACT = "0x0D5d9697bda657c1ba2D1882dcF7BB20903D3aDC"

def load_data():
    return json.loads(Path("/data/.nanobot/persistent/scratchpad/poker-deploy.json").read_text())

def privkey_to_viewer_key(priv_hex: str) -> tuple:
    """Derive secp256k1 public key (x, y) from private key for BITE viewer key."""
    priv_hex = priv_hex.replace("0x", "")
    priv_int = int(priv_hex, 16)
    privkey = ec.derive_private_key(priv_int, ec.SECP256K1())
    pubnums = privkey.public_key().public_numbers()
    x = f"0x{pubnums.x:064x}"
    y = f"0x{pubnums.y:064x}"
    return (x, y)

def send_tx(to, sig, args, from_key, value=None, gas_limit=5000000):
    """Send a transaction, return tx hash."""
    cmd = [CAST, "send", to]
    if sig:
        cmd += [sig] + [str(a) for a in args]
    cmd += ["--rpc-url", RPC, "--legacy", "--private-key", from_key, "--gas-limit", str(gas_limit)]
    if value:
        cmd += ["--value", str(value)]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        return None, result.stderr.strip()[:400]
    # Extract tx hash from cast output (various formats)
    text = result.stdout.strip()
    # Try to find a 66-char hex string (0x + 64)
    import re
    hashes = re.findall(r'0x[0-9a-fA-F]{64}', text)
    if hashes:
        return hashes[-1], None  # Last one should be tx hash
    # Fallback: look for "transactionHash" line
    for line in text.split('\n'):
        if 'transactionHash' in line or 'hash' in line.lower():
            m = re.search(r'0x[0-9a-fA-F]{64}', line)
            if m:
                return m.group(0), None
    # If stderr has success indicators but no hash found, it may have worked
    if result.returncode == 0:
        return "success", None
    return None, f"no tx hash found: {result.stdout.strip()[:200]}"

def read_contract(contract, sig, args=[]):
    """Call a contract view function."""
    cmd = [CAST, "call", contract, sig] + [str(a) for a in args] + ["--rpc-url", RPC]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return None
    return result.stdout.strip()

def to_int(hex_str):
    if hex_str is None:
        return None
    try:
        return int(hex_str, 16)
    except:
        return None

PHASES = ["Waiting", "Preflop", "Flop", "Turn", "River", "Showdown"]

def card_name(c):
    if c == 0: return "??"
    rank = c & 0x0F
    suit = (c >> 4) & 0x03
    r = {10:'T', 11:'J', 12:'Q', 13:'K', 14:'A'}.get(rank, str(rank))
    s = ['♣','♦','♥','♠'][suit]
    return f"{r}{s}"

def main():
    data = load_data()
    agent = data["agent"]
    bots = data["bots"]
    AGENT_KEY = agent["private_key"]
    
    all_players = [{"name": "🤖 Batshit", "address": agent["address"], "private_key": AGENT_KEY}]
    all_players += [{"name": f"🃏 {b['name']}", "address": b["address"], "private_key": b["private_key"]} for b in bots]
    
    CONTRACT = BITE_CONTRACT
    
    print("=" * 65)
    print("🔐 BITE-ENCRYPTED POKER — SKALE BASE SEPOLIA")
    print("=" * 65)
    print(f"Contract: {CONTRACT}")
    print(f"Explorer: https://base-sepolia-testnet-explorer.skalenodes.com/tx/")
    print(f"Players: {len(all_players)}")
    for p in all_players:
        vk = privkey_to_viewer_key(p["private_key"])
        print(f"  {p['name']}: {p['address']}")
        print(f"    Viewer Key: ({vk[0][:16]}..., {vk[1][:16]}...)")
    print()
    
    # ─── FUND ALL PLAYERS INCLUDING AGENT ───
    print("━━━ Funding wallets (if needed) ━━━")
    FUND = "30000000000000000"  # 0.03 ETH
    MIN_BAL = "50000000000000000"  # 0.05 ETH threshold (need more for revealCards gas value)
    for p in all_players:
        bal = subprocess.run([CAST, "balance", p["address"], "--rpc-url", RPC],
                           capture_output=True, text=True).stdout.strip()
        if bal and int(bal, 16) > int(MIN_BAL, 16):
            eth = int(bal, 16) / 1e18
            print(f"  ⏭️ {p['name']}: {eth:.4f} ETH (sufficient)")
        else:
            _, err = send_tx(p["address"], "", [], AGENT_KEY, value=FUND)
            if err:
                print(f"  ❌ {p['name']}: {err[:100]}")
            else:
                print(f"  ✅ {p['name']} funded")
            time.sleep(0.5)
    
    # ─── COMPUTE VIEWER KEYS ───
    print(f"\n━━━ Computing viewer keys ━━━")
    viewer_keys = {}
    for p in all_players:
        vk = privkey_to_viewer_key(p["private_key"])
        viewer_keys[p["address"].lower()] = vk
        print(f"  {p['name']}: ({vk[0][:20]}..., {vk[1][:20]}...)")
    
    # ─── CHECK CURRENT STATE ━──
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
    print(f"\n  Current state: phase={PHASES[phase if phase is not None else 0]}, players={pc}")
    
    # Check already seated
    seated = set()
    for i in range(6):
        addr = read_contract(CONTRACT, "getPlayer(uint256)(address)", [i])
        if addr and addr != "0x" and int(addr, 16) != 0:
            seated.add(addr.lower())
            for p in all_players:
                if p["address"].lower() == addr.lower():
                    print(f"  ✅ {p['name']} already seated")
                    break
    
    # ─── SIT DOWN ───
    print(f"\n━━━ Seating players (BITE contract — sitDown with viewer key) ━━━")
    unseated = [p for p in all_players if p["address"].lower() not in seated]
    
    if unseated:
        print(f"  {len(unseated)} players need to sit down...")
        for p in unseated:
            phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
            if phase is not None and phase != 0:
                print(f"  ⏳ Game in progress (phase {PHASES[phase]}), skipping {p['name']}")
                continue
            
            vk = viewer_keys[p["address"].lower()]
            # sitDown((bytes32 x, bytes32 y)) — nonpayable, no BUY_IN value
            sig = "sitDown((bytes32,bytes32))"
            args = [f"({vk[0]},{vk[1]})"]
            
            tx, err = send_tx(CONTRACT, sig, args, p["private_key"])
            if err:
                if "already" in err.lower() or "joined" in err.lower():
                    print(f"  ⏭️ {p['name']}: already seated")
                elif "Game not waiting" in err or "started" in err.lower():
                    print(f"  ⏳ {p['name']}: game already started")
                else:
                    print(f"  ❌ {p['name']}: {err[:200]}")
            else:
                print(f"  ✅ {p['name']} sat down! TX: {tx}")
            time.sleep(0.5)
    else:
        print(f"  All players already seated!")
    
    # ─── DEAL NEW HAND ───
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
    
    if phase == 0 and pc and pc >= 2:
        print(f"\n━━━ 🃏 Dealing new hand (BITE encrypted) ━━━")
        # dealNewHand encrypts cards with ECIES for each player and TE for showdown
        tx, err = send_tx(CONTRACT, "dealNewHand()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:200]}")
            print("  Trying with any player key...")
            for p in all_players:
                tx, err = send_tx(CONTRACT, "dealNewHand()", [], p["private_key"])
                if tx:
                    print(f"  ✅ Dealt by {p['name']}! TX: {tx}")
                    break
                time.sleep(0.5)
        else:
            print(f"  ✅ New hand dealt! TX: {tx}")
        time.sleep(2)  # Wait for CTX decryption if applicable
    
    # ─── GAME STATE ━━━
    print(f"\n━━━ Game State ━━━")
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    hand = to_int(read_contract(CONTRACT, "handNumber()(uint256)"))
    pot = to_int(read_contract(CONTRACT, "pot()(uint256)"))
    cBet = to_int(read_contract(CONTRACT, "currentBet()(uint256)"))
    turn = to_int(read_contract(CONTRACT, "currentTurnIndex()(uint256)"))
    
    print(f"  Phase: {PHASES[phase] if phase is not None else '??'}")
    print(f"  Hand: #{hand}  Pot: {pot}  Current Bet: {cBet}  Turn: {turn}")
    
    # Show encrypted cards
    pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
    print(f"\n  📋 Player Info:")
    for i in range(pc or 0):
        addr = read_contract(CONTRACT, "getPlayer(uint256)(address)", [i])
        if addr:
            p_name = addr
            for p in all_players:
                if p["address"].lower() == addr.lower():
                    p_name = p["name"]
                    break
            
            enc = read_contract(CONTRACT, "getEncryptedCards(uint256)(bytes)", [i])
            te = read_contract(CONTRACT, "getTEEcards(uint256)(bytes)", [i])
            
            enc_len = len(enc)//2-1 if enc else 0
            te_len = len(te)//2-1 if te else 0
            print(f"    {p_name}: ECIES={enc_len}B, TE={te_len}B")
    
    # ─── BETTING LOGIC ━━━
    def run_betting(max_iters=30):
        """Run a complete betting round."""
        for _ in range(max_iters):
            phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
            if phase is None or phase == 0 or phase == 5:  # Waiting or Showdown
                return "complete"
            
            turn = to_int(read_contract(CONTRACT, "currentTurnIndex()(uint256)"))
            if turn is None or turn >= (2**256 - 2):
                return "round_done"  # No current turn — need to deal next street
            
            cBet = to_int(read_contract(CONTRACT, "currentBet()(uint256)")) or 0
            
            # Get player address at this index
            addr = read_contract(CONTRACT, "getPlayer(uint256)(address)", [turn])
            if not addr:
                time.sleep(0.5)
                continue
            
            player = None
            for p in all_players:
                if p["address"].lower() == addr.lower():
                    player = p
                    break
            if not player:
                time.sleep(0.5)
                continue
            
            # Get player struct to find bet amount and stack
            # players(uint256) returns: (address, (bytes32,bytes32), bool, bool, uint256, bool, bytes, bytes, bool)
            info = read_contract(CONTRACT, "players(uint256)(address,(bytes32,bytes32),bool,bool,uint256,bool,bytes,bytes,bool)", [turn])
            if not info:
                time.sleep(0.5)
                continue
            
            # Parse multi-line output from cast
            lines = info.strip().split('\n')
            # address is first, viewerKey tuple is next 2, isActive, hasActed, betAmount, isAllIn, ...
            p_active = lines[2].strip() == "true" if len(lines) > 2 else True
            p_bet = to_int(lines[4].strip()) if len(lines) > 4 else 0
            p_allin = lines[5].strip() == "true" if len(lines) > 5 else False
            
            if p_allin:
                print(f"\n  🃏 {player['name']}: ALL-IN (skip)")
                time.sleep(0.3)
                continue
            
            to_call = cBet - p_bet
            
            # Get ETH balance for stack estimation
            bal_hex = subprocess.run([CAST, "balance", player["address"], "--rpc-url", RPC],
                                    capture_output=True, text=True).stdout.strip()
            p_stack = int(bal_hex, 16) if bal_hex else 0
            
            print(f"\n  🃏 {player['name']}'s turn (bet={p_bet}, to_call={to_call}, stack={p_stack})")
            
            if to_call == 0:
                r = random.random()
                if r < 0.6:
                    action, args, val = "check()", [], None
                    print(f"    → Check ✓")
                else:
                    raise_amt = random.choice([10, 20, 50, 100])
                    action, args, val = "raise(uint256)", [str(raise_amt)], str(raise_amt)
                    print(f"    → Raise +{raise_amt} 🔥")
            else:
                r = random.random()
                if not (p_stack >= to_call):
                    if p_stack > 0 and r < 0.7:
                        action, args, val = "call()", [], str(p_stack)
                        print(f"    → Call ALL-IN {p_stack} 💰")
                    else:
                        action, args, val = "fold()", [], None
                        print(f"    → Fold 🏳️")
                elif to_call > 500 and r < 0.3:
                    action, args, val = "fold()", [], None
                    print(f"    → Fold 🏳️")
                elif r < 0.75:
                    action, args, val = "call()", [], str(to_call)
                    print(f"    → Call {to_call} ✓")
                else:
                    raise_amt = random.choice([10, 20, 50])
                    total = to_call + raise_amt
                    action, args, val = "raise(uint256)", [str(raise_amt)], str(total)
                    print(f"    → Raise +{raise_amt} (total {total}) 🔥")
            
            tx, err = send_tx(CONTRACT, action, args, player["private_key"], value=val)
            if err:
                print(f"    ❌ {err[:150]}")
                time.sleep(1)
            else:
                print(f"    TX: {tx[:20]}...")
                time.sleep(0.3)
        
        return "max_iters"
    
    # ─── PREFLOP ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 1:
        print(f"\n━━━ PREFLOP BETTING ━━━")
        run_betting()
    
    # ─── FLOP ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    turn = to_int(read_contract(CONTRACT, "currentTurnIndex()(uint256)"))
    if phase == 1 and (turn is None or turn >= (2**256 - 2)):
        print(f"\n━━━ DEALING FLOP ━━━")
        tx, err = send_tx(CONTRACT, "dealFlop()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:200]}")
        else:
            print(f"  ✅ Flop dealt! TX: {tx}")
            time.sleep(1)
    
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 2:
        print(f"\n━━━ FLOP BETTING ━━━")
        run_betting()
    
    # ─── TURN ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    turn = to_int(read_contract(CONTRACT, "currentTurnIndex()(uint256)"))
    if phase == 2 and (turn is None or turn >= (2**256 - 2)):
        print(f"\n━━━ DEALING TURN ━━━")
        tx, err = send_tx(CONTRACT, "dealTurn()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:200]}")
        else:
            print(f"  ✅ Turn dealt! TX: {tx}")
            time.sleep(1)
    
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 3:
        print(f"\n━━━ TURN BETTING ━━━")
        run_betting()
    
    # ─── RIVER ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    turn = to_int(read_contract(CONTRACT, "currentTurnIndex()(uint256)"))
    if phase == 3 and (turn is None or turn >= (2**256 - 2)):
        print(f"\n━━━ DEALING RIVER ━━━")
        tx, err = send_tx(CONTRACT, "dealRiver()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:200]}")
        else:
            print(f"  ✅ River dealt! TX: {tx}")
            time.sleep(1)
    
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 4:
        print(f"\n━━━ RIVER BETTING ━━━")
        run_betting()
    
    # ─── SHOWDOWN ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    turn = to_int(read_contract(CONTRACT, "currentTurnIndex()(uint256)"))
    
    if phase == 4 and (turn is None or turn >= (2**256 - 2)):
        print(f"\n━━━ 🏆 SHOWDOWN (BITE CTX DECRYPTION) 🏆 ━━━")
        
        active = to_int(read_contract(CONTRACT, "activePlayerCount()(uint256)"))
        print(f"  Active players: {active}")
        
        # Show encrypted card data
        pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
        for i in range(pc or 0):
            addr = read_contract(CONTRACT, "getPlayer(uint256)(address)", [i])
            enc = read_contract(CONTRACT, "getEncryptedCards(uint256)(bytes)", [i])
            te = read_contract(CONTRACT, "getTEEcards(uint256)(bytes)", [i])
            p_name = addr[:16] if addr else "?"
            for p in all_players:
                if addr and p["address"].lower() == addr.lower():
                    p_name = p["name"]
                    break
            revealed = read_contract(CONTRACT, "isCardsRevealed(uint256)(bool)", [i])
            enc_len = len(enc)//2-1 if enc else 0
            te_len = len(te)//2-1 if te else 0
            print(f"  {p_name}: ECIES={enc_len}B, TE={te_len}B, revealed={revealed}")
        
        # Option A: Use revealCards() — BITE CTX decryption (the cool way!)
        # Requires sending ETH as value to pay for callback gas
        if active and active > 1:
            print(f"\n  🔐 Initiating BITE CTX reveal...")
            # Send 0.01 ETH to cover callback gas
            reveal_value = "10000000000000000"  # 0.01 ETH
            
        # Use richest active player for revealCards (needs value for callback gas)
        reveal_player = None
        max_bal = 0
        for p in all_players:
            bal_hex = subprocess.run([CAST, "balance", p["address"], "--rpc-url", RPC],
                                    capture_output=True, text=True).stdout.strip()
            bal = int(bal_hex, 16) if bal_hex else 0
            if bal > max_bal:
                max_bal = bal
                reveal_player = p
        print(f"  Using {reveal_player['name']} for revealCards (balance: {max_bal/1e18:.4f} ETH)")
        
        # Send 0.01 ETH to cover callback gas
        reveal_value = "10000000000000000"  # 0.01 ETH
        
        tx, err = send_tx(CONTRACT, "revealCards()", [], reveal_player["private_key"], value=reveal_value, gas_limit=1000000)
        if err:
            print(f"  ❌ revealCards failed: {err[:300]}")
            print(f"  Trying resolveHand() as fallback...")
        else:
            print(f"  ✅ revealCards submitted! TX: {tx}")
            print(f"  ⏳ Waiting for CTX callback (next block)...")
            time.sleep(5)  # Wait for the CTX to execute on next block
        
        # Check if showdown happened
        phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
        if phase != 0 and phase != 5:
            # Try owner resolve as fallback
            print(f"  Phase still {PHASES[phase]}, trying resolveHand()...")
            tx, err = send_tx(CONTRACT, "resolveHand()", [], AGENT_KEY)
            if err:
                print(f"  ❌ resolveHand: {err[:200]}")
            else:
                print(f"  ✅ resolveHand TX: {tx}")
                time.sleep(2)
        
        # Check reveal status after
        print(f"\n  📋 Post-showdown card status:")
        pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
        for i in range(pc or 0):
            addr = read_contract(CONTRACT, "getPlayer(uint256)(address)", [i])
            revealed = read_contract(CONTRACT, "isCardsRevealed(uint256)(bool)", [i])
            p_name = addr[:16] if addr else "?"
            for p in all_players:
                if addr and p["address"].lower() == addr.lower():
                    p_name = p["name"]
                    break
            print(f"    {p_name}: revealed={revealed}")
    
    # ─── FINAL STATE ━━━
    print(f"\n{'=' * 65}")
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    hand = to_int(read_contract(CONTRACT, "handNumber()(uint256)"))
    pot = to_int(read_contract(CONTRACT, "pot()(uint256)"))
    
    print(f"  Phase: {PHASES[phase] if phase is not None else '??'}")
    print(f"  Hand: #{hand}  Pot: {pot}")
    print(f"  Contract: {CONTRACT}")
    print(f"  Explorer: https://base-sepolia-testnet-explorer.skalenodes.com/address/{CONTRACT}")
    
    if phase == 0:
        print(f"\n✅ Hand complete! Cards were encrypted on-chain 🔐")
    elif phase == 5:
        print(f"\n⏳ Showdown in progress (CTX pending)")
    else:
        print(f"\n⚠️  Game stopped at phase {PHASES[phase]}")

if __name__ == "__main__":
    main()
