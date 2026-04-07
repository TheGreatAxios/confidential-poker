#!/usr/bin/env python3
"""
Full poker game — supports SKALE Base Sepolia and BITE V2 Sandbox 2.
Usage:
  python3 run-game.py              # default: base-sepolia
  python3 run-game.py sandbox      # BITE V2 Sandbox 2 (CTX enabled)

6 players (1 agent + 5 bots), ERC-20 buy-in/betting, BITE-encrypted cards.
Cards are PRIVATE — not visible until showdown (CTX decryption).
"""
import json, subprocess, sys, time, random
from pathlib import Path

CAST = "/data/.foundry/bin/cast"

NETWORKS = {
    "base-sepolia": {
        "name": "SKALE Base Sepolia",
        "rpc": "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
        "explorer": "https://base-sepolia-testnet-explorer.skalenodes.com/",
        "gas_limit": 5000000,
        "ctx_gas_limit": 30000000,
        "ctx_value": "1000000000000000",
        "token_decimals": 18,
        "buy_in": 1000,
    },
    "sandbox": {
        "name": "BITE V2 Sandbox 2",
        "rpc": "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox",
        "explorer": "https://base-sepolia-testnet-explorer.skalenodes.com:10032/",
        "gas_limit": 5000000,
        "ctx_gas_limit": 30000000,
        "ctx_value": "1000000000000000",
        "token_decimals": 6,
        "buy_in": 1000,
    },
}

DEFAULT_POKER_CONTRACT = "0x0D5d9697bda657c1ba2D1882dcF7BB20903D3aDC"
DEFAULT_MOCK_SKL = "0x4C1928684B7028C2805FA1d12aCEd5c839A8D42C"

def load_data():
    return json.loads(Path("/data/.nanobot/persistent/scratchpad/poker-deploy.json").read_text())

def send_tx(to, sig, args, from_key, value=None, gas_limit=None):
    """Send a transaction, return (tx_hash, error)."""
    gl = str(gas_limit) if gas_limit else str(NETWORK_CFG["gas_limit"])
    cmd = [CAST, "send", to]
    if sig:
        cmd += [sig] + [str(a) for a in args]
    cmd += ["--rpc-url", RPC, "--legacy", "--private-key", from_key, "--gas-limit", gl]
    if value:
        cmd += ["--value", str(value)]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        return None, result.stderr.strip()[:500]
    combined = result.stdout + "\n" + result.stderr
    tx_hash = None
    for line in combined.split('\n'):
        line = line.strip()
        if "transactionHash" in line.lower() or "transaction" in line.lower():
            parts = line.split()
            for part in parts:
                part = part.strip()
                if part.startswith("0x") and len(part) == 66:
                    tx_hash = part
                    break
            if tx_hash:
                break
    if not tx_hash:
        for line in combined.split('\n'):
            line = line.strip()
            if line.startswith("0x") and len(line) == 66:
                tx_hash = line
    if not tx_hash:
        if "revert" in combined.lower() or "status" in combined.lower():
            for line in combined.split('\n'):
                if "status" in line.lower() and "0" in line:
                    return None, f"TX reverted: {combined[:300]}"
        return None, f"Could not parse tx hash from output: {combined[:200]}"
    return tx_hash, None

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
        s = hex_str.strip()
        # Strip trailing bracket notation like "44000000000 [4.4e10]"
        if '[' in s:
            s = s.split('[')[0].strip()
        # Try decimal first (sandbox returns decimal format)
        try:
            return int(s)
        except ValueError:
            pass
        # Then try hex
        return int(s, 16)
    except:
        return None

def to_addr(hex_str):
    if hex_str is None:
        return "0x0"
    s = hex_str.strip()
    if '[' in s:
        s = s.split('[')[0].strip()
    try:
        n = int(s)
        return "0x" + hex(n)[2:].zfill(40)
    except:
        # Fallback: try to extract from string
        return s

PHASES = ["Waiting", "Preflop", "Flop", "Turn", "River", "Showdown"]

