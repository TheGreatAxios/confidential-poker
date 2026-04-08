import { createWalletClient, http, createPublicClient, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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

const pokerAbi = [
  { name: 'phase', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'playerCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'handNumber', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'dealer', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'pot', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'currentBet', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getCurrentTurnIndex', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'activePlayerCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getPlayerInfo', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'address' }, { name: '', type: 'bool' }, { name: '', type: 'bool' }, { name: '', type: 'uint256' }, { name: '', type: 'bool' }, { name: '', type: 'uint256' }] },
  { name: 'getCommunityCards', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8[5]' }] },
  { name: 'sitDown', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'viewerKey', type: 'tuple', components: [{ name: 'x', type: 'bytes32' }, { name: 'y', type: 'bytes32' }] }], outputs: [] },
  { name: 'dealNewHand', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'dealFlop', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'dealTurn', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'dealRiver', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'revealCards', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'resolveHand', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

async function loadData(): Promise<{ agent: Player; bots: Player[] }> {
  const fs = await import('fs/promises');
  const data = JSON.parse(await fs.readFile('./poker-deploy.json', 'utf-8'));
  return data;
}

function cardName(c: number): string {
  if (c === 0) return '??';
  const rank = c & 0x0f;
  const suit = (c >> 4) & 0x03;
  const r = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }.get(rank, String(rank));
  const s = ['♣', '♦', '♥', '♠'][suit];
  return `${r}${s}`;
}

function formatAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

class AgentLoop {
  private wallet: ReturnType<typeof createWalletClient>;
  private publicClient: ReturnType<typeof createPublicClient>;
  private agent: Player;
  private bots: Player[];
  private allPlayers: Player[];
  private cfg: NetworkConfig;
  private contract: string;
  private running: boolean = true;
  private handCount: number = 0;

  constructor(cfg: NetworkConfig, agent: Player, bots: Player[]) {
    this.cfg = cfg;
    this.agent = agent;
    this.bots = bots;
    this.contract = POKER_CONTRACT;

    this.allPlayers = [
      { name: '🤖 Agent', ...agent },
      ...bots.map(b => ({ name: `🃏 ${b.name}`, ...b })),
    ];

    const account = privateKeyToAccount(agent.private_key as `0x${string}`);
    const chain = {
      id: 18181,
      name: 'SKALE',
      nativeCurrency: { name: 'sFUEL', symbol: 'sFUEL', decimals: 18 },
      rpcUrls: { public: [cfg.rpc], default: [cfg.rpc] },
    };

    this.wallet = createWalletClient({
      account,
      chain,
      transport: http(cfg.rpc),
    });

    this.publicClient = createPublicClient({
      chain,
      transport: http(cfg.rpc),
    });
  }

  private async read<T>(fn: string, args?: any[]): Promise<T> {
    return this.publicClient.readContract({
      address: this.contract as `0x${string}`,
      abi: pokerAbi as any,
      functionName: fn as any,
      args,
    }) as Promise<T>;
  }

  private async write(fn: string, args?: any[], value?: bigint, gas?: number): Promise<string> {
    const account = privateKeyToAccount(this.agent.private_key as `0x${string}`);
    const wallet = createWalletClient({
      account,
      chain: this.wallet.chain!,
      transport: http(this.wallet.chain!.rpcUrls.public?.[0] || ''),
    });

    try {
      const tx = await wallet.writeContract({
        address: this.contract as `0x${string}`,
        abi: pokerAbi as any,
        functionName: fn as any,
        args,
        value,
        gas: gas ? BigInt(gas) : undefined,
      });
      return tx;
    } catch (err: any) {
      throw new Error(err.message?.slice(0, 200) || fn);
    }
  }

  async start() {
    console.log('🤖 Agent Loop starting...');
    console.log(`   Network: ${this.cfg.name}`);
    console.log(`   Contract: ${this.contract}`);
    console.log(`   Agent: ${this.agent.address}`);
    console.log();

    await this.ensureSeated();

    while (this.running) {
      try {
        await this.gameLoop();
      } catch (err: any) {
        console.log(`   ⚠️ Loop error: ${err.message?.slice(0, 100)}`);
        await sleep(2000);
      }
    }
  }

