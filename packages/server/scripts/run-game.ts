import { createWalletClient, http, parseEther, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient } from 'viem';

const PHASES = ['Waiting', 'Preflop', 'Flop', 'Turn', 'River', 'Showdown'];

interface Player {
  name: string;
  address: string;
  private_key: string;
  viewer_x: string;
  viewer_y: string;
}

interface NetworkConfig {
  name: string;
  rpc: string;
  explorer: string;
  gas_limit: number;
  ctx_gas_limit: number;
  ctx_value: string;
  token_decimals: number;
  buy_in: number;
}

const NETWORKS: Record<string, NetworkConfig> = {
  'base-sepolia': {
    name: 'SKALE Base Sepolia',
    rpc: 'https://base-sepolia-testnet.skalenodes.com/v1/base-testnet',
    explorer: 'https://base-sepolia-testnet-explorer.skalenodes.com/',
    gas_limit: 5000000,
    ctx_gas_limit: 30000000,
    ctx_value: '1000000000000000',
    token_decimals: 18,
    buy_in: 1000,
  },
  sandbox: {
    name: 'BITE V2 Sandbox 2',
    rpc: 'https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox',
    explorer: 'https://base-sepolia-testnet-explorer.skalenodes.com:10032/',
    gas_limit: 5000000,
    ctx_gas_limit: 30000000,
    ctx_value: '1000000000000000',
    token_decimals: 6,
    buy_in: 1000,
  },
};

const POKER_CONTRACT = '0x0D5d9697bda657c1ba2D1882dcF7BB20903D3aDC';
const MOCK_SKL = '0x4C1928684B7028C2805FA1d12aCEd5c839A8D42C';

async function loadData(): Promise<{ agent: Player; bots: Player[] }> {
  const fs = await import('fs/promises');
  const data = JSON.parse(await fs.readFile('./poker-deploy.json', 'utf-8'));
  return data;
}

async function sendTx(
  client: ReturnType<typeof createPublicClient>,
  wallet: ReturnType<typeof createWalletClient>,
  to: string,
  sig: string,
  args: (string | number | bigint)[] = [],
  value?: bigint,
  gasLimit?: number
): Promise<{ txHash: string | null; error: string | null }> {
  const chain = wallet.chain!;
  try {
    const request = await wallet.prepareTransactionRequest({
      to,
      args: sig ? args : undefined,
      value,
      gas: gasLimit ? BigInt(gasLimit) : undefined,
    });
    
    const hash = await wallet.sendTransaction(request);
    return { txHash: hash, error: null };
  } catch (err: any) {
    return { txHash: null, error: err.message?.slice(0, 400) || 'Unknown error' };
  }
}

function cardName(c: number): string {
  if (c === 0) return '??';
  const rank = c & 0x0f;
  const suit = (c >> 4) & 0x03;
  const r = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }.get(rank, String(rank));
  const s = ['♣', '♦', '♥', '♠'][suit];
  return `${r}${s}`;
}

