import { randomBytes, createWalletClient, http } from 'viem';
import { privateKeyToAddress, privateKeyToAccount } from 'viem/accounts';
import { ec as EC } from '@noble/curves/secp256k1';

const RPC = 'https://base-sepolia-testnet.skalenodes.com/v1/base-testnet';
const CONTRACT = '0x0D5d9697bda657c1ba2D1882dcF7BB20903D3aDC';
const MOCK_SKL = '0x4C1928684B7028C2805FA1d12aCEd5c839A8D42C';
const AGENT_KEY = '0x8d15c36c01a8a72179d65da71a1a8cb82c9b907ee1f2fc5fe8c271dd4ccf19be';
const AGENT_ADDR = privateKeyToAddress(AGENT_KEY as `0x${string}`);

function getPublicKey(privHex: string): { x: string; y: string } {
  const privInt = BigInt(privHex);
  const pub = EC.ProjectivePoint.BASE.multiply(privInt);
  return {
    x: '0x' + pub.x.toString(16).padStart(64, '0'),
    y: '0x' + pub.y.toString(16).padStart(64, '0'),
  };
}

function genWallet(): { address: string; privateKey: string; viewerX: string; viewerY: string } {
  const privateKey = '0x' + randomBytes(32).toString('hex');
  const address = privateKeyToAddress(privateKey as `0x${string}`);
  const pubKey = getPublicKey(privateKey.slice(2));
  return {
    address,
    privateKey,
    viewerX: pubKey.x,
    viewerY: pubKey.y,
  };
}

function main() {
  console.log('Generating wallets...\n');

  const agentViewer = getPublicKey(AGENT_KEY.slice(2));
  const agent = {
    address: AGENT_ADDR,
    private_key: AGENT_KEY,
    viewer_x: agentViewer.x,
    viewer_y: agentViewer.y,
  };
  console.log(`Agent: ${agent.address}`);

  const bots: { name: string; address: string; private_key: string; viewer_x: string; viewer_y: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const w = genWallet();
    bots.push({
      name: `Bot${i + 1}`,
      address: w.address,
      private_key: w.privateKey,
      viewer_x: w.viewerX,
      viewer_y: w.viewerY,
    });
    console.log(`Bot${i + 1}: ${w.address}`);
  }

  const data = {
    rpc: RPC,
    contract: CONTRACT,
    mock_skl: MOCK_SKL,
    agent,
    bots,
  };

  const outPath = './poker-deploy.json';
  const fs = await import('fs/promises');
  await fs.writeFile(outPath, JSON.stringify(data, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
}

main().catch(console.error);