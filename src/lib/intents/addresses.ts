/**
 * Where a refund or tokens may be sent. Only chains NEAR Intents supports and that we can check the format of.
 * This checks the SHAPE of an address, not that it exists or that its owner can spend from it.
 * backend/src/settlement-core.ts has the same check; both are tested against shared/test-vectors/addresses.json.
 */
export type ChainId = "near" | "eth" | "base" | "arb" | "sol";

export const CHAINS: ReadonlyArray<{ id: ChainId; name: string; example: string }> = [
  { id: "near", name: "NEAR", example: "you.near" },
  { id: "eth", name: "Ethereum", example: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D" },
  { id: "base", name: "Base", example: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D" },
  { id: "arb", name: "Arbitrum", example: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D" },
  { id: "sol", name: "Solana", example: "13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK" },
];

export const isChain = (value: string): value is ChainId => CHAINS.some((c) => c.id === value);

const NEAR_NAMED = /^(?=.{2,64}$)([a-z0-9]+([-_][a-z0-9]+)*\.)*[a-z0-9]+([-_][a-z0-9]+)*$/;
const NEAR_IMPLICIT = /^[0-9a-f]{64}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** null when the address looks right for that chain, otherwise why not. */
export function addressProblem(chain: string, address: string): string | null {
  if (!isChain(chain)) return `${chain} is not a supported chain`;
  const a = address.trim();
  if (!a) return "enter an address";
  if (chain === "near") return NEAR_NAMED.test(a) || NEAR_IMPLICIT.test(a) ? null : "not a NEAR account id";
  if (chain === "sol") return SOLANA.test(a) ? null : "not a Solana address";
  return EVM.test(a) ? null : "not a 0x address with 40 hex characters";
}

export type Destination = { chain: ChainId; address: string };