async function runBettingRound(
  publicClient: ReturnType<typeof createPublicClient>,
  wallet: ReturnType<typeof createWalletClient>,
  contract: string,
  players: Player[],
  tokenDecimals: number,
  maxIters: number = 30
): Promise<string> {
  for (let i = 0; i < maxIters; i++) {
    const phase = await publicClient.readContract({
      address: contract as `0x${string}`,
      abi: pokerAbi,
      functionName: 'phase',
    }) as number;

    if (phase === 0) return 'complete';
    if (phase === 5) return 'showdown';

    const turn = await publicClient.readContract({
      address: contract as `0x${string}`,
      abi: pokerAbi,
      functionName: 'getCurrentTurnIndex',
    }) as bigint;

    if (turn >= (1n << 256n) - 2n) return 'round_done';

    const cBet = (await publicClient.readContract({
      address: contract as `0x${string}`,
      abi: pokerAbi,
      functionName: 'currentBet',
    })) as bigint;

    const playerInfo = await publicClient.readContract({
      address: contract as `0x${string}`,
      abi: pokerAbi,
      functionName: 'getPlayerInfo',
      args: [turn],
    }) as [string, boolean, boolean, bigint, boolean, bigint];

    const [addr, active, acted, bet, allIn, stack] = playerInfo;
    const player = players.find(p => p.address.toLowerCase() === addr.toLowerCase());
    
    if (!player || !active || allIn) {
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    const toCall = cBet - bet;
    const toCallHuman = Number(toCall) / Math.pow(10, tokenDecimals);
    const stackHuman = Number(stack) / Math.pow(10, tokenDecimals);

    console.log(`\n  🃏 ${player.name}'s turn (bet=${Number(bet) / Math.pow(10, tokenDecimals)}/${Number(cBet) / Math.pow(10, tokenDecimals)}, stack=${stackHuman}, to_call=${toCallHuman})`);

    const account = privateKeyToAccount(player.private_key as `0x${string}`);
    const playerWallet = createWalletClient({
      account,
      chain: wallet.chain,
      transport: http(wallet.chain?.rpcUrls.public?.[0] || ''),
    });

    let action: string;
    let args: any[] = [];
    const rand = Math.random();

    if (toCall === 0n) {
      if (rand < 0.55) {
        action = 'check';
        console.log('    → Check ✓');
      } else if (rand < 0.85) {
        action = 'raise';
        const raiseUnit = 5n * BigInt(10 ** tokenDecimals);
        const raiseAmt = [1, 2, 3, 5, 10][Math.floor(Math.random() * 5)] * raiseUnit;
        args = [raiseAmt];
        console.log(`    → Raise +${Number(raiseAmt) / Math.pow(10, tokenDecimals)} 🔥`);
      } else {
        action = 'check';
        console.log('    → Check ✓');
      }
    } else {
      const canAfford = stack >= toCall;
      if (!canAfford) {
        if (stack > 0 && rand < 0.7) {
          action = 'call';
          console.log(`    → Call ALL-IN ${stackHuman} 💰`);
        } else {
          action = 'fold';
          console.log('    → Fold 🏳️');
        }
      } else if (toCall > 100n * BigInt(10 ** tokenDecimals) && rand < 0.25) {
        action = 'fold';
        console.log('    → Fold 🏳️ (too expensive)');
      } else if (rand < 0.8) {
        action = 'call';
        console.log(`    → Call ${toCallHuman} ✓`);
      } else {
        action = 'raise';
        const raiseUnit = 5n * BigInt(10 ** tokenDecimals);
        const raiseAmt = [1, 2, 5][Math.floor(Math.random() * 3)] * raiseUnit;
        const total = toCall + raiseAmt;
        if (total <= stack) {
          args = [raiseAmt];
          console.log(`    → Raise +${Number(raiseAmt) / Math.pow(10, tokenDecimals)} (total ${Number(total) / Math.pow(10, tokenDecimals)}) 🔥`);
        } else {
          action = 'call';
          console.log(`    → Call ${toCallHuman} ✓`);
        }
      }
    }

    try {
      const tx = await playerWallet.writeContract({
        address: contract as `0x${string}`,
        abi: pokerAbi,
        functionName: action as any,
        args: args.length > 0 ? args : undefined,
      });
      console.log(`    TX: ${tx.slice(0, 20)}...`);
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.log(`    ❌ ${err.message?.slice(0, 120)}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return 'max_iters';
}

const pokerAbi = [
  'function phase() view returns (uint8)',
  'function playerCount() view returns (uint256)',
  'function handNumber() view returns (uint256)',
  'function dealer() view returns (address)',
  'function pot() view returns (uint256)',
  'function currentBet() view returns (uint256)',
  'function getCurrentTurnIndex() view returns (uint256)',
  'function activePlayerCount() view returns (uint256)',
  'function getPlayerInfo(uint256) view returns (address,bool,bool,uint256,bool,uint256)',
  'function getCommunityCards() view returns (uint8[5])',
  'function sitDown((bytes32,bytes32))',
  'function dealNewHand()',
  'function dealFlop()',
  'function dealTurn()',
  'function dealRiver()',
  'function revealCards()',
  'function resolveHand()',
] as const;

async function main() {
  const networkName = process.argv[2] || 'base-sepolia';
  if (!(networkName in NETWORKS)) {
    console.log(`❌ Unknown network: ${networkName}`);
    console.log(`   Available: ${Object.keys(NETWORKS).join(', ')}`);
    process.exit(1);
  }

  const cfg = NETWORKS[networkName];
  const data = await loadData();
  const agent = data.agent;
  const bots = data.bots;

  const allPlayers: Player[] = [
    { name: '🤖 Agent', address: agent.address, private_key: agent.private_key, viewer_x: agent.viewer_x, viewer_y: agent.viewer_y },
    ...bots.map(b => ({ name: `🃏 ${b.name}`, ...b })),
  ];

  const agentAccount = privateKeyToAccount(agent.private_key as `0x${string}`);
  const wallet = createWalletClient({
    account: agentAccount,
    chain: {
      id: 18181,
      name: 'SKALE',
      nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
      rpcUrls: { public: [cfg.rpc], default: [cfg.rpc] },
    },
    transport: http(cfg.rpc),
  });

  const publicClient = createPublicClient({
    chain: {
      id: 18181,
      name: 'SKALE',
      nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
      rpcUrls: { public: [cfg.rpc], default: [cfg.rpc] },
    },
    transport: http(cfg.rpc),
  });

  console.log('='.repeat(60));
  console.log(`🃏  CONFIDENTIAL POKER — ${cfg.name} (BITE)  🃏`);
  console.log('='.repeat(60));
  console.log(`Contract: ${POKER_CONTRACT}`);
  console.log(`Token:    ${MOCK_SKL}`);
  console.log(`Buy-in:   ${cfg.buy_in}`);
  console.log(`Players: ${allPlayers.length}`);
  for (const p of allPlayers) {
    console.log(`  ${p.name}: ${p.address}`);
  }
  console.log();

  // Check current state
  const phase = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'phase',
  }) as number;
  const pc = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'playerCount',
  }) as bigint;

  console.log(`Current: phase=${PHASES[phase]}, players=${pc}`);

  // Seat players
  console.log('\n━━━ Seating players ━━━');
  for (const p of allPlayers) {
    try {
      await wallet.writeContract({
        address: POKER_CONTRACT as `0x${string}`,
        abi: pokerAbi,
        functionName: 'sitDown',
        args: [{ x: p.viewer_x as `0x${string}`, y: p.viewer_y as `0x${string}` }],
        account: privateKeyToAccount(p.private_key as `0x${string}`),
      });
      console.log(`  ✅ ${p.name} sat down`);
    } catch (err: any) {
      if (err.message?.includes('already')) {
        console.log(`  ⏭️ ${p.name}: already seated`);
      } else {
        console.log(`  ❌ ${p.name}: ${err.message?.slice(0, 100)}`);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Deal new hand if game is waiting
  const phase2 = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'phase',
  }) as number;
  const pc2 = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'playerCount',
  }) as bigint;

  if (phase2 === 0 && pc2 >= 2) {
    console.log('\n━━━ Dealing new hand ━━━');
    try {
      await wallet.writeContract({
        address: POKER_CONTRACT as `0x${string}`,
        abi: pokerAbi,
        functionName: 'dealNewHand',
      });
      console.log('  ✅ New hand dealt!');
    } catch (err: any) {
      console.log(`  ❌ ${err.message?.slice(0, 150)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Preflop betting
  const phase3 = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'phase',
  }) as number;
  
  if (phase3 === 1) {
    console.log('\n━━━ PREFLOP BETTING ━━━');
    await runBettingRound(publicClient, wallet, POKER_CONTRACT, allPlayers, cfg.token_decimals);
  }

  // Flop
  const phase4 = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'phase',
  }) as number;
  const turnIdx = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'getCurrentTurnIndex',
  }) as bigint;

  if (phase4 === 1 && turnIdx >= (1n << 256n) - 2n) {
    console.log('\n━━━ DEALING FLOP ━━━');
    try {
      await wallet.writeContract({
        address: POKER_CONTRACT as `0x${string}`,
        abi: pokerAbi,
        functionName: 'dealFlop',
      });
      console.log('  ✅ Flop dealt!');
    } catch (err: any) {
      console.log(`  ❌ ${err.message?.slice(0, 150)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  const phase5 = await publicClient.readContract({
    address: POKER_CONTRACT as `0x${string}`,
    abi: pokerAbi,
    functionName: 'phase',
  }) as number;
  if (phase5 === 2) {
    console.log('\n━━━ FLOP BETTING ━━━');
    await runBettingRound(publicClient, wallet, POKER_CONTRACT, allPlayers, cfg.token_decimals);
  }

  console.log('\n✅ Game script complete!');
}

main().catch(console.error);