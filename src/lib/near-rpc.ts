export const NEAR_RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? "https://rpc.testnet.near.org";
export const NEAR_EXPLORER = "https://testnet.nearblocks.io";

export class RpcError extends Error {
  constructor(public kind: "unknown_account" | "no_method" | "other", message: string) {
    super(message);
  }
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(NEAR_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "p", method, params }),
  });
  const body = await res.json();
  const text = JSON.stringify(body.error ?? body.result?.error ?? "");
  if (body.error || body.result?.error) {
    if (/UNKNOWN_ACCOUNT|does not exist/i.test(text)) throw new RpcError("unknown_account", text);
    if (/MethodNotFound|MethodResolveError|CodeDoesNotExist|no contract code/i.test(text)) throw new RpcError("no_method", text);
    throw new RpcError("other", text);
  }
  return body.result as T;
}

export type AccountView = { amount: string; code_hash: string; storage_usage: number };

export const viewAccount = (account_id: string) =>
  rpc<AccountView>("query", { request_type: "view_account", finality: "final", account_id });

export const accessKeys = (account_id: string) =>
  rpc<{ keys: { public_key: string; access_key: { permission: "FullAccess" | object } }[] }>("query", {
    request_type: "view_access_key_list", finality: "final", account_id,
  });

export async function viewCall<T>(account_id: string, method_name: string, args: object = {}): Promise<T> {
  const r = await rpc<{ result: number[] }>("query", {
    request_type: "call_function", finality: "final", account_id, method_name,
    args_base64: btoa(JSON.stringify(args)),
  });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result))) as T;
}

export const NO_CODE = "11111111111111111111111111111111";