  private async ensureSeated() {
    const phase = await this.read<number>('phase');
    if (phase !== 0) return;

    const pc = await this.read<bigint>('playerCount');
    const seatedAddrs = new Set<string>();
    for (let i = 0; i < Number(pc); i++) {
      const info = await this.read<[string, boolean, boolean, bigint, boolean, bigint]>('getPlayerInfo', [BigInt(i)]);
      if (info[0] && info[0] !== '0x0000000000000000000000000000000000000000') {
        seatedAddrs.add(info[0].toLowerCase());
      }
    }

    for (const p of this.allPlayers) {
      if (!seatedAddrs.has(p.address.toLowerCase())) {
        try {
          await this.write('sitDown', [{ x: p.viewer_x as `0x${string}`, y: p.viewer_y as `0x${string}` }]);
          console.log(`   ✅ ${p.name} sat down`);
        } catch (err: any) {
          if (!err.message.includes('already')) {
            console.log(`   ❌ ${p.name}: ${err.message}`);
          }
        }
        await sleep(500);
      }
    }
  }

  private async gameLoop() {
    const phase = await this.read<number>('phase');
    const pc = await this.read<bigint>('playerCount');

    if (phase === 0 && Number(pc) >= 2) {
      console.log(`\n--- Hand #${this.handCount + 1} ---`);
      this.handCount++;

      await this.dealNewHandIfNeeded();

      while (true) {
        const currentPhase = await this.read<number>('phase');
        const turnIdx = await this.read<bigint>('getCurrentTurnIndex');

        if (currentPhase === 0 || currentPhase === 5) break;

        if (currentPhase === 1 || currentPhase === 2 || currentPhase === 3 || currentPhase === 4) {
          const activeCount = await this.read<bigint>('activePlayerCount');
          if (Number(activeCount) <= 1) {
            await this.resolveHand();
            break;
          }

          if (turnIdx >= (1n << 256n) - 2n) {
            await this.dealNextStreet(currentPhase);
            continue;
          }

          const playerInfo = await this.read<[string, boolean, boolean, bigint, boolean, bigint]>('getPlayerInfo', [turnIdx]);
          const [addr, active, acted, bet, allIn, stack] = playerInfo;

          if (!active || allIn) {
            await sleep(300);
            continue;
          }

          const isMyTurn = addr.toLowerCase() === this.agent.address.toLowerCase();

          if (isMyTurn) {
            await this.takeTurn(addr, bet, stack);
          } else {
            await sleep(500);
          }
        } else {
          break;
        }
      }

      const finalPhase = await this.read<number>('phase');
      if (finalPhase === 4) {
        const turnIdx = await this.read<bigint>('getCurrentTurnIndex');
        if (turnIdx >= (1n << 256n) - 2n) {
          await this.handleShowdown();
        }
      }
    }

    await sleep(2000);
  }

  private async dealNewHandIfNeeded() {
    const phase = await this.read<number>('phase');
    if (phase === 0) {
      try {
        await this.write('dealNewHand');
        console.log('   🃏 New hand dealt');
      } catch (err: any) {
        console.log(`   ⚠️ dealNewHand: ${err.message.slice(0, 80)}`);
      }
      await sleep(1500);
    }
  }

  private async dealNextStreet(currentPhase: number) {
    try {
      if (currentPhase === 1) {
        await this.write('dealFlop');
        console.log('   🃏 Flop dealt');
      } else if (currentPhase === 2) {
        await this.write('dealTurn');
        console.log('   🃏 Turn dealt');
      } else if (currentPhase === 3) {
        await this.write('dealRiver');
        console.log('   🃏 River dealt');
      }
    } catch (err: any) {
      console.log(`   ⚠️ deal: ${err.message.slice(0, 80)}`);
    }
    await sleep(1500);
  }

