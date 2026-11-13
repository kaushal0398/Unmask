"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getApi } from "@/lib/api";
import { outcomeOf, type Launch } from "@/lib/demo";
import { usd } from "@/lib/format";

type Item = { id: string; emoji: string; image?: string; symbol: string; mcap: number; at: "reserve" | "clearing" };

/** Market cap = price x total supply. Open launches use the reserve; settled ones use the price they cleared at. */
async function itemOf(l: Launch): Promise<Item> {
  let price = l.reserve;
  let at: Item["at"] = "reserve";
  if (l.status === "settled") {
    const sample = outcomeOf(l);
    if (sample) {
      price = sample.price;
      at = "clearing";
    } else {
      const r = await getApi().getResult(l.id).catch(() => null);
      if (r) {
        price = r.clearingPrice;
        at = "clearing";
      }
    }
  }
  return { id: l.id, emoji: l.emoji, image: l.image, symbol: l.symbol, mcap: price * l.supply, at };
}

/** A slow, endless strip of the launches listed on the launches page, each a link with its market cap. Pure CSS motion. */
export function Ticker() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let live = true;
    getApi()
      .listLaunches()
      .then((all) => Promise.all((all as Launch[]).map(itemOf)))
      .then((list) => live && setItems(list))
      .catch(() => live && setItems([]));
    return () => { live = false; };
  }, []);

  if (items.length === 0) return null;

  // Repeat enough times that the strip is always wider than the screen, even with one launch.
  const loop = Array.from({ length: Math.max(3, Math.ceil(12 / items.length)) }, () => items).flat();

  return (
    <div className="group relative overflow-hidden bg-bg py-3">
      <div className="flex w-max animate-[ticker_38s_linear_infinite] gap-10 whitespace-nowrap group-hover:[animation-play-state:paused]">
        {loop.map((it, i) => (
          <Link key={`${it.id}-${i}`} href={`/launches/${encodeURIComponent(it.id)}`} className="flex items-center gap-2.5 text-sm text-muted hover:text-text" aria-hidden={i >= items.length} tabIndex={i >= items.length ? -1 : 0}>
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt="" className="size-6 object-cover" />
            ) : (
              <span className="text-lg">{it.emoji}</span>
            )}
            <span className="font-mono font-semibold text-text">${it.symbol}</span>
            <span className="text-faint">mcap {usd(it.mcap, { compact: true })}{it.at === "reserve" ? " at reserve" : ""}</span>
            <span className="text-faint/50">✦</span>
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent" />
    </div>
  );
}