def card_name(c):
    if c == 0: return "??"
    rank = c & 0x0F
    suit = (c >> 4) & 0x03
    r = {11:'J', 12:'Q', 13:'K', 14:'A'}.get(rank, str(rank))
    s = ['♣','♦','♥','♠'][suit]
    return f"{r}{s}"

def main():
    global RPC, NETWORK_CFG
    
    network_name = sys.argv[1] if len(sys.argv) > 1 else "base-sepolia"
    if network_name not in NETWORKS:
        print(f"❌ Unknown network: {network_name}")
        print(f"   Available: {', '.join(NETWORKS.keys())}")
        sys.exit(1)
    
    NETWORK_CFG = NETWORKS[network_name]
    RPC = NETWORK_CFG["rpc"]
    
    data = load_data()
    net_data = data.get("networks", {}).get(network_name, {})
    
    CONTRACT = net_data.get("contract", data.get("contract", DEFAULT_POKER_CONTRACT))
    
    TOKEN_DECIMALS = NETWORK_CFG["token_decimals"]
    BUY_IN = NETWORK_CFG["buy_in"]
    BUY_IN_WEI = str(BUY_IN * 10**TOKEN_DECIMALS)
    
    if network_name == "sandbox" and net_data.get("usdc"):
        TOKEN_ADDR = net_data["usdc"]
        TOKEN_SYM = "USDC"
    else:
        TOKEN_ADDR = net_data.get("mock_skl", data.get("mock_skl", DEFAULT_MOCK_SKL))
        TOKEN_SYM = "MockSKL"
    
    agent = data["agent"]
    bots = data["bots"]
    AGENT_KEY = agent["private_key"]
    
    all_players = [{"name": "🤖 Batshit", "address": agent["address"], "private_key": AGENT_KEY, 
                    "viewer_x": agent.get("viewer_x", "0x" + "19" * 32), "viewer_y": agent.get("viewer_y", "0x" + "ee" * 32)}]
    all_players += [{"name": f"🃏 {b['name']}", "address": b["address"], "private_key": b["private_key"],
                     "viewer_x": b.get("viewer_x", "0x" + "00" * 32), "viewer_y": b.get("viewer_y", "0x" + "00" * 32)} 
                    for b in bots]
    
    EXPLORER = NETWORK_CFG["explorer"]
    
    print("=" * 60)
    print(f"🃏  CONFIDENTIAL POKER — {NETWORK_CFG['name']} (BITE)  🃏")
    print("=" * 60)
    print(f"Contract: {CONTRACT}")
    print(f"Token:    {TOKEN_ADDR} ({TOKEN_SYM}, {TOKEN_DECIMALS} decimals)")
    print(f"Buy-in:   {BUY_IN} {TOKEN_SYM}")
    print(f"Explorer: {EXPLORER}address/{CONTRACT}")
    print(f"Players: {len(all_players)}")
    for p in all_players:
        print(f"  {p['name']}: {p['address']}")
    print()
    
    # ─── FUND BOT WALLETS (ETH for gas) ───
    print("━━━ Funding bot wallets (ETH for gas) ━━━")
    FUND = "30000000000000000"  # 0.03 ETH each
    MIN_BAL = "10000000000000000"  # 0.01 ETH threshold
    for bot in bots:
        bal = subprocess.run([CAST, "balance", bot["address"], "--rpc-url", RPC],
                           capture_output=True, text=True).stdout.strip()
        if bal and int(bal, 16) > int(MIN_BAL, 16):
            eth = int(bal, 16) / 1e18
            print(f"  ⏭️ {bot['name']}: {eth:.4f} ETH (sufficient)")
        else:
            _, err = send_tx(bot["address"], "", [], AGENT_KEY, value=FUND)
            if err:
                print(f"  ❌ {bot['name']}: {err[:100]}")
            else:
                print(f"  ✅ {bot['name']} funded with ETH")
            time.sleep(0.3)
    
    # ─── DISTRIBUTING TOKENS ───
    print(f"\n━━━ Distributing {TOKEN_SYM} tokens ━━━")
    for p in all_players:
        if p["address"].lower() == agent["address"].lower():
            continue
        bal = read_contract(TOKEN_ADDR, "balanceOf(address)(uint256)", [p["address"]])
        bal_int = to_int(bal) if bal else 0
        if bal_int and bal_int >= BUY_IN * 10**TOKEN_DECIMALS:
            human = bal_int // 10**TOKEN_DECIMALS
            print(f"  ⏭️ {p['name']}: {human} {TOKEN_SYM} (sufficient)")
            continue
        print(f"  📤 Sending {BUY_IN} {TOKEN_SYM} to {p['name']}...")
        tx, err = send_tx(TOKEN_ADDR, "transfer(address,uint256)", [p["address"], BUY_IN_WEI], AGENT_KEY)
        if err:
            print(f"  ❌ {p['name']}: {err[:150]}")
            # Try faucet as fallback (MockSKL only)
            if TOKEN_SYM != "USDC":
                print(f"  🔄 Trying faucet for {p['name']}...")
                tx, err = send_tx(TOKEN_ADDR, "faucet()", [], p["private_key"])
                if err:
                    print(f"  ❌ Faucet failed: {err[:100]}")
                else:
                    print(f"  ✅ {p['name']} got tokens from faucet")
        else:
            print(f"  ✅ {p['name']} received {BUY_IN} {TOKEN_SYM}")
        time.sleep(0.3)
    
    print(f"\n  {TOKEN_SYM} Balances:")
    for p in all_players:
        bal = read_contract(TOKEN_ADDR, "balanceOf(address)(uint256)", [p["address"]])
        bal_int = to_int(bal) if bal else 0
        human = bal_int // 10**TOKEN_DECIMALS if bal_int else 0
        print(f"    {p['name']}: {human} {TOKEN_SYM}")
    
    # ─── APPROVE ERC-20 ───
    print(f"\n━━━ Approving {TOKEN_SYM} spend ━━━")
    for p in all_players:
        allowance = read_contract(TOKEN_ADDR, "allowance(address,address)(uint256)", [p["address"], CONTRACT])
        allowance_int = to_int(allowance) if allowance else 0
        if allowance_int and allowance_int >= BUY_IN * 10**TOKEN_DECIMALS:
            print(f"  ⏭️ {p['name']}: already approved")
            continue
        tx, err = send_tx(TOKEN_ADDR, "approve(address,uint256)", [CONTRACT, BUY_IN_WEI], p["private_key"])
        if err:
            print(f"  ❌ {p['name']}: {err[:150]}")
        else:
            print(f"  ✅ {p['name']} approved contract to spend {BUY_IN} {TOKEN_SYM}")
        time.sleep(0.3)
    
    # ─── SIT DOWN ───
    print(f"\n━━━ Seating players (BUY_IN={BUY_IN} {TOKEN_SYM}) ━━━")
    seated = set()
    pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
    if pc:
        for i in range(pc):
            addr = read_contract(CONTRACT, "getPlayerAddress(uint256)(address)", [i])
            if addr and int(addr, 16) != 0:
                seated.add(addr.lower())
                for p in all_players:
                    if p["address"].lower() == addr.lower():
                        print(f"  ✅ {p['name']} already seated")
                        break
    
    unseated = [p for p in all_players if p["address"].lower() not in seated]
    
    if unseated:
        print(f"\n  {len(unseated)} players need to sit down...")
        for p in unseated:
            viewer_key = f"({p['viewer_x']},{p['viewer_y']})"
            tx, err = send_tx(CONTRACT, "sitDown((bytes32,bytes32))", [viewer_key], p["private_key"])
            if err:
                if "already" in err.lower() or "joined" in err.lower():
                    print(f"  ⏭️ {p['name']}: already seated")
                elif "Game not waiting" in err:
                    print(f"  ⏳ Game started, skipping {p['name']}")
                else:
                    print(f"  ❌ {p['name']}: {err[:200]}")
            else:
                print(f"  ✅ {p['name']} sat down")
            time.sleep(0.3)
    else:
        print(f"\n  All players already seated!")
    
    # ─── DEAL NEW HAND (30s window) ───
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
    
    if phase == 0 and pc and pc >= 2:
        SEAT_WINDOW = 30
        print(f"\n⏱️  {SEAT_WINDOW}s seating window — waiting for all players...")
        for sec in range(SEAT_WINDOW, 0, -1):
            pc_now = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
            if sec % 5 == 0 or sec <= 3:
                print(f"  {sec}s... ({pc_now} seated)")
            time.sleep(1)
        
        print(f"\n━━━ Dealing new hand ━━━")
        tx, err = send_tx(CONTRACT, "dealNewHand()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:150]}")
        else:
            print(f"  ✅ New hand dealt!")
        time.sleep(1)
    
    # ─── GAME STATE ━━━
    print(f"\n━━━ Game State ━━━")
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    pc = to_int(read_contract(CONTRACT, "playerCount()(uint256)"))
    hand = to_int(read_contract(CONTRACT, "handNumber()(uint256)"))
    dealer = to_addr(read_contract(CONTRACT, "dealer()(address)"))
    pot = to_int(read_contract(CONTRACT, "pot()(uint256)"))
    cBet = to_int(read_contract(CONTRACT, "currentBet()(uint256)"))
    turn = to_int(read_contract(CONTRACT, "getCurrentTurnIndex()(uint256)"))
    
    pot_human = pot // 10**TOKEN_DECIMALS if pot else 0
    cbet_human = cBet // 10**TOKEN_DECIMALS if cBet else 0
    
    print(f"  Phase: {PHASES[phase]}")
    print(f"  Players: {pc}  Hand: #{hand}")
    print(f"  Dealer: {dealer}")
    print(f"  Pot: {pot_human} {TOKEN_SYM}  Current Bet: {cbet_human} {TOKEN_SYM}  Turn: {turn}")
    
    print(f"\n  📋 Players (cards encrypted 🔒):")
    for i in range(pc or 0):
        info = read_contract(CONTRACT, "getPlayerInfo(uint256)(address,bool,bool,uint256,bool,uint256)", [i])
        if info:
            parts = info.split('\n')
            addr = parts[0].strip()
            active = parts[1].strip() == "true" if len(parts) > 1 else True
            acted = parts[2].strip() == "true" if len(parts) > 2 else False
            bet = to_int(parts[3].strip()) if len(parts) > 3 else 0
            all_in = parts[4].strip() == "true" if len(parts) > 4 else False
            stack = to_int(parts[5].strip()) if len(parts) > 5 else 0
            player_name = addr
            for p in all_players:
                if p["address"].lower() == addr.lower():
                    player_name = p["name"]
                    break
            status = ""
            if not active: status = " [FOLDED]"
            elif all_in: status = " [ALL-IN]"
            elif acted: status = " [ACTED]"
            bet_h = bet // 10**TOKEN_DECIMALS if bet else 0
            stack_h = stack // 10**TOKEN_DECIMALS if stack else 0
            print(f"    {player_name}: stack={stack_h} {TOKEN_SYM} bet={bet_h} {TOKEN_SYM}{status}")
    
    # ─── RUN BETTING ROUND ━━━
    def run_betting(phase_name, max_iters=30):
        for _ in range(max_iters):
            phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
            if phase == 0:
                return "complete"
            if phase == 5:
                return "showdown"
            
            turn = to_int(read_contract(CONTRACT, "getCurrentTurnIndex()(uint256)"))
            if turn is None or turn >= (2**256 - 2):
                return "round_done"
            
            cBet = to_int(read_contract(CONTRACT, "currentBet()(uint256)")) or 0
            
            info = read_contract(CONTRACT, "getPlayerInfo(uint256)(address,bool,bool,uint256,bool,uint256)", [turn])
            if not info:
                time.sleep(0.5)
                continue
            
            parts = info.split('\n')
            p_addr = parts[0].strip()
            p_active = parts[1].strip() == "true" if len(parts) > 1 else True
            p_acted = parts[2].strip() == "true" if len(parts) > 2 else False
            p_bet = to_int(parts[3].strip()) if len(parts) > 3 else 0
            p_allin = parts[4].strip() == "true" if len(parts) > 4 else False
            p_stack = to_int(parts[5].strip()) if len(parts) > 5 else 0
            
            if not p_active or p_allin:
                time.sleep(0.3)
                continue
            
            player = None
            for p in all_players:
                if p["address"].lower() == p_addr.lower():
                    player = p
                    break
            if not player:
                time.sleep(0.5)
                continue
            
            to_call = cBet - p_bet
            to_call_h = to_call // 10**TOKEN_DECIMALS if to_call else 0
            p_bet_h = p_bet // 10**TOKEN_DECIMALS if p_bet else 0
            p_stack_h = p_stack // 10**TOKEN_DECIMALS if p_stack else 0
            
            print(f"\n  🃏 {player['name']}'s turn (bet={p_bet_h}/{cBet // 10**TOKEN_DECIMALS if cBet else 0}, stack={p_stack_h}, to_call={to_call_h})")
            
            # Raise amounts in USDC units (need to multiply back by 10^decimals for contract)
            raise_unit = 5 * 10**TOKEN_DECIMALS  # 5 USDC per raise unit
            
            if to_call == 0:
                r = random.random()
                if r < 0.55:
                    action, args = "check()", []
                    print(f"    → Check ✓")
                elif r < 0.85:
                    raise_amt = random.choice([1, 2, 3, 5, 10]) * raise_unit
                    action, args = "raise(uint256)", [str(raise_amt)]
                    print(f"    → Raise +{raise_amt // 10**TOKEN_DECIMALS} {TOKEN_SYM} 🔥")
                else:
                    action, args = "check()", []
                    print(f"    → Check ✓")
            else:
                r = random.random()
                can_afford = p_stack >= to_call
                if not can_afford:
                    if p_stack > 0 and r < 0.7:
                        action, args = "call()", []
                        print(f"    → Call ALL-IN {p_stack_h} {TOKEN_SYM} 💰")
                    else:
                        action, args = "fold()", []
                        print(f"    → Fold 🏳️")
                elif to_call > 100 * raise_unit and r < 0.25:
                    action, args = "fold()", []
                    print(f"    → Fold 🏳️ (too expensive)")
                elif r < 0.8:
                    action, args = "call()", []
                    print(f"    → Call {to_call_h} {TOKEN_SYM} ✓")
                else:
                    raise_amt = random.choice([1, 2, 5]) * raise_unit
                    total = to_call + raise_amt
                    if total <= p_stack:
                        action, args = "raise(uint256)", [str(raise_amt)]
                        print(f"    → Raise +{raise_amt // 10**TOKEN_DECIMALS} {TOKEN_SYM} (total {(to_call + raise_amt) // 10**TOKEN_DECIMALS}) 🔥")
                    else:
                        action, args = "call()", []
                        print(f"    → Call {to_call_h} {TOKEN_SYM} ✓")
            
            tx, err = send_tx(CONTRACT, action, args, player["private_key"])
            if err:
                print(f"    ❌ {err[:120]}")
                time.sleep(1)
            else:
                time.sleep(0.3)
        
        return "max_iters"
    
    def is_round_done():
        turn = to_int(read_contract(CONTRACT, "getCurrentTurnIndex()(uint256)"))
        if turn is None or turn >= (2**256 - 2):
            return True
        apc = to_int(read_contract(CONTRACT, "activePlayerCount()(uint256)"))
        if apc and apc <= 1:
            return True
        return False
    
    # ─── PREFLOP ━━━
    print(f"\n━━━ PREFLOP BETTING ━━━")
    result = run_betting("Preflop")
    
    # ─── FLOP ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 1 and is_round_done():
        print(f"\n━━━ DEALING FLOP ━━━")
        tx, err = send_tx(CONTRACT, "dealFlop()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:150]}")
        else:
            time.sleep(1)
            cc = read_contract(CONTRACT, "getCommunityCards()(uint8,uint8,uint8,uint8,uint8)")
            if cc:
                cards = [to_int(c) for c in cc.split('\n')]
                print(f"  🃏 Flop: {card_name(cards[0])} {card_name(cards[1])} {card_name(cards[2])}")
    
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 2:
        print(f"\n━━━ FLOP BETTING ━━━")
        run_betting("Flop")
    
    # ─── TURN ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 2 and is_round_done():
        print(f"\n━━━ DEALING TURN ━━━")
        tx, err = send_tx(CONTRACT, "dealTurn()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:150]}")
        else:
            time.sleep(1)
            cc = read_contract(CONTRACT, "getCommunityCards()(uint8,uint8,uint8,uint8,uint8)")
            if cc:
                cards = [to_int(c) for c in cc.split('\n')]
                print(f"  🃏 Turn: {card_name(cards[0])} {card_name(cards[1])} {card_name(cards[2])} {card_name(cards[3])}")
    
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 3:
        print(f"\n━━━ TURN BETTING ━━━")
        run_betting("Turn")
    
    # ─── RIVER ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 3 and is_round_done():
        print(f"\n━━━ DEALING RIVER ━━━")
        tx, err = send_tx(CONTRACT, "dealRiver()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:150]}")
        else:
            time.sleep(1)
            cc = read_contract(CONTRACT, "getCommunityCards()(uint8,uint8,uint8,uint8,uint8)")
            if cc:
                cards = [to_int(c) for c in cc.split('\n')]
                print(f"  🃏 River: {card_name(cards[0])} {card_name(cards[1])} {card_name(cards[2])} {card_name(cards[3])} {card_name(cards[4])}")
    
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    if phase == 4:
        print(f"\n━━━ RIVER BETTING ━━━")
        run_betting("River")
    
    # ─── SHOWDOWN ━━━
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    apc = to_int(read_contract(CONTRACT, "activePlayerCount()(uint256)"))
    
    if phase == 4 and apc and apc <= 1:
        print(f"\n━━━ 🏆 ONLY ONE PLAYER LEFT — RESOLVING 🏆 ━━━")
        tx, err = send_tx(CONTRACT, "resolveHand()", [], AGENT_KEY)
        if err:
            print(f"  ❌ {err[:200]}")
        else:
            print(f"  ✅ Hand resolved!")
    elif phase == 4 and apc and apc > 1:
        print(f"\n━━━ 🏆 SHOWDOWN — {apc} active players 🏆 ━━━")
        print(f"  🔐 Initiating BITE CTX card reveal...")
        CTX_VALUE = int(NETWORK_CFG["ctx_value"])
        CTX_GAS = NETWORK_CFG["ctx_gas_limit"]
        tx, err = send_tx(CONTRACT, "revealCards()", [], AGENT_KEY, 
                         value=CTX_VALUE, gas_limit=CTX_GAS)
        if err:
            print(f"  ❌ revealCards failed: {err[:300]}")
        else:
            print(f"  ✅ CTX submitted! TX: {tx}")
            print(f"  ⏳ Waiting for BITE decryption callback (onDecrypt)...")
            for wait in range(60):
                time.sleep(1)
                phase_now = to_int(read_contract(CONTRACT, "phase()(uint8)"))
                if phase_now == 0:
                    print(f"  ✅ Cards decrypted and hand resolved! ({wait+1}s)")
                    break
                if wait % 3 == 0:
                    print(f"  ⏳ Waiting for CTX callback... ({wait+1}s)")
            else:
                print(f"  ⚠️ CTX callback not received after 60s")
    elif phase == 4:
        print(f"\n⚠️ At river but no active players to showdown")
    
    # ─── FINAL STATE ━━━
    print(f"\n{'=' * 60}")
    phase = to_int(read_contract(CONTRACT, "phase()(uint8)"))
    hand = to_int(read_contract(CONTRACT, "handNumber()(uint256)"))
    pot = to_int(read_contract(CONTRACT, "pot()(uint256)"))
    pot_h = pot // 10**TOKEN_DECIMALS if pot else 0
    
    print(f"  Phase: {PHASES[phase]}")
    print(f"  Hand: #{hand}  Pot: {pot_h} {TOKEN_SYM}")
    print(f"  Contract: {CONTRACT}")
    print(f"  Explorer: {EXPLORER}address/{CONTRACT}")
    print(f"\n✅ Game complete!")

if __name__ == "__main__":
    main()
