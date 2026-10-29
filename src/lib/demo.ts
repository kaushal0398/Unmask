import { clearAuction, type Bid, type Outcome } from "@/lib/auction";

/** Everything here is made up, to show the screens. The real data comes from the enclave and the chain. */

export type LaunchStatus = "open" | "sealed" | "settled";

export type Launch = {
  id: string;
  name: string;
  symbol: string;
  tagline: string;
  /** 0 to 360: the colour of the token's art. */
  hue: number;
  /** The token's mascot. */
  emoji: string;
  creator: string;
  supply: number;
  reserve: number;
  /** Most one account may bid for, as a share of the supply (0 to 1), or null for no cap. */
  cap: number | null;
  status: LaunchStatus;
  /** For an open launch: how long from "now" it stays open. */
  closesInMs?: number;
  bidCount: number;
  /** For a settled launch: every bid, which the enclave revealed only in aggregate until now. */
  bids?: Bid[];
  codeHash: string;
  inputHash?: string;
  attestation?: string;
  tokenContract: string;
};

const MIN = 60_000;

const PUP_BIDS: Bid[] = [
  { id: "a", label: "ana.near", limit: 0.05, qty: 200_000 },
  { id: "b", label: "ben.near", limit: 0.04, qty: 150_000 },
  { id: "c", label: "chi.near", limit: 0.035, qty: 250_000 },
  { id: "d", label: "dev.near", limit: 0.03, qty: 100_000 },
  { id: "e", label: "eli.near", limit: 0.028, qty: 200_000 },
  { id: "f", label: "fay.near", limit: 0.02, qty: 150_000 },
  { id: "g", label: "sniper-1.near", limit: 0.015, qty: 150_000, isBot: true },
  { id: "h", label: "sniper-2.near", limit: 0.015, qty: 150_000, isBot: true },
  { id: "i", label: "sniper-3.near", limit: 0.015, qty: 150_000, isBot: true },
  { id: "j", label: "sniper-4.near", limit: 0.015, qty: 150_000, isBot: true },
];

const SALT_BIDS: Bid[] = [
  { id: "a", label: "kai.near", limit: 0.09, qty: 80_000 },
  { id: "b", label: "lou.near", limit: 0.07, qty: 120_000 },
  { id: "c", label: "mia.near", limit: 0.06, qty: 90_000 },
  { id: "d", label: "noa.near", limit: 0.05, qty: 100_000 },
  { id: "e", label: "oli.near", limit: 0.04, qty: 60_000 },
];

export const LAUNCHES: Launch[] = [
  {
    id: "moonbean", name: "MoonBean", symbol: "BEAN", tagline: "The coffee coin that never sleeps.", hue: 292, emoji: "🫘", creator: "roast.near",
    supply: 1_000_000, reserve: 0.01, cap: 0.1, status: "open", closesInMs: 14 * MIN + 32_000, bidCount: 214,
    codeHash: "9f2c61b0d4e87a3c5b1f0e6d2a97c48b3e50f1a6d8c2b4970e3a5f61c8d2b7e4", tokenContract: "bean.moonbean.near",
  },
  {
    id: "frogwave", name: "FrogWave", symbol: "FROG", tagline: "Ribbit once. Everyone pays the same.", hue: 140, emoji: "🐸", creator: "pond.near",
    supply: 5_000_000, reserve: 0.005, cap: 0.05, status: "open", closesInMs: 3 * 60 * MIN + 12 * MIN, bidCount: 87,
    codeHash: "9f2c61b0d4e87a3c5b1f0e6d2a97c48b3e50f1a6d8c2b4970e3a5f61c8d2b7e4", tokenContract: "frog.frogwave.near",
  },
  {
    id: "nearlycat", name: "NearlyCat", symbol: "NCAT", tagline: "Almost a cat. Fully sealed.", hue: 270, emoji: "🐱", creator: "whisker.near",
    supply: 2_000_000, reserve: 0.02, cap: null, status: "sealed", bidCount: 402,
    codeHash: "9f2c61b0d4e87a3c5b1f0e6d2a97c48b3e50f1a6d8c2b4970e3a5f61c8d2b7e4", tokenContract: "ncat.nearlycat.near",
  },
  {
    id: "pixelpup", name: "PixelPup", symbol: "PUP", tagline: "Eight bits of loyalty.", hue: 200, emoji: "🐶", creator: "kennel.near",
    supply: 1_000_000, reserve: 0.01, cap: null, status: "settled", bidCount: PUP_BIDS.length, bids: PUP_BIDS,
    codeHash: "9f2c61b0d4e87a3c5b1f0e6d2a97c48b3e50f1a6d8c2b4970e3a5f61c8d2b7e4",
    inputHash: "c41e7d09a2b85f36e1d07c9b4a2e8f5160d3b7a9c2e4f81065b3d9a7e2c4f018",
    attestation: "tdx:3a91c0e7b2d84f5a6c1e9d07b3f2a8c4e5d61b09f7a3c2e8d4b50a1f6c9e7d23", tokenContract: "pup.pixelpup.near",
  },
  {
    id: "saltlamp", name: "SaltLamp", symbol: "SALT", tagline: "A warm glow for a cold market.", hue: 335, emoji: "🧂", creator: "glow.near",
    supply: 300_000, reserve: 0.03, cap: 0.2, status: "settled", bidCount: SALT_BIDS.length, bids: SALT_BIDS,
    codeHash: "9f2c61b0d4e87a3c5b1f0e6d2a97c48b3e50f1a6d8c2b4970e3a5f61c8d2b7e4",
    inputHash: "7be20a4c91d3f6580e2b7a1c4d9f3e6850a2c7b1d4e9f3a60c85b2d7e1f4a93c",
    attestation: "tdx:b84d2f60a1c7e39d5f08b2a6c4e1d97f3a50c8e2b6d4f1a9073c5e8b2d6f4a10", tokenContract: "salt.saltlamp.near",
  },
];

export const getLaunch = (id: string) => LAUNCHES.find((l) => l.id === id);

/** The auction's result for a settled launch, computed by the same rule the enclave runs. */
export function outcomeOf(l: Launch): Outcome | null {
  return l.bids ? clearAuction(l.bids, l.supply, l.reserve) : null;
}

/** The bids behind the landing page's race, the same for both launches. Snipers bid low, hoping for an early cheap price. */
export const RACE_BIDS: Bid[] = PUP_BIDS;
export const RACE_SUPPLY = 1_000_000;
export const RACE_RESERVE = 0.01;
