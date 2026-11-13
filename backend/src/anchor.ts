import { Account, JsonRpcProvider, KeyPairSigner } from "near-api-js";

/**
 * Anchors a settlement's commitment (hashes + clearing price) on NEAR through the registry contract in
 * contracts/registry. This is a real transaction, but it records a commitment only: it does not move tokens or
 * funds and it does not prove the auction ran in a TEE.
 */
export type AnchorConfig = { contractId: string; accountId: string; privateKey: string; rpcUrl: string; network: string };

export type AnchorInput = { launchId: string; inputHash: string; outputHash: string; codeHash: string; clearingPrice: string; mode: string };
export type AnchorRecord = { txHash: string; contract: string; network: string };

/** `null` (anchoring off) unless all of ANCHOR_CONTRACT, ANCHOR_ACCOUNT_ID, ANCHOR_PRIVATE_KEY and NEAR_RPC_URL are set. */
export function anchorConfigFromEnv(e: NodeJS.ProcessEnv = process.env): AnchorConfig | null {
  const { ANCHOR_CONTRACT: contractId, ANCHOR_ACCOUNT_ID: accountId, ANCHOR_PRIVATE_KEY: privateKey, NEAR_RPC_URL: rpcUrl } = e;
  if (!contractId || !accountId || !privateKey || !rpcUrl) return null;
  return { contractId, accountId, privateKey, rpcUrl, network: e.NEAR_NETWORK ?? "testnet" };
}

type Outcome = { status?: unknown; transaction?: { hash?: string } };
export type CallFn = (cfg: AnchorConfig, method: string, args: object) => Promise<Outcome>;

const realCall: CallFn = async (cfg, methodName, args) => {
  const signer = KeyPairSigner.fromSecretKey(cfg.privateKey as `ed25519:${string}`);
  const account = new Account(cfg.accountId, new JsonRpcProvider({ url: cfg.rpcUrl }), signer);
  return (await account.callFunctionRaw({ contractId: cfg.contractId, methodName, args, gas: 30_000_000_000_000n })) as Outcome;
};

export async function anchorResult(cfg: AnchorConfig, a: AnchorInput, call: CallFn = realCall): Promise<AnchorRecord> {
  const out = await call(cfg, "anchor", {
    launch_id: a.launchId,
    input_hash: a.inputHash,
    output_hash: a.outputHash,
    code_hash: a.codeHash,
    clearing_price: a.clearingPrice,
    mode: a.mode,
  });
  const failed = typeof out.status === "object" && out.status !== null && "Failure" in out.status;
  const txHash = out.transaction?.hash;
  if (failed || !txHash) throw new Error("The anchor transaction did not succeed.");
  return { txHash, contract: cfg.contractId, network: cfg.network };
}