  private async takeTurn(addr: string, currentBet: bigint, stack: bigint) {
    const cBet = await this.read<bigint>('currentBet');
    const toCall = cBet - currentBet;
    const pot = await this.read<bigint>('pot');

    const toCallHuman = Number(toCall) / Math.pow(10, this.cfg.token_decimals);
    const stackHuman = Number(stack) / Math.pow(10, this.cfg.token_decimals);
    const potHuman = Number(pot) / Math.pow(10, this.cfg.token_decimals);

    console.log(`   🎯 My turn — stack: ${stackHuman}, to call: ${toCallHuman}, pot: ${potHuman}`);

    let action: string;
    let args: any[] = [];
    const rand = Math.random();

    if (toCall === 0n) {
      if (rand < 0.5) {
        action = 'check';
        console.log('   → Check');
      } else {
        action = 'raise';
        const raiseUnit = 5n * BigInt(10 ** this.cfg.token_decimals);
        const raiseAmt = [1, 2, 3, 5][Math.floor(Math.random() * 4)] * raiseUnit;
        args = [raiseAmt];
        console.log(`   → Raise +${Number(raiseAmt) / Math.pow(10, this.cfg.token_decimals)}`);
      }
    } else {
      const canAfford = stack >= toCall;
      if (!canAfford) {
        if (stack > 0 && rand < 0.6) {
          action = 'call';
          console.log(`   → Call ALL-IN`);
        } else {
          action = 'fold';
          console.log('   → Fold');
        }
      } else if (toCall > 100n * BigInt(10 ** this.cfg.token_decimals) && rand < 0.2) {
        action = 'fold';
        console.log('   → Fold (too expensive)');
      } else if (rand < 0.7) {
        action = 'call';
        console.log(`   → Call`);
      } else {
        action = 'raise';
        const raiseUnit = 5n * BigInt(10 ** this.cfg.token_decimals);
        const raiseAmt = [1, 2, 3][Math.floor(Math.random() * 3)] * raiseUnit;
        args = [raiseAmt];
        console.log(`   → Raise`);
      }
    }

    try {
      const tx = await this.write(action, args.length > 0 ? args : undefined);
      console.log(`   ✅ TX: ${tx.slice(0, 12)}...`);
    } catch (err: any) {
      console.log(`   ❌ ${err.message.slice(0, 80)}`);
    }

    await sleep(800);
  }

  private async resolveHand() {
    try {
      await this.write('resolveHand');
      console.log('   🏆 Hand resolved');
    } catch (err: any) {
      console.log(`   ⚠️ resolveHand: ${err.message.slice(0, 80)}`);
    }
    await sleep(1500);
  }

  private async handleShowdown() {
    console.log('   🏆 Showdown!');
    const activeCount = await this.read<bigint>('activePlayerCount');

    if (Number(activeCount) > 1) {
      try {
        const tx = await this.write('revealCards', [], BigInt(this.cfg.ctx_value), this.cfg.ctx_gas_limit);
        console.log(`   🔐 revealCards TX: ${tx.slice(0, 12)}...`);
        console.log('   ⏳ Waiting for CTX decryption...');

        for (let i = 0; i < 30; i++) {
          await sleep(2000);
          const phase = await this.read<number>('phase');
          if (phase === 0) {
            console.log('   ✅ Cards revealed, hand complete!');
            break;
          }
          if (i % 5 === 0) {
            console.log(`   ⏳ Waiting... (${i * 2}s)`);
          }
        }
      } catch (err: any) {
        console.log(`   ⚠️ revealCards: ${err.message.slice(0, 100)}`);
        try {
          await this.write('resolveHand');
          console.log('   🏆 resolveHand fallback');
        } catch {}
      }
    }

    await sleep(2000);
  }

  stop() {
    this.running = false;
  }
}

async function main() {
  const networkName = process.argv[2] || 'base-sepolia';
  if (!(networkName in NETWORKS)) {
    console.log(`❌ Unknown network: ${networkName}`);
    console.log(`   Available: ${Object.keys(NETWORKS).join(', ')}`);
    process.exit(1);
  }

  const cfg = NETWORKS[networkName];
  const data = await loadData();
  const agentLoop = new AgentLoop(cfg, data.agent, data.bots);

  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping agent loop...');
    agentLoop.stop();
    process.exit(0);
  });

  await agentLoop.start();
}

main().catch(console.error);