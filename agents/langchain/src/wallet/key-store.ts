import { secp256k1 } from "@noble/curves/secp256k1";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config";
import { deriveViewerKey, type ViewerKey } from "./viewer-key";


const SKALE_CHAIN: Chain = {
  id: config.chainId,
  name: "SKALE",
  nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
};

class KeyStore {
  private _privateKey: `0x${string}`;
  private _account: ReturnType<typeof privateKeyToAccount>;
  private _address: Address;
  private _viewerKey: ViewerKey;
  private _publicClient: PublicClient;
  private _walletClient: WalletClient;

  constructor() {
    this._privateKey = `0x${config.privateKey.startsWith("0x") ? config.privateKey.slice(2) : config.privateKey}` as `0x${string}`;
    this._account = privateKeyToAccount(this._privateKey);
    this._address = this._account.address;
    const pkBytes = secp256k1.utils.normPrivateKeyToScalar(this._privateKey.slice(2));
    this._viewerKey = deriveViewerKey(pkBytes);
    this._publicClient = createPublicClient({
      transport: http(config.rpcUrl),
      chain: SKALE_CHAIN,
    });
    this._walletClient = createWalletClient({
      transport: http(config.rpcUrl),
      chain: SKALE_CHAIN,
      account: this._account,
    });
  }

  getAddress(): Address {
    return this._address;
  }

  getViewerKey(): ViewerKey {
    return this._viewerKey;
  }

  async signAndSend(
    to: Address,
    data: `0x${string}`,
    value?: bigint,
  ): Promise<Hash> {
    const hash = await this._walletClient.sendTransaction({
      to,
      data,
      value,
      account: this._account,
      chain: SKALE_CHAIN,
    });
    // SKALE does not support replacing pending transactions (same nonce).
    // Wait for confirmation before returning so the next signAndSend call
    // gets a fresh nonce. This avoids "Pending transaction with same nonce already exists" errors.
    await this._publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async readContract(
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[] = [],
  ): Promise<unknown> {
    return this._publicClient.readContract({
      address,
      abi,
      functionName,
      args,
      account: this._address,
    });
  }

  getPublicClient(): PublicClient {
    return this._publicClient;
  }

  getWalletClient(): WalletClient {
    return this._walletClient;
  }

  async getBalance(address: Address): Promise<bigint> {
    return this._publicClient.getBalance({ address });
  }
}

let instance: KeyStore | null = null;

export function getKeyStore(): KeyStore {
  if (!instance) {
    instance = new KeyStore();
  }
  return instance;
}
