/**
 * Writes shared/test-vectors/auction-v1-cases.json from the TypeScript rule.
 * Run: npx tsx scripts/gen-test-vectors.ts
 * The Rust engine (enclave/auction-engine) must reproduce every `expected` exactly.
 */
import { writeFileSync } from "node:fs";
import { clearAuctionExact, type ExactAuctionInput, type ExactBid } from "../src/lib/auction-core";

const bid = (id: string, limitPrice: string, quantity: string): ExactBid => ({ id, bidder: `${id.toLowerCase()}.near`, limitPrice, quantity });
const base = (over: Partial<ExactAuctionInput>): ExactAuctionInput => ({
  version: "1", auctionId: "case", supply: "1000000", reservePrice: "1000000", tokenDecimals: 0, bids: [], ...over,
});

const cases: Array<{ name: string; input: ExactAuctionInput }> = [
  { name: "worked example from the README", input: base({ auctionId: "worked-example-001", bids: [bid("A", "5000000", "400000"), bid("B", "4000000", "300000"), bid("C", "3000000", "300000"), bid("D", "2000000", "200000")] }) },
  { name: "demand below supply clears at the reserve", input: base({ auctionId: "undersubscribed", bids: [bid("A", "5000000", "200000"), bid("B", "3000000", "100000")] }) },
  { name: "no bids at all", input: base({ auctionId: "no-bids", bids: [] }) },
  { name: "every bid below the reserve", input: base({ auctionId: "all-below-reserve", reservePrice: "9000000", bids: [bid("A", "5000000", "400000"), bid("B", "4000000", "300000")] }) },
  { name: "one bid larger than the supply", input: base({ auctionId: "whale", supply: "100", bids: [bid("A", "7000000", "5000"), bid("B", "2000000", "10")] }) },
  { name: "three equal bids split 10 tokens, crumb goes by id", input: base({ auctionId: "marginal-tie", supply: "10", bids: [bid("C", "3000000", "5"), bid("A", "3000000", "5"), bid("B", "3000000", "5")] }) },
  { name: "unequal marginal bids, crumbs by largest remainder", input: base({ auctionId: "marginal-remainders", supply: "100", bids: [bid("A", "9000000", "30"), bid("B", "4000000", "40"), bid("C", "4000000", "33"), bid("D", "4000000", "27")] }) },
  { name: "supply exactly matches demand", input: base({ auctionId: "exact-fit", supply: "500", bids: [bid("A", "6000000", "200"), bid("B", "5000000", "300"), bid("C", "4000000", "50")] }) },
  { name: "token with 6 decimals, payments round up", input: base({ auctionId: "decimals-6", supply: "5000000", reservePrice: "1500000", tokenDecimals: 6, bids: [bid("A", "2750001", "2500003"), bid("B", "2750001", "2500003"), bid("C", "1500001", "999999")] }) },
  { name: "token with 24 decimals", input: base({ auctionId: "decimals-24", supply: "1000000000000000000000000", reservePrice: "1000", tokenDecimals: 24, bids: [bid("A", "5000", "600000000000000000000000"), bid("B", "3000", "700000000000000000000000")] }) },
  { name: "bid exactly at the reserve", input: base({ auctionId: "at-reserve", supply: "100", reservePrice: "2000000", bids: [bid("A", "2000000", "60"), bid("B", "2000000", "60")] }) },
  { name: "many bids at distinct prices", input: base({ auctionId: "ladder", supply: "1000", bids: Array.from({ length: 25 }, (_, i) => bid(`B${String(i).padStart(2, "0")}`, String(1_000_000 + i * 250_000), String(20 + (i % 7) * 5))) }) },
];

const out = { version: "1", description: "Generated from src/lib/auction-core.ts by scripts/gen-test-vectors.ts. The Rust engine must match every expected outcome.", cases: cases.map((c) => ({ name: c.name, input: c.input, expected: clearAuctionExact(c.input) })) };
writeFileSync(new URL("../shared/test-vectors/auction-v1-cases.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.cases.length} cases`);
